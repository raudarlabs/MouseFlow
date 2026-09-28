/* Одна просьба в очередь, с кукой страницы - и один вопрос «чем кончилось».
 *
 *   POST /api/queue        { goal: "..." }   -> { ok: true, id: "q_..." }
 *   POST /api/queue        { skill: "id", arguments? } -> то же, для сохранённого скилла (экран Skills в P1)
 *   GET  /api/queue?id=q_… -> { ok: true, state, done, good, said }
 *
 * ЗАЧЕМ ОТДЕЛЬНАЯ ДВЕРЬ. Та же причина, что у schedules.js, cases.js и memory.js: читает и пишет
 * СЕССИОННАЯ КУКА, а не токен устройства и не OAuth-доступ MCP. `whoIsCalling` - единственное, что решает,
 * чей это аккаунт, и одна проверка прав на три разных предъявителя это три мнения об одном вопросе. А
 * api/mcp.js и без того самый большой файл проекта - его только что разрезали надвое (SPLIT-PLAN §4.2),
 * и дописывать в него страничные глаголы значило бы начать сшивать обратно.
 *
 * ЗАЧЕМ ОНА ВООБЩЕ ПОНАДОБИЛАСЬ. У страницы Create прогон идёт МИМО очереди: браузер сам говорит с
 * агентом по локальной сети и сам ведёт цикл. Это верно для вкладки, которую человек держит открытой, и
 * неверно для панели, которую он закрывает через секунду после того, как сказал, что сделать
 * (SPLIT-PLAN §7, шаг 16). Работа, положенная в очередь, переживает окно: машина забирает её сама тем же
 * `?worker=claim`, и закрытая панель ничего не отменяет.
 *
 * ПОЧЕМУ ЗДЕСЬ НЕТ НИ ПЛАНА, НИ ОДОБРЕНИЯ. План строится в браузере (web/src/lib/plan.ts зовёт
 * /api/claude), одобряет человек глазами, и только одобренное доезжает сюда. Эта дверь - последний шаг, а
 * не диалог: у неё ровно одна обязанность, и та уже написана в api/_queue.mjs вместе с обоими отказами.
 */
import { neon } from '@neondatabase/serverless';

import { whoIsCalling } from './_session.js';
import { report, wrap } from './_report.js';
import { cors } from './_cors.mjs';
import { GOAL_MAX } from './_brain.mjs';
import { DESKTOP_GOAL, queueOne } from './_queue.mjs';
import { ONE_WAY } from './_brain.mjs';
import { missingParams } from '../extension/skills.js';
/* Слова ответа - те же, что уезжают из телеграма: модель читает их как указание, и две редакции одного
 * указания однажды скажут разное. */
import { HOLD_GO as GO, HOLD_HALT as HALT } from './_telegram.mjs';

const fail = (res, status, message) =>
  res.status(status).json({ ok: false, error: { type: 'queue_error', message } });

const ID = /^[A-Za-z0-9_.:-]{1,80}$/;

/* Где лежит выбор. В user_pref, а не на аккаунте отдельной колонкой: это предпочтение человека, а не факт
 * о нём, и таблица предпочтений для этого и есть. Ключ с точкой - как `worker.seen` и `model.desktop`. */
const MODE_KEY = 'gate.mode';

/** Что выбрано. Отсутствие строки - автомат, и отсутствие ТАБЛИЦЫ тоже: absent не значит «включить». */
async function modeOf(sql, userId) {
  try {
    const [row] = await sql`select value from user_pref where user_id = ${userId} and key = ${MODE_KEY}`;
    return row && row.value === ONE_WAY ? ONE_WAY : 'auto';
  } catch (_) {
    return 'auto';
  }
}

