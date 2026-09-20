/* Протокол машины, берущей работу, — половина файла, отвечающая за ПРОДУКТ 1.
 *
 * claim / step / report / state / crash: то, чем агент на чужом компьютере разговаривает с аккаунтом. Ни
 * одного тула здесь нет и быть не должно — тулы в _mcp-tools.mjs, маршрут в mcp.js. См. SPLIT-PLAN §4.2.
 *
 * Словарь очереди, который пишет каталог и читает эта половина, живёт в _queue.mjs: положи его в любую из
 * двух, и вторая начнёт импортировать первую — после чего имя файла перестанет отвечать на вопрос, ради
 * которого их и разделили.
 */
import { flowBody, parseMacro, summarize } from './_macro.mjs';
import { flowFor } from './_flow-for.mjs';
import { advance, startLoop } from './_step.mjs';
import { EARLIER_RUNS, GOAL_MAX, earlierRuns } from './_brain.mjs';
import { ALLOWED_MODELS } from './_vision.mjs';
import { readSettings } from './admin.js';
import { fillGoal, missingParams } from '../extension/skills.js';
import { report, reportSaid } from './_report.js';
import { FAILS_BEFORE_PAUSE, decide, ruleOf, whenSaid } from './_schedule.mjs';
import { checksOf } from './_expect.mjs';
import { ARTIFACT_KEEP_DAYS, artifactId, dropWhich, tooBig } from './_artifact.mjs';
import { overSpend, spentWhy } from './_spend.mjs';
import { BROWSER_GOAL, jobId, scheduleId } from './_queue.mjs';
import { caseGoal, caseIdOf, stripCase } from './_case.mjs';
import { PAYLOAD_MAX_BYTES } from './_payload.mjs';

/* And how long a worker's claim request may hold open with nothing to do. One request every half minute
 * beats one every three seconds, and an idle loop is not billed as CPU. */
/* HOW LONG THIS WILL HOLD A CLAIM OPEN, and it is a ceiling set by the function rather than by taste.
 *
 * It was 25 seconds, and both couriers asked for exactly that. A serverless function here has no declared
 * maxDuration - not in vercel.json, not in an export - so it gets the plan default, which is ten seconds on
 * Hobby and fifteen on Pro. Every idle poll was therefore GUARANTEED to be killed in flight, and the agent
 * logged the two ways that shows up, over and over: `HTTP 0` when the connection died before the headers,
 * and `HTTP 200` when it died after them with the body half sent - a reply that says `{ ok: true, job: null }`
 * read as a failure to reach the account.
 *
 * Six leaves room for the work either side of the wait: the stale-claim sweep, the claim attempt itself and
 * the flow read all happen inside the same invocation, and the whole of it has to finish under ten.
 *
 * CAPPED HERE, and that is the point of putting it here rather than only in the agents. An agent is a
 * compiled binary somebody has to reinstall - the note by `claimerIsWorker` makes the same argument - so a
 * number changed only there arrives when every machine has been rebuilt. This clamps whatever is asked for,
 * so an agent already installed and asking for 25 gets a clean answer at 6 on the next deploy.
 *
 * The other way out is declaring a maxDuration above 25, which is a Pro feature and would leave every Hobby
 * deployment of this repository broken in the same way. This works on both. */
const CLAIM_WAIT_MAX_MS = 6_000;

const CLAIM_POLL_MS = 1_000;

/* A job a worker took and never reported. Not returned to the pool - a run that may be half-done must not
 * be repeated blind - so it is failed with a reason. */
const CLAIM_STALE_MS = 45 * 60 * 1000;

async function stampWorker(sql, userId, key = 'worker.seen') {
  try {
    await sql`
      insert into user_pref (user_id, key, value) values (${userId}, ${key}, ${new Date().toISOString()})
      on conflict (user_id, key) do update set value = excluded.value, updated_at = now()
    `;
  } catch (_) { /* the stamp is a convenience, never a precondition */ }
}

async function agentIsListening(sql, userId) {
  try {
    const rows = await sql`
      select value from user_pref where user_id = ${userId} and key = 'agent.steps.seen'
    `;
    if (!rows.length) return false;
    return Date.now() - new Date(rows[0].value).getTime() < AGENT_LISTENING_MS;
  } catch (_) {
    /* Unknown means "no", which leaves the worker able to take goals - the behaviour that existed before
     * any of this. A precedence rule must not be the thing that stops work happening. */
    return false;
  }
}

/* ------------------------------------------------------------------------------- расписания
 *
 * ЧАСАМИ СЛУЖИТ ОПРОС АГЕНТА, и это главное решение всей функции. Прогон двигает настоящую мышь на чьей-то
 * машине, значит он может случиться только пока эта машина не спит и берёт работу. Крон в облаке, который
 * срабатывает в 03:00, срабатывает в пустоту - а курьер агента спрашивает этот аккаунт каждые три секунды и
 * самим фактом вопроса сообщает, что машина жива. Поэтому «что пора» проверяется здесь, по пути, и второго
 * планировщика, который может сломаться отдельно, в системе нет.
 *
 * ЧТО ЭТО СТАВИТ В ОЧЕРЕДЬ: обычную строку run_queue. Дальше прогон неотличим от того, который попросили
 * руками, - тот же claim, тот же отчёт, та же история, те же потолки расхода. Ни одной ветки «а это по
 * расписанию» нигде ниже.
 */
async function dueNow(sql, who) {
  let rows;
  try {
    rows = await sql`
      select id, flow_id, tool_name, args, label, kind, every_minutes, at_minutes, days, zone,
             next_at, fails
      from user_schedule
      where user_id = ${who.id} and deleted_at is null and paused = false
        and next_at is not null and next_at <= now()
      order by next_at limit 8
    `;
  } catch (_) {
    /* Таблицы может не быть - миграция не применена на этом деплое. Расписания тогда просто не работают, и
     * это НЕ повод отказать агенту в работе, которую он пришёл забрать: claim обслуживает ручные запуски и
     * без них. Молча, потому что сказать здесь некому - это ответ машине, а не человеку. */
    return;
  }
  if (!rows.length) return;

  /* Занято - это состояние аккаунта, а не расписания: одна мышь на все расписания и на ручной запуск тоже.
   * Спрашивается один раз на такт. */
  const busyRows = await sql`
    select id from run_queue where user_id = ${who.id} and state in ('queued', 'claimed') limit 1
  `;
  let busy = busyRows.length > 0;

  const nowMs = Date.now();
  for (const row of rows) {
    const rule = ruleOf(row);
    const dueMs = new Date(row.next_at).getTime();
    const verdict = decide({ rule, dueMs, nowMs, busy });

    if (verdict.do === 'run') {
      /* Скилл, на который расписание показывает, мог быть удалён. Ставить строку, которая гарантированно
       * провалится, и делать это каждый час - это шум и расход; расписание останавливается и говорит, что
       * стало с целью. Команды на '#' проверять не надо - у них нет строки. */
      if (!String(row.flow_id).startsWith('#')) {
        const alive = await sql`
          select 1 from user_flow
          where user_id = ${who.id} and client_id = ${row.flow_id} and deleted_at is null limit 1
        `;
        if (!alive.length) {
          await sql`
            update user_schedule set paused = true,
                   paused_why = 'the skill it runs was deleted',
                   last_at = now(), last_said = 'the skill it runs no longer exists',
                   updated_at = now()
            where id = ${row.id}
          `;
          continue;
        }
      }
      const id = jobId();
      await sql`
        insert into run_queue (id, user_id, flow_id, tool_name, args, schedule_id)
        values (${id}, ${who.id}, ${row.flow_id}, ${row.tool_name},
                ${JSON.stringify(row.args || {})}, ${row.id})
      `;
      /* ОДНОРАЗОВОЕ, КОТОРОЕ СРАБОТАЛО, - ЗАКОНЧЕНО, а не «на паузе». Раньше оно оставалось в списке живых
       * расписаний с пометкой «it was a one-off, and it has run», и за ночь их набралось двадцать: каждый
       * прогон, отложивший себя через defer_until, оставлял ещё одну строку с кнопкой Resume, которая ничем
       * не могла кончиться. Прогон уже записан в истории; расписание своё дело сделало. db/018 говорит про
       * once ровно это - «at next_at, then done». Строка остаётся (отчёт об исходе ещё найдёт её по
       * schedule_id), но из перечней уходит. */
      await sql`
        update user_schedule
        set next_at = ${verdict.nextAt ? new Date(verdict.nextAt).toISOString() : null},
            paused = ${verdict.nextAt === null},
            paused_why = ${verdict.nextAt === null ? 'it was a one-off, and it has run' : null},
            deleted_at = ${verdict.nextAt === null ? new Date().toISOString() : null},
            last_at = now(), last_said = ${`queued - ${verdict.why}`},
            runs = runs + 1, fails = 0, updated_at = now()
        where id = ${row.id}
      `;
      /* Одна мышь: остальные подошедшие расписания на этом такте уступают, а не выстраиваются в очередь. */
      busy = true;
      continue;
    }

    /* Пропущено или уступлено - записывается ТАМ, ГДЕ ЧЕЛОВЕК УВИДИТ. Ни то, ни другое не становится
     * прогоном, поэтому в истории прогонов их нет, и расписание, которое молча ничего не делает, было бы
     * ровно тем провалом, с которым эта функция иначе уехала бы в продукт. */
    await sql`
      update user_schedule
      set next_at = ${verdict.nextAt ? new Date(verdict.nextAt).toISOString() : null},
          paused = ${verdict.pause ? true : false},
          paused_why = ${verdict.pause || null},
          last_at = now(), last_said = ${verdict.why},
          misses = misses + ${verdict.do === 'miss' ? 1 : 0}, updated_at = now()
      where id = ${row.id}
    `;
  }
}

/* One stopped recording, as a row.
 *
 * parseMacro and flowFor are the app's own, imported rather than repeated - flowFor's comment says why there
 * is one of them, and this is its fourth caller. The `windows` a replay needs are derived from the events'
 * own `#ctx` instead of from polling the foreground window: more faithful, and available to something that
 * was not watching while the recording ran, which is exactly the case here.
 */
async function saveRecording(sql, who, macro, health) {
  const { events, problems } = parseMacro(macro);
  if (!events.length) {
    return { ok: false, said: 'It stopped, and nothing had been captured. Nothing was saved.' };
  }

  const seen = new Map();
  for (const event of events) {
    const ctx = event && event.context;
    if (!ctx || (!ctx.app && !ctx.window)) continue;
    const key = `${ctx.app || ''}\u0000${ctx.window || ''}`;
    if (!seen.has(key)) seen.set(key, { title: ctx.window || ctx.app || '', process: ctx.app || '' });
  }
  const windows = [...seen.values()].slice(0, 12);

  const now = new Date();
  const two = (n) => String(n).padStart(2, '0');
  const rec = {
    id: `r${Math.random().toString(36).slice(2, 10)}`,
    name: `MouseFlow ${two(now.getDate())}/${two(now.getMonth() + 1)} `
      + `${two(now.getHours())}:${two(now.getMinutes())}:${two(now.getSeconds())}`,
    created: now.toISOString(),
    events,
    windows,
  };
  const row = flowFor(rec, health);

  /* ТОТ ЖЕ ПОТОЛОК, ЧТО И У ВТОРОГО ПИСАТЕЛЯ. Эта функция пишет в user_flow.payload наравне с
   * api/sync.js, и потолок стоял только там - то есть запись, слишком большую, чтобы синхронизироваться,
   * можно было положить сюда, и она бы легла. Отказ здесь - строка, которую человек прочитает; отсутствие
   * отказа - строка, которую он потом не сможет ни открыть, ни забрать. */
  const encoded = JSON.stringify(row.payload);
  if (encoded.length > PAYLOAD_MAX_BYTES) {
    return {
      ok: false,
      said: `That recording is ${Math.round(encoded.length / 1024)}KB, and the ceiling is `
        + `${Math.round(PAYLOAD_MAX_BYTES / 1024)}KB, so it was not saved. It is still on the machine `
        + 'that recorded it — stop it in shorter stretches, or collect it from the app.',
    };
  }

  await sql`
    insert into user_flow
      (user_id, client_id, source, kind, name, description, payload, origins, created_at, updated_at)
    values
      (${who.id}, ${row.id}, 'desktop', 'recorded', ${row.name}, ${row.description},
       ${encoded}, ${row.origins}, ${row.created}, now())
    on conflict (user_id, client_id) do update set
      name = excluded.name, description = excluded.description, payload = excluded.payload,
      origins = excluded.origins, updated_at = now(), deleted_at = null
  `;

  const s = summarize(events);
  const where = windows.map((w) => w.title).filter(Boolean).slice(0, 3);
  return {
    ok: true,
    said: `Saved as "${rec.name}" (${rec.id}): ${s.count} events, ${s.clicks} `
      + `click${s.clicks === 1 ? '' : 's'}`
      + (where.length ? `, in ${where.join(', ')}` : '') + '.'
      + (problems.length ? ` ${problems.length} lines could not be read and were skipped.` : '')
      + ' Nothing about what was typed is in it, by design.',
  };
}