async function handler(req, res) {
  cors(req, res, 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (!process.env.DATABASE_URL) return fail(res, 503, 'This deployment has no database configured.');

  const sql = neon(process.env.DATABASE_URL);
  let who;
  try {
    who = await whoIsCalling(req, sql);
  } catch (err) {
    await report(err, req, { route: 'queue' });
    return fail(res, 500, `could not check who is calling: ${err.message}`);
  }
  if (!who) return fail(res, 401, 'sign in first');

  try {
    if (req.method === 'GET') {
      const id = String((req.query && req.query.id) || '').trim();
      /* БЕЗ id - ВОПРОС «КАК БУДУТ ИДТИ ПРОГОНЫ», а не «как идёт вот этот». Та же дверь, потому что это
       * один и тот же вопрос с разных сторон: здесь работы ставят, здесь же и спрашивают, чем это
       * кончится. Вторая дверь ради одной строки настроек - это вторая проверка того, чей это аккаунт. */
      if (!id) return res.status(200).json({ ok: true, mode: await modeOf(sql, who.id) });
      if (!ID.test(id)) return fail(res, 400, 'that is not a job id');
      /* ЧУЖОЙ id И НЕСУЩЕСТВУЮЩИЙ ОТВЕЧАЮТ ОДИНАКОВО - как у расписаний и кейсов, и по той же причине:
       * существует ли работа на чужом аккаунте, это не вопрос, на который здесь отвечают. */
      const [job] = await sql`
        select state, ok, said, loop from run_queue where id = ${id} and user_id = ${who.id}
      `;
      if (!job) return fail(res, 404, 'no such job on this account');
      const done = job.state === 'done' || job.state === 'failed' || job.state === 'cancelled';
      /* ОСТАНОВИЛСЯ И СПРАШИВАЕТ (SPLIT-PLAN §7.2, шаг 14b). Читается из цикла, потому что ожидание живёт
       * там: строка всё это время `claimed`, и она И ЕСТЬ занятая - мышь держит этот прогон. Отдаётся
       * только то, что показывают человеку; ответ придёт отдельным POST. */
      const hold = job.loop && job.loop.hold && job.loop.hold.id && !job.loop.hold.answer
        ? { said: String(job.loop.hold.said || ''), since: job.loop.hold.since || null }
        : null;
      return res.status(200).json({
        ok: true,
        state: job.state,
        done,
        holding: hold,
        /* `good`, а не `ok`: у ответа уже есть `ok`, и оно значит «запрос удался», а не «прогон удался».
         * Два разных смысла под одним именем - это ровно тот ложный зелёный, против которого написан
         * весь цикл. */
        good: done ? job.ok === true : null,
        said: job.said || null,
      });
    }

    if (req.method !== 'POST') return fail(res, 405, 'GET or POST');

    const body = req.body && typeof req.body === 'object' ? req.body : {};

    /* ВЫБОР РЕЖИМА - отдельным телом, и он ПОМНИТСЯ на аккаунте. Человек решает это один раз, а не при
     * каждой просьбе: настройка, которую надо подтверждать каждый раз, - это не настройка, а вопрос. */
    if (body.mode !== undefined) {
      const want = body.mode === ONE_WAY ? ONE_WAY : '';
      await sql`
        insert into user_pref (user_id, key, value) values (${who.id}, ${MODE_KEY}, ${want})
        on conflict (user_id, key) do update set value = excluded.value
      `;
      return res.status(200).json({ ok: true, mode: want || 'auto' });
    }

    /* ОТВЕТ ОСТАНОВЛЕННОМУ ПРОГОНУ - тем же POST, потому что это та же работа, и разводить две двери к
     * одной строке значило бы иметь две проверки того, чья она. Разбирается ПЕРВЫМ: у него есть id, а у
     * постановки в очередь его нет и быть не может. */
    if (body.answer !== undefined) {
      const id = String(body.id || '').trim();
      if (!ID.test(id)) return fail(res, 400, 'that is not a job id');
      const go = body.answer === true || body.answer === 'go';
      /* УСЛОВИЕ В САМОМ UPDATE, как и в телеграме: панель может нажать дважды при плохой связи, а второй
       * ответ - это ответ, приехавший уже после того, как прогон пошёл дальше. */
      const [job] = await sql`
        update run_queue
           set loop = jsonb_set(loop, '{hold,answer}', ${JSON.stringify(go ? GO : HALT)}::jsonb)
         where id = ${id} and user_id = ${who.id} and state = 'claimed'
           and loop -> 'hold' ->> 'id' is not null
           and loop -> 'hold' ->> 'answer' is null
         returning id
      `;
      if (!job) return fail(res, 409, 'that run is not waiting any more');
      return res.status(200).json({ ok: true, answered: go ? 'go' : 'halt' });
    }

    /* СОХРАНЁННЫЙ СКИЛЛ - «Run now» с экрана Skills первого продукта (владелец, 2026-09-28: «интерфейс, где
     * их можно легко ставить на повтор»). Та же очередь и те же отказы, что у цели: работа переживает
     * вкладку, машина забирает её сама, прогон ложится в журнал под скиллом. Режим - запомненный, как у цели.
     *
     * ПАРАМЕТРЫ ПРОВЕРЯЮТСЯ ЗДЕСЬ, а не ночью у драйвера: пустое значение подставилось бы дырой в цель, и
     * прогон сделал бы почти то. Отказ называет, чего не хватает, - та же missingParams, что у драйвера. */
    if (body.skill !== undefined) {
      const skillId = String(body.skill || '').trim();
      if (!ID.test(skillId)) return fail(res, 400, 'that is not a skill id');
      const [flow] = await sql`
        select client_id, kind, name, payload from user_flow
        where user_id = ${who.id} and client_id = ${skillId} and deleted_at is null
      `;
      if (!flow) return fail(res, 404, 'no such skill on this account');
      const values = body.arguments && typeof body.arguments === 'object' && !Array.isArray(body.arguments)
        ? body.arguments : {};
      const payload = flow.payload || {};
      const missing = missingParams({ ...payload, params: payload.params || [] }, values);
      if (missing.length) {
        return fail(res, 400, `"${flow.name}" needs ${missing.join(', ')} - fill ${missing.length === 1 ? 'it' : 'them'} in first.`);
      }
      /* Режим едет только к цели: запись проигрывается без модели, и спросить в ней некому. */
      const asked = body.gate === undefined ? await modeOf(sql, who.id) : body.gate;
      const gate = flow.kind === 'created' && asked === ONE_WAY ? ONE_WAY : null;
      const put = await queueOne(sql, who.id, {
        flowId: flow.client_id,
        /* 'page:<имя>' - Logs читает префикс как «you», а не «chat». Не голое 'page': так подписаны живые
         * зеркала прогонов со страницы (api/mcp.js), и их двери трогают строки по этому точному имени. */
        toolName: `page:${flow.name}`.slice(0, 80),
        args: { ...values, ...(gate ? { gate } : {}) },
      });
      if (put.why) return res.status(409).json({ ok: false, error: { type: 'queue_error', message: put.why } });
      return res.status(200).json({ ok: true, id: put.id });
    }

    const goal = String(body.goal || '').trim();
    if (!goal) return fail(res, 400, 'What should it do? Pass the errand as `goal`, in a sentence.');
    /* ОБРЕЗАТЬ МОЛЧА НЕЛЬЗЯ: цель, укороченная по дороге, - это прогон, который сделает почти то, о чём
     * просили, и будет при этом выглядеть нормально. Число одно на все места, из api/_brain.mjs. */
    if (goal.length > GOAL_MAX) {
      return fail(res, 413, `That is ${goal.length - GOAL_MAX} characters over what one goal can hold.`);
    }

    /* Оба отказа - «машины нет» и «машина занята» - живут в queueOne и приезжают готовыми словами. Вторая
     * их редакция здесь была бы инструкцией, которая в одном месте останется верной, а в другом устареет. */
    /* РЕЖИМ ЗАМИРАЕТ В АРГУМЕНТАХ РАБОТЫ, а не читается из настроек на каждом ходу: переключённый на
     * середине прогона он дал бы прогон, про который человек не знает, в каком режиме тот шёл. Умолчание -
     * автомат: неизвестное значение читается как «не сказано», а не как «включить».
     *
     * ЗАПОМНЕННОЕ - ЕСЛИ НЕ СКАЗАЛИ ИНАЧЕ. Явное поле в запросе сильнее настройки: у панели и у бота
     * может быть переключатель «на этот раз», и он обязан значить «на этот раз». */
    const asked = body.gate === undefined ? await modeOf(sql, who.id) : body.gate;
    const gate = asked === ONE_WAY ? ONE_WAY : null;
    const put = await queueOne(sql, who.id, {
      flowId: DESKTOP_GOAL, toolName: 'mouseflow_do', args: { goal, ...(gate ? { gate } : {}) },
    });
    if (put.why) return res.status(409).json({ ok: false, error: { type: 'queue_error', message: put.why } });
    return res.status(200).json({ ok: true, id: put.id });
  } catch (err) {
    await report(err, req, { route: 'queue' });
    return fail(res, 500, err.message);
  }
}

export default wrap(handler, 'queue');