export async function workerRoute(action, req, res, sql, who) {
  if (action === 'claim') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST' });
    await stampWorker(sql, who.id);

    /* ЧАСЫ РАСПИСАНИЙ - ЗДЕСЬ. Этот запрос и есть доказательство, что машина жива и берёт работу, так что
     * подошедшее по расписанию ставится в очередь ровно перед тем, как из неё берут. См. dueNow. */
    await dueNow(sql, who);

    /* Anything a worker took and never came back from. Failed rather than requeued: a run that may be
     * half-done must not be repeated blind, and a person can ask for it again knowing what happened. */
    await sql`
      update run_queue set state = 'failed', ok = false, finished_at = now(),
             said = 'the machine took this job and never reported back'
      where user_id = ${who.id} and state = 'claimed'
        and claimed_at < now() - ${`${Math.round(CLAIM_STALE_MS / 1000)} seconds`}::interval
    `;

    const by = String((req.body && req.body.worker) || 'worker').slice(0, 60);
    /* WHAT THIS CLAIMER CAN ACTUALLY DO, which the queue did not ask until it had to.
     *
     * There are two kinds of claimer on one account and they are not interchangeable. An agent's own
     * courier can start a recording, stop one, and replay a body - it has no model in it, so a GOAL skill,
     * whose whole nature is a model deciding one action at a time, is something it can only answer "asked
     * to do something it does not understand" to. The worker has the model path.
     *
     * Both POST here with the same shape, and this took the oldest queued row regardless. While everything
     * queued was a `#record.*` command, which both can do, nothing went wrong; the first goal skill queued
     * on a machine running both went to whichever long-poll landed first, and it was observed doing exactly
     * that - the courier took it and answered "does not understand".
     *
     * THE WORKER DECLARES ITSELF, and which side declares is the whole decision.
     *
     * Having the AGENT declare instead is the version that never refuses an old worker anything, and it was
     * written that way first. It is wrong for one concrete reason: an agent is a COMPILED BINARY installed
     * on somebody's machine, so that fix arrives only when every one of them has been rebuilt and
     * reinstalled. The worker is a checkout of this repository run by node - it updates with `git pull`.
     * Declaring on the side that can actually be updated is what makes the fix land.
     *
     * The cost is real and worth stating: a worker too old to declare itself stops being given goal skills.
     * They queue, and the caller is told nothing picked them up - which is a true sentence somebody can act
     * on, unlike the one this replaced. */
    const claimerIsWorker = String((req.body && req.body.kind) || '') === 'worker';
    /* An agent that can carry a goal one turn at a time (see ?worker=step) may take those jobs as well.
     * It DECLARES it, exactly as the worker does, and for the same reason: the ones that cannot must go on
     * not being given them, and no deploy here can tell an old binary apart from a new one. */
    const claimerSaysSteps = !!(req.body && req.body.steps === true);
    /* ТРЕТИЙ ВИД ЗАБИРАЮЩЕГО, И ОН РАЗДЕЛЯЕТ ОЧЕРЕДЬ НАДВОЕ ПО ПОВЕРХНОСТИ.
     *
     * Браузерное расширение шагает по элементам страницы, десктопный агент - по координатам экрана, и это
     * не два диалекта одного, а две несовместимые вещи: `flowBody` ниже строит пятиколоночное тело из
     * payload.events, а у браузерного навыка в событиях селекторы и никаких x/y. Пока mouseflow_run
     * браузерные навыки ОТКАЗЫВАЛСЯ ставить в очередь, это не могло случиться - отказ и был защитой. Раз
     * он их теперь ставит, защита обязана переехать сюда, в выбор строки.
     *
     * Поэтому условие ровно симметричное: браузерный забирающий берёт ТОЛЬКО навыки не-десктопного
     * источника, а все остальные - только то, что не браузерный навык, включая команды на '#'. Ни один
     * забирающий не может получить работу, для которой у него нет ни рук, ни системы координат. */
    const claimerIsBrowser = String((req.body && req.body.kind) || '') === 'browser';
    /* И ОНО УМЕЕТ ЦЕЛИ, в отличие от агента. Расширение несёт свою модель (runGoal в
     * extension/agent.js): оно смотрит на страницу и решает один шаг за раз само, ничего не спрашивая у
     * этой стороны. Поэтому объявлять `steps` ему не надо - это просто правда о том, что оно такое. */
    const browserDoesGoals = claimerIsBrowser;
    if (claimerIsBrowser) await stampWorker(sql, who.id, 'extension.claim.seen');
    if (claimerSaysSteps && !claimerIsWorker) await stampWorker(sql, who.id, 'agent.steps.seen');

    /* WHEN BOTH ARE LISTENING, THE AGENT WINS - and this is a reversal, so it is worth the paragraph.
     *
     * There is one mouse. A worker and a step-capable agent on the same machine both long-poll here, and
     * whichever asked first used to take the job; on an unlucky pair of polls that is two loops driving one
     * pointer. The plan that started this work said the WORKER should win, on the grounds that it was the
     * proven path. It is not the right answer any more: the worker is the install step this whole change
     * exists to remove, and leaving it in front means the new path never runs on any machine that still has
     * one - which is every machine that could tell us it is broken.
     *
     * So: a worker is not offered a goal while an agent that can do goals is listening. It keeps everything
     * else, and it takes goals again by itself if that agent stops asking. A machine with only a worker is
     * unaffected. */
    const stepperListening = claimerIsWorker ? await agentIsListening(sql, who.id) : false;
    const claimerSteps = claimerIsWorker ? !stepperListening : claimerSaysSteps;
    /* И третий забирающий, отдельной строкой, чтобы правило старшинства между воркером и агентом выше
     * осталось ровно тем, чем было: браузер в нём не участвует - он на своей поверхности один. */
    const goalCapable = claimerSteps || browserDoesGoals;
    const wait = Math.min(CLAIM_WAIT_MAX_MS, Math.max(0, Number((req.body && req.body.wait) || 0) * 1000));
    const until = Date.now() + wait;

    for (;;) {
      /* One statement, so two workers on one account cannot take the same job: the row is selected and
       * claimed in the same update. */
      const took = await sql`
        update run_queue set state = 'claimed', claimed_by = ${by}, claimed_at = now()
        where id = (
          select id from run_queue q
          where q.user_id = ${who.id} and q.state = 'queued'
            /* A command starts with '#' and both kinds can do it; a skill has to be looked at. An agent is
             * handed everything EXCEPT a created skill - and a flow row that has gone missing counts as
             * not-a-goal, so a stale job still gets claimed and fails with a reason rather than sitting in
             * the queue forever waiting for a claimer that will never be allowed to take it. */
            and (
              ${goalCapable}
              or q.flow_id like '#%'
              or not exists (
                select 1 from user_flow f
                where f.user_id = q.user_id and f.client_id = q.flow_id
                  and f.deleted_at is null and f.kind = 'created'
              )
            )
            /* МАШИНА, КОТОРОЙ ЭТА РАБОТА ПРЕДНАЗНАЧЕНА (пункт 7, часть 2).
             *
             * NULL значит «любая»: отсутствие привязки - это отсутствие требования, а не запрет. Иначе в
             * день применения миграции остановилась бы вся существующая очередь, у которой там NULL.
             *
             * СЛИЧАЕТСЯ С ТЕМ, ЧТО ПРИЕХАЛО, а не с третьей сущностью: забирающий присылает себя в
             * "worker" (у Windows-агента это Environment.MachineName), и это же значение пишется в
             * claimed_by. Привязка, которую не с чем сравнить в момент выбора строки, не работала бы.
             *
             * ЧЕРЕЗ to_jsonb, А НЕ q.machine - И ЭТО НАРОЧНО. Миграция 022 НЕ ПРИМЕНЕНА (стоячее правило:
             * только по явному разрешению владельца), а запрос, упомянувший несуществующую колонку, падает
             * целиком - то есть сломал бы claim на всём аккаунте, а не «не отфильтровал». to_jsonb(q)
             * отдаёт строку как объект, и у отсутствующего ключа значение NULL - то есть до применения
             * миграции условие тождественно истинно и привязка просто НЕ ДЕЙСТВУЕТ, ничего не ломая. После
             * применения она начинает действовать без единой правки здесь.
             *
             * Цена - to_jsonb на строку-кандидата; подзапрос и так сужен по user_id и state, так что
             * считать тут нечего, а правильность дороже. */
            and (
              (to_jsonb(q) ->> 'machine') is null
              or (to_jsonb(q) ->> 'machine') = ${by}
            )
            /* Поверхность. См. claimerIsBrowser выше: браузерному - только браузерное, всем остальным -
             * всё, кроме браузерного. */
            and (
              case when ${claimerIsBrowser}
                then q.flow_id = ${BROWSER_GOAL} or exists (
                  select 1 from user_flow f
                  where f.user_id = q.user_id and f.client_id = q.flow_id
                    and f.deleted_at is null and f.source <> 'desktop'
                )
                else q.flow_id <> ${BROWSER_GOAL} and not exists (
                  select 1 from user_flow f
                  where f.user_id = q.user_id and f.client_id = q.flow_id
                    and f.deleted_at is null and f.source <> 'desktop'
                )
              end
            )
          order by q.created_at limit 1
        )
        returning id, flow_id, tool_name, args
      `;
      if (took.length) {
        const job = took[0];
        /* An agent job carries an instruction, not a skill, so there is nothing to look up. Marked by the
         * flow id rather than by a column, because it is the flow id that is absent. */
        if (String(job.flow_id || '').startsWith('#')) {
          return res.status(200).json({
            ok: true,
            job: { id: job.id, toolName: job.tool_name, args: job.args || {}, command: job.flow_id, flow: null },
          });
        }
        const flow = await sql`
          select client_id, source, kind, name, description, payload, origins
          from user_flow where user_id = ${who.id} and client_id = ${job.flow_id} and deleted_at is null
        `;
        if (!flow.length) {
          await sql`
            update run_queue set state = 'failed', ok = false, finished_at = now(),
                   said = 'the skill was deleted between the ask and the run'
            where id = ${job.id}
          `;
          continue;
        }
        const row = flow[0];
        const payload = row.payload || {};
        const args = job.args || {};

        /* A replay body, built HERE.
         *
         * The claimer used to be a Node process that could import flowBody; now it can be the agent, which
         * is a small program that speaks the five-column format and knows nothing about skills, payloads or
         * parameters. Building it here is what lets that be true - and it is the same builder the Record
         * page uses, so a replay asked for by a chat and one asked for by the button are the same document.
         *
         * Only for a RECORDED skill: a created one is a goal, and a goal needs a model in the loop, which is
         * not something the agent has. The worker still handles those, and says so when it cannot. */
        let body = null;
        let activate = null;
        /* Браузерному забирающему тело не строится вовсе: он получает payload навыка как есть и знает, что
         * с ним делать - это его собственный формат. Строить ему пятиколоночное тело было бы переводом
         * между двумя системами координат, одна из которых у него отсутствует. */
        if (row.source !== 'desktop') {
          /* ТЕСТ-КЕЙС ДЛЯ БРАУЗЕРА - РАЗРЕШАЕТСЯ ЗДЕСЬ, а не в расширении, и это то же решение, что у
           * облачного драйвера: в строке очереди лежит только id кейса, а утверждения читаются в момент
           * старта, поэтому кейс, поправленный утром, ночью проверяется в новой редакции.
           *
           * И ЦЕЛЬ СОСТАВЛЯЕТСЯ ТОЖЕ ЗДЕСЬ. Расширение могло бы дописать проверки к цели само - у него
           * есть и fillGoal, и payload, - но тогда слова, которыми модели говорят «проверь это тулом, а не
           * глазом», существовали бы в двух редакциях и разошлись бы первым же уточнением. Здесь их одна
           * функция (caseGoal), и она уже импортирована ради облачного пути. */
          const askedCase = caseIdOf(job.args);
          let caseGoalText = null;
          if (askedCase) {
            const found = await sql`
              select id, name, args, expects from user_case
              where id = ${askedCase} and user_id = ${who.id} and deleted_at is null
            `.catch(() => []);
            if (!found.length) {
              await sql`
                update run_queue set state = 'failed', ok = false, finished_at = now(),
                       said = 'the case was deleted between the ask and the run'
                where id = ${job.id}
              `;
              continue;
            }
            const expects = Array.isArray(found[0].expects) ? found[0].expects : [];
            if (!expects.length) {
              await sql`
                update run_queue set state = 'failed', ok = false, finished_at = now(),
                       said = 'this case has no checks, so there is nothing it could prove'
                where id = ${job.id}
              `;
              continue;
            }
            const skill = { ...payload, id: row.client_id, name: row.name, params: payload.params || [] };
            const values = stripCase({ ...(found[0].args || {}), ...args });
            const missing = missingParams(skill, values);
            if (missing.length) {
              await sql`
                update run_queue set state = 'failed', ok = false, finished_at = now(),
                       said = ${`this case needs ${missing.join(', ')}, and neither it nor the ask carried `
                         + (missing.length === 1 ? 'it' : 'them')}
                where id = ${job.id}
              `;
              continue;
            }
            caseGoalText = caseGoal(fillGoal(skill, values), expects);
          }
          return res.status(200).json({
            ok: true,
            job: {
              id: job.id,
              toolName: job.tool_name,
              /* Служебный ключ до навыка не доезжает: он про кейс, а не про параметры навыка. */
              args: stripCase(args),
              body: null,
              activate: null,
              goal: row.kind === 'created',
              /* Кейс - двумя полями: id, чтобы прогон записался под ним, и готовая цель с проверками. */
              caseId: askedCase || null,
              caseGoal: caseGoalText,
              flow: {
                id: row.client_id, source: row.source, kind: row.kind, name: row.name,
                description: row.description, payload, origins: row.origins || [],
              },
            },
          });
        }
        if (row.kind !== 'created' && Array.isArray(payload.events) && payload.events.length) {
          const allowed = [0.5, 1, 1.5, 2, 4];
          const asked = Number(args.speed);
          body = flowBody(
            [{
              recordingId: row.client_id,
              repeat: Math.min(999, Math.max(1, Math.round(Number(args.repeat) || 1))),
              speed: allowed.includes(asked) ? asked : 1,
              delayAfterMs: 0,
            }],
            [{ id: row.client_id, name: row.name, events: payload.events, windows: payload.windows || [] }],
            { startDelayMs: 0, flowRepeat: 1, flowForever: false },
          );
          /* The window it was recorded in, as the instruction that raises it - the same thing the Record
           * page sends before it plays a row, for the same reason: a replay is coordinates and has no idea
           * what is under them. */
          const front = Array.isArray(payload.windows) ? payload.windows[0] : null;
          if (front && (front.title || front.process)) {
            activate = `action=activate ${front.process ? `process=${front.process} ` : ''}`
              + `${front.title ? `title=${front.title}` : ''}`.trim();
          }
        }

        return res.status(200).json({
          ok: true,
          job: {
            id: job.id,
            toolName: job.tool_name,
            args,
            /* Both shapes, because there are two kinds of claimer. The agent reads `body` and `activate` and
             * needs nothing else; the worker reads `flow`, which it needs for a goal skill. */
            body,
            activate: activate ? activate.trim() : null,
            /* Whether this needs a model in the loop. The agent reads it to know that `body` will be null
             * and that it should start stepping instead; the worker already knows from `flow.kind`. */
            goal: row.kind === 'created',
            flow: {
              id: row.client_id, source: row.source, kind: row.kind, name: row.name,
              description: row.description, payload: row.payload, origins: row.origins,
            },
          },
        });
      }
      if (Date.now() >= until) return res.status(200).json({ ok: true, job: null });
      await new Promise((done) => setTimeout(done, CLAIM_POLL_MS));
    }
  }

  /* ------------------------------------------------------------------ one turn of a goal
   *
   * A goal skill is a model deciding one action at a time from a screenshot. Until now that loop could only
   * run on the user's own machine, in a node process they had to install alongside the agent, for one
   * reason: it talked to 127.0.0.1. This is the same loop with the machine at the other end of a request.
   *
   *   agent  ──POST ?worker=step { id, shot, windows, results, caps }──►  here
   *                                                                 the model decides (~7s)
   *   agent  ◄──────────────  { actions: [...] }  ──────────────
   *          performs them, takes a new picture, posts again
   *
   * One request per step, and nothing reconnects between steps because there is no gap between them: the
   * reply to step n is what produces step n+1. The state lives in the row (run_queue.loop), never in this
   * function's memory - the instance that decided step 4 may not be the one that decides step 5.
   */
  if (action === 'step') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST' });
    const body = req.body || {};
    const id = String(body.id || '');
    const [job] = await sql`
      select id, flow_id, tool_name, args, state, loop, claimed_at, schedule_id
      from run_queue where id = ${id} and user_id = ${who.id}
    `;
    const fail = async (why) => {
      await sql`
        update run_queue set state = 'failed', ok = false, said = ${why}, finished_at = now(), loop = null
        where id = ${id} and user_id = ${who.id}
      `;
      return res.status(200).json({ ok: true, done: true, outcome: { ok: false, said: why } });
    };

    /* The account's log, written here rather than by the machine - the same reason a stopped recording is
     * turned into a row here: everything the machine would otherwise have to learn already exists on this
     * side. Best effort, and reported: a run whose outcome never reached the log makes the dashboard wrong,
     * but it is not a reason to lose the answer somebody is waiting for. */
    const logRun = async (state, outcome, said, error) => {
      try {
        await sql`
          insert into user_run
            (user_id, client_id, kind, goal, model, flow_id, outcome, summary, error,
             steps, said, extension, started_at, finished_at, checks, case_id)
          values
            (${who.id}, ${job.id}, 'agent', ${String(state.goal || '').slice(0, GOAL_MAX)},
             ${String(state.model || '').slice(0, 60)}, ${String(job.flow_id).slice(0, 80)},
             ${outcome}, ${said ? String(said).slice(0, 2000) : null},
             ${error ? String(error).slice(0, 2000) : null},
             ${JSON.stringify(state.steps || [])}, ${JSON.stringify(state.said || [])},
             /* The loop's own stamp, never claimed_at: that one is moved on by every step, so a
              * three-minute run would be logged with the duration of its last one. */
             'cloud', ${state.startedAt || job.claimed_at || null}, now(),
             /* Считается из шагов ЗДЕСЬ же, одной функцией с браузерным драйвером: два счёта «сколько
              * проверок прошло» однажды разойдутся. Null у прогона, который ничего не утверждал. */
             ${checksOf(state.steps) ? JSON.stringify(checksOf(state.steps)) : null},
             /* ПОД КАКИМ КЕЙСОМ ЭТО СЧИТАТЬ - из аргументов работы, а не из состояния цикла: id кейса едет
              * в строке очереди, и он там на каждом шаге, включая тот, на котором прогон остановили. Сам
              * вердикт не пишется - он считается из outcome и checks одной функцией (api/_case.mjs), и
              * сохранённый вердикт при изменённом правиле его чтения - это способ получить отчёт, который
              * спорит сам с собой. */
             ${caseIdOf(job.args)})
          on conflict (user_id, client_id) do update set
            outcome = excluded.outcome, summary = excluded.summary, error = excluded.error,
            steps = excluded.steps, said = excluded.said, finished_at = excluded.finished_at,
            checks = excluded.checks, case_id = excluded.case_id
        `;
      } catch (err) {
        await report(err, req, { route: 'mcp:step:log' });
      }
    };

    /* Gone, or cancelled while it ran. Not an error: the cancellation is what somebody asked for, and the
     * machine's job is to stop, which it cannot do unless it is told. */
    if (!job) return res.status(200).json({ ok: true, done: true, stop: 'gone' });
    if (job.state !== 'claimed') {
      /* Told to stop, tidied up, and RECORDED. The conversation is only worth keeping while there is a next
       * step to take - a cancelled job that kept one would leave tens of kilobytes in the queue for as long
       * as the row lives - but a run somebody stopped part-way is still work that happened on their
       * computer, and the Hours screen and the assistant are built from those rows. The worker path has
       * always logged it; this one used to let a cancelled run vanish. */
      if (job.loop) {
        await logRun(job.loop, 'stopped', null, `stopped after ${job.loop.stepNo || 0} steps`);
        await sql`update run_queue set loop = null where id = ${id} and user_id = ${who.id}`;
      }
      return res.status(200).json({ ok: true, done: true, stop: job.state });
    }

    let loop = job.loop;
    if (!loop) {
      /* The first request of a run: work out what is being carried out, and start the conversation.
       *
       * Deliberately not a separate "begin" call. The agent has just claimed the job and taken a picture;
       * one shape of request for every step is one thing for it to implement and one thing to get right. */
      const flow = await sql`
        select client_id, kind, name, payload from user_flow
        where user_id = ${who.id} and client_id = ${job.flow_id} and deleted_at is null
      `;
      if (!flow.length) return fail('the skill was deleted between the ask and the run');
      const row = flow[0];
      if (row.kind !== 'created') return fail('this skill is a recording, not a goal - it is replayed, not decided');

      const payload = row.payload || {};
      const skill = { ...payload, id: row.client_id, name: row.name, params: payload.params || [] };
      /* КЕЙС ЧИТАЕТСЯ СЕЙЧАС, А НЕ БЕРЁТСЯ ИЗ СТРОКИ ОЧЕРЕДИ. В args работы лежит только его id: и
       * утверждения, и значения параметров живут на кейсе, поэтому кейс, отредактированный утром, ночью
       * проверяется в новой редакции - а не в той, что скопировали при постановке расписания месяц назад.
       * Забор тот же, что у удалённого скилла: сказать словами, а не упасть. */
      const askedCase = caseIdOf(job.args);
      let expects = null;
      let caseArgs = null;
      if (askedCase) {
        const found = await sql`
          select id, name, args, expects from user_case
          where id = ${askedCase} and user_id = ${who.id} and deleted_at is null
        `.catch(() => []);
        if (!found.length) return fail('the case was deleted between the ask and the run');
        expects = Array.isArray(found[0].expects) ? found[0].expects : [];
        if (!expects.length) return fail('this case has no checks, so there is nothing it could prove');
        caseArgs = found[0].args && typeof found[0].args === 'object' ? found[0].args : {};
      }
      /* АРГУМЕНТЫ СКИЛЛА - БЕЗ СЛУЖЕБНЫХ КЛЮЧЕЙ. У кейса они свои и приезжают из его строки; присланное с
       * работой перекрывает их, чтобы «прогони этот кейс, но для Ann» осталось возможным. Скилл про кейсы
       * не знает и знать не должен: `__case` снимается здесь, потому что тем же объектом кормится агент
       * при реплее записи. */
      const args = stripCase({ ...(caseArgs || {}), ...(job.args || {}) });
      /* missingParams first, as its own comment instructs: fillGoal substitutes an empty string for
       * anything it cannot resolve, so calling it alone turns a missing argument into a goal with a hole in
       * it and a run that does something almost right. */
      const missing = missingParams(skill, args);
      if (missing.length) {
        return fail(`This skill needs ${missing.join(', ')}. Ask the user for the missing value rather than `
          + 'guessing one: the goal is carried out on their real computer and cannot be undone from here.');
      }
      const filled = fillGoal(skill, args);
      if (!filled || !filled.trim()) return fail('This skill has no goal text to carry out.');
      /* Цель кейса - цель скилла плюс его проверки, составленные там же, где считается вердикт: одни слова
       * на оба драйвера, когда второй до них дойдёт. Без кейса возвращает цель как есть. */
      const goal = caseGoal(filled, expects);

      /* Resolved once, here, so every step of one run is decided by one model. A model changed mid-run
       * would hand the task between two that never saw each other's reasoning. */
      const settings = await readSettings(sql).catch(() => ({}));
      const wanted = settings['model.desktop'];
      const model = wanted && ALLOWED_MODELS.has(wanted) ? wanted : [...ALLOWED_MODELS][0];
      /* What the author said done looks like, carried from the skill into the run. Null when they said
       * nothing, which is most skills and is fine - the loop simply does not mention it. */
      /* WHAT THIS ACCOUNT DID JUST BEFORE, so that "now do X with the thing we just made" has something to
       * point at. Its own account only - never anybody else's - and composed in the brain so both drivers
       * say it identically. `catch(() => null)` on purpose: background is worth a query and never worth
       * failing a run over. */
      const before = await sql`
        select goal, outcome, summary, error, steps, started_at, finished_at
        from user_run
        where user_id = ${who.id} and deleted_at is null and kind = 'agent'
        order by started_at desc nulls last limit ${EARLIER_RUNS}
      `.catch(() => null);
      const earlier = earlierRuns((before || []).map((r) => ({
        goal: r.goal,
        outcome: r.outcome,
        summary: r.summary,
        error: r.error,
        steps: r.steps,
        startedAt: r.started_at,
        finishedAt: r.finished_at,
      })));
      /* ЗОНА ЧЕЛОВЕКА, чтобы цикл мог сказать модели, который час, - и чтобы «в 19:41» в цели значило его
       * 19:41, а не UTC. Сервер её не знает; берётся у расписания, которое этот прогон поставило, иначе из
       * настроек аккаунта (страница Skills и тул расписания записывают туда зону, которую прислал браузер).
       * Ничего нет - часы честно говорят UTC, и это сказано в строке. Фон, а не условие: не нашлось -
       * прогон идёт. */
      const zone = await (async () => {
        try {
          if (job.schedule_id) {
            const [sch] = await sql`select zone from user_schedule where id = ${job.schedule_id} and user_id = ${who.id}`;
            if (sch && sch.zone) return sch.zone;
          }
          const [pref] = await sql`select value from user_pref where user_id = ${who.id} and key = 'zone'`;
          return (pref && pref.value) || null;
        } catch (_) { return null; }
      })();
      loop = startLoop({ goal, model, success: payload.success || null, earlier, zone });
      /* Who is driving. A worker runs the loop itself and never writes here; recorded so that a machine
       * with both cannot end up driving one mouse twice. */
      await sql`update run_queue set stepping = true where id = ${id} and user_id = ${who.id}`;
    }

    /* ПОТОЛОК НА ОБЩИЙ КЛЮЧ - и это был самый дорогой маршрут без него.
     *
     * advance() зовёт callModel с ANTHROPIC_API_KEY развёртывания, по 8000 токенов на вызов, и прогон это
     * до 240 таких подряд. Остальные тратящие маршруты считали вызовы на аккаунт; здесь не считал никто, и
     * подписаться мог любой Google-аккаунт без единого платежа.
     *
     * Пятнадцать в минуту - примерно вдвое быстрее, чем настоящий прогон может идти (ход занимает секунд
     * восемь), так что живая работа этого не почувствует, а зациклившаяся перестанет стоить денег в
     * пределах минуты.
     *
     * Прогон при этом ЗАКАНЧИВАЕТСЯ, а не висит: очередь освобождается, строка пишется в лог как неудача с
     * причиной, которую человек может прочитать. Оставить его claimed значило бы, что упёршийся в потолок
     * прогон занимает место до самой уборки устаревших. */
    const budget = await overSpend(sql, who.id, 'step');
    if (!budget.ok) {
      /* Через тот же fail(), что и всякая другая неудача этого маршрута, а не своим путём: он помечает
       * строку failed с причиной, обнуляет loop и отвечает в форме, которую агент уже умеет читать.
       * Собственная уборка здесь была бы третьей версией того же самого - и первой, про которую забудут. */
      return fail(spentWhy(budget, 'runs'));
    }

    /* КАДР, КОТОРЫЙ РЕШИЛ ЦИКЛ. Он не знает ни про базу, ни про то, где живут картинки - и не должен: его
     * гоняет набор тестов без сети. Он говорит «оставь этот кадр, вот под каким именем», а картинка есть
     * здесь, в теле запроса, и больше нигде.
     *
     * Best effort целиком: потерянная картинка это потерянная картинка, а прогон - работа на чьём-то
     * компьютере, и валить его из-за неё было бы обменом ценного на удобное. */
    const keepFrame = async (keep) => {
      if (!keep || !body.shot || !body.shot.png) return;
      try {
        if (tooBig(body.shot.png)) return;
        const have = await sql`
          select id, kind, step_no from run_artifact where user_id = ${who.id} and run_id = ${id}
        `;
        const drop = dropWhich(have, 1);
        if (drop.length) {
          await sql`delete from run_artifact where user_id = ${who.id} and id = any(${drop})`;
        }
        await sql`
          insert into run_artifact (id, user_id, run_id, step_no, kind, mime, w, h, bytes, said)
          values (${artifactId()}, ${who.id}, ${id}, ${Math.max(0, Math.round(Number(keep.stepNo) || 0))},
                  ${keep.kind}, ${String(body.shot.format || 'image/jpeg')},
                  ${Number(body.shot.w) || null}, ${Number(body.shot.h) || null},
                  ${String(body.shot.png)}, ${String(keep.said || '').slice(0, 2000) || null})
        `;
        await sql`
          delete from run_artifact
          where user_id = ${who.id} and created_at < now() - ${`${ARTIFACT_KEEP_DAYS} days`}::interval
        `;
      } catch (_) {
        /* Миграции может не быть на этом деплое - тогда картинок просто нет, а прогоны работают полностью.
         * Молча, потому что сказать здесь некому: это ответ машине, а не человеку. */
      }
    };

    /* ВОЗМОЖНОСТИ МАШИНЫ - те, что агент прислал с этим шагом, и ничего вместо них.
     *
     * Плоский объект флагов из его же /health. Пустой у любого агента, который о них не говорит, и это
     * правильный ответ для такого: инструмент, которого он не умеет, стоит хода - модель его зовёт, агент
     * отвечает "unknown action", и пять секунд ушли на то, чтобы узнать про чужую машину. */
    const out = await advance({
      loop, shot: body.shot, windows: body.windows, results: body.results,
      caps: body.caps && typeof body.caps === 'object' ? body.caps : null,
    });
    await keepFrame(out.keep || (out.done && out.done.keep));

    /* ОТЛОЖЕНО, А НЕ СДЕЛАНО. Цель назвала время впереди, и модель вместо таймера из PowerShell позвала
     * defer_until. Прогон становится разовым расписанием на этот момент - с тем же flow_id, tool_name и
     * args, чтобы в назначенный час dueNow() поставил обычную строку очереди, - а эта строка закрывается и
     * отпускает мышь. В журнал прогонов не пишется: прогона не было, и зелёная строка о нём была бы ложью
     * того самого вида, против которого написан весь цикл. */
    if (out.done && out.done.deferred) {
      const when = out.done.deferred;
      const at = new Date(when.at);
      const [named] = await sql`
        select name from user_flow where user_id = ${who.id} and client_id = ${job.flow_id} and deleted_at is null
      `.catch(() => []);
      const sid = scheduleId();
      let said;
      try {
        await sql`
          insert into user_schedule (
            id, user_id, flow_id, tool_name, args, label, kind, zone, next_at, last_at, last_said
          ) values (
            ${sid}, ${who.id}, ${job.flow_id}, ${job.tool_name}, ${JSON.stringify(job.args || {})},
            ${String((named && named.name) || when.then || '').slice(0, 80)}, 'once', ${when.zone},
            ${at.toISOString()}, now(), ${'set aside by a run that was asked to wait until then'}
          )
        `;
        said = `Set aside until ${whenSaid(at.getTime(), when.zone)} (${sid}). It runs then, if this `
          + 'machine is awake and taking work; the time passing with nothing listening is recorded as missed.';
      } catch (err) {
        /* Таблицы может не быть - миграция не применена. Сказать это, а не изобразить зелёный прогон. */
        said = `The goal asked to wait until ${whenSaid(at.getTime(), when.zone)}, but this deployment cannot `
          + `schedule it: ${/user_schedule/.test(String(err.message)) ? 'db/018_user_schedule.sql is not applied' : err.message}. `
          + 'Nothing was done.';
        await sql`
          update run_queue set state = 'failed', ok = false, said = ${said}, finished_at = now(), loop = null
          where id = ${id} and user_id = ${who.id} and state = 'claimed'
        `;
        return res.status(200).json({ ok: true, done: true, outcome: { ok: false, said } });
      }
      /* И В ЖУРНАЛ ПРОГОНОВ - с единственным шагом, которым этот прогон и был.
       *
       * Сначала здесь не писалось ничего: «прогона не было». Это неверно - прогон был: модель получила
       * снимок, приняла решение и стоила за него денег, - а человек, у которого в истории пусто, не может
       * узнать, ЧТО было решено. `ok`, потому что прогон закончился тем, чем должен был; выдачей
       * недостигнутой цели за успех это не становится, так как summary начинается с «Set aside until …». */
      await logRun({ ...loop, steps: out.done.steps, said: out.done.saidAll }, 'ok', said, null);
      await sql`
        update run_queue set state = 'done', ok = true, said = ${said}, finished_at = now(), loop = null
        where id = ${id} and user_id = ${who.id} and state = 'claimed'
      `;
      return res.status(200).json({ ok: true, done: true, outcome: { ok: true, said } });
    }

    if (out.done) {
      const done = out.done;
      await logRun(
        { ...loop, steps: done.steps, said: done.saidAll },
        done.ok ? 'ok' : 'failed', done.said, done.error,
      );

      const took = (done.steps || []).length;
      const said = done.ok
        ? `${done.said || 'Done.'} (${took} action${took === 1 ? '' : 's'})`
        : `The run did not finish: ${done.error}. It took ${took} action${took === 1 ? '' : 's'}.`;
      await sql`
        update run_queue set state = ${done.ok ? 'done' : 'failed'}, ok = ${done.ok}, said = ${said},
               finished_at = now(), loop = null
        where id = ${id} and user_id = ${who.id} and state = 'claimed'
      `;
      return res.status(200).json({ ok: true, done: true, outcome: { ok: done.ok, said } });
    }

    /* Still going. `claimed_at` is moved on with every step, so the staleness sweep at the top of ?claim
     * measures time since the machine was last heard from rather than time since it took the job. */
    await sql`
      update run_queue set loop = ${JSON.stringify(out.loop)}, claimed_at = now()
      where id = ${id} and user_id = ${who.id} and state = 'claimed'
    `;
    if (out.shrink) return res.status(200).json({ ok: true, shrink: out.shrink });
    return res.status(200).json({
      ok: true, step: out.step, shotWidth: out.shotWidth, actions: out.actions,
    });
  }

  if (action === 'report') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST' });
    const body = req.body || {};
    const id = String(body.id || '');
    let ok = body.ok === true;
    let said = body.said == null ? null : String(body.said).slice(0, 4000);

    /* A stopped recording arrives as the five-column body the agent hands back, and turning it into a row
     * happens HERE rather than on the machine.
     *
     * That is the whole point of doing it this way: the agent can then be the thing that claims the job, and
     * an agent is a small program that speaks its own format and knows nothing about accounts, payload
     * shapes or flow ids. Everything it would otherwise have to learn - parseMacro, flowFor, the stamp that
     * says this row is a recording - already exists here, in one copy, shared with the app. */
    if (body.body != null) {
      const [job] = await sql`select flow_id from run_queue where id = ${id} and user_id = ${who.id}`;
      if (job && job.flow_id === '#record.stop') {
        const saved = await saveRecording(sql, who, String(body.body), body.health || null);
        ok = saved.ok;
        said = saved.said;
      }
    }

    const done = await sql`
      update run_queue set state = ${ok ? 'done' : 'failed'}, ok = ${ok}, said = ${said},
             finished_at = now()
      where id = ${id} and user_id = ${who.id} and state = 'claimed'
      returning id
    `;
    /* ИСХОД ВОЗВРАЩАЕТСЯ РАСПИСАНИЮ, если прогон завёлся им.
     *
     * Иначе расписание, чей скилл перестал работать, будет запускать его каждый час вечно - и у целевого
     * скилла каждый такой запуск это ещё один платный вызов модели. Три неудачи подряд останавливают его
     * самого, с причиной; удачный прогон обнуляет счёт, потому что «три подряд» - это про подряд.
     *
     * Отдельным запросом и после основного: отчёт о прогоне обязан записаться, даже если расписание за это
     * время удалили, а таблицы может не быть вовсе на деплое без миграции. */
    if (done.length === 1) {
      try {
        const [job] = await sql`select schedule_id from run_queue where id = ${id}`;
        if (job && job.schedule_id) {
          if (ok) {
            await sql`
              update user_schedule set fails = 0, last_at = now(),
                     last_said = ${`ran - ${(said || 'done').slice(0, 200)}`}, updated_at = now()
              where id = ${job.schedule_id} and user_id = ${who.id}
            `;
          } else {
            await sql`
              update user_schedule
              set fails = fails + 1, last_at = now(),
                  last_said = ${`failed - ${(said || 'no reason given').slice(0, 200)}`},
                  paused = (fails + 1 >= ${FAILS_BEFORE_PAUSE}),
                  paused_why = case when fails + 1 >= ${FAILS_BEFORE_PAUSE}
                    then ${`stopped after ${FAILS_BEFORE_PAUSE} failures in a row`} else paused_why end,
                  updated_at = now()
              where id = ${job.schedule_id} and user_id = ${who.id}
            `;
          }
        }
      } catch (_) { /* см. выше: отчёт уже записан, и это важнее */ }
    }

    /* A job cancelled while it ran is not 'claimed' any more, so nothing is updated - and that is the right
     * answer, not an error: the cancellation is what the person asked for and it stands. */
    return res.status(200).json({ ok: true, recorded: done.length === 1 });
  }

  /* An agent saying it fell over.
   *
   * It goes through here rather than to Sentry directly, and that is the whole design: the agent already
   * dials this endpoint with a device token, so it needs no DSN of its own - one less secret inside a
   * program people download - and what arrives is already attached to an account and a machine. The cost is
   * stated plainly: a crash whose cause is "cannot reach the deployment" cannot arrive this way, and stays
   * in the agent's own log where it always was.
   *
   * Nothing here can fail the caller. An agent that has just crashed is not helped by a 500.
   */
  if (action === 'crash') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST' });
    const body = req.body || {};
    let sent = false;
    try {
      sent = await reportSaid({
        type: body.type,
        message: body.message,
        stack: body.stack,
        level: body.level,
        tags: {
          route: 'agent',
          /* Which agent, and which build of it. A crash that only happens on one platform or after one
           * release is the common case, and without these every report reads as "the agent broke". */
          platform: String(body.platform || 'unknown').slice(0, 20),
          version: String(body.version || 'unknown').slice(0, 20),
        },
        /* Тот, кому принадлежит машина - id и только id. Абзац выше обосновывает весь этот маршрут
         * тем, что приходящее «уже привязано к аккаунту и машине»: привязка была в рассуждении и не была
         * в событии, так что в Sentry все краши всех агентов лежали одной кучей. */
        user: { id: who.id },
        extra: { where: String(body.where || '').slice(0, 200) },
      });
    } catch (_) {
      sent = false;
    }
    /* `reported` is the truth, not a courtesy: a deployment with no DSN configured accepts this and sends
     * nothing, and an agent that was told "ok" either way could never tell that apart from a working one. */
    return res.status(200).json({ ok: true, reported: sent });
  }

  if (action === 'state') {
    const id = String((req.query && req.query.id) || '');
    const rows = await sql`select state from run_queue where id = ${id} and user_id = ${who.id}`;
    return res.status(200).json({ ok: true, state: rows.length ? rows[0].state : 'gone' });
  }

  return res.status(400).json({ error: `no worker action "${action}"` });
}

