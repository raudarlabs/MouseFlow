/* MouseFlow over HTTPS, so the decider can be anywhere and still only ever see one account.
 *
 *   POST /api/mcp                    JSON-RPC 2.0. initialize, ping, tools/list, tools/call
 *   GET  /api/mcp                    a sentence for whoever opened the URL in a browser
 *   POST /api/mcp?worker=claim       a worker on somebody's machine takes the next job  (long-polls)
 *   POST /api/mcp?worker=report      ...and says how it went
 *   GET  /api/mcp?worker=state&id=   ...and asks whether it has been cancelled meanwhile
 *   POST /api/mcp?worker=crash       ...and says when it fell over, so the crash is not only in a log file
 *   POST /api/mcp?worker=step        ...or, with no worker at all, an agent carries out a goal one turn
 *                                    at a time: it sends the screen, this decides, it does the action
 *
 * WHY THIS EXISTS BESIDE mcp/server.mjs. That one runs on the user's machine over stdio, which is why it can
 * run anything: the agent listens on loopback and only something on that machine can reach it. It also means
 * one person, one terminal. This is the same tools reachable from Claude on a phone, in a browser, in
 * somebody else's editor - and reachable is the whole problem, because a serverless function cannot dial into
 * anybody's desktop and nothing on the internet should be able to.
 *
 * So the desktop dials out. A tools/call becomes a row in run_queue; a worker on the user's own machine
 * claims it, runs it through the agent it can already reach, and reports back; this waits and answers with
 * what the worker said. The direction of the connection never reverses. A machine with no worker running
 * claims nothing, and the caller is told exactly that rather than left waiting.
 *
 * IDENTITY IS THE POINT. Every request resolves ONE user through whoIsCalling - a session cookie, or the
 * device token the extension already pairs with - and every query filters on that id inside the WHERE
 * clause. There is no route here that takes a user id, and no code path that reads one from the request
 * body. A model-supplied user id is the whole bug class: one hallucinated uuid and this becomes a way to
 * list, or run, somebody else's skills. So the id arrives once, from the credential, and the credential is
 * the only thing that says who anybody is.
 *
 * That is also the answer to "each person in an organisation sees only themselves": each person adds this
 * with their OWN token, and sees their own skills. The one thing to be careful of is a connector installed
 * once for a whole organisation with a single shared header - everyone on it would share one account, which
 * is not multi-tenancy, it is one tenant with many users. The fix for that is OAuth, so the connector
 * identifies the person rather than the installation; the 401 below already advertises where that will live
 * (RFC 9728), and until it exists this is per-person-token.
 *
 * WHAT IT CANNOT SEE. The local agent. Whether it is running, what version, whether a replay is playing -
 * all of that is loopback and this is not on that machine. `mouseflow_status` reports what the ACCOUNT
 * knows and says plainly which half it cannot see, rather than guessing.
 */

import { neon } from '@neondatabase/serverless';
import { randomUUID } from 'node:crypto';
import { whoIsCalling } from './_session.js';
import { wrap } from './_report.js';
import { scheduleId } from './_queue.mjs';
import { cors } from './_cors.mjs';
import {
  SPOKEN, NEWEST, SERVER, unauthorized, rpc, rpcError, say, callTool, STATUS_TOOL, STOP_TOOL, RUN_STATUS_TOOL, START_TOOL, STOP_RECORDING_TOOL, DO_TOOL, HELP_TOOL, SCHEDULE_TOOL, SCHEDULES_TOOL, UNSCHEDULE_TOOL, RUN_TOOL, READ_TOOLS, CASE_TOOL, CASES_TOOL, CASE_RESULTS_TOOL,
} from './_mcp-tools.mjs';
import { workerRoute } from './_mcp-worker.mjs';

/* ------------------------------------------------------------------------------- the route */

async function handler(req, res) {
  cors(req, res, 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  /* Whoever opened this in a browser. Deliberately answerable without a token: it says nothing about
   * anybody and saves a person guessing why a URL returns 401.
   *
   * Every OTHER GET has to be excluded by name, and that is a sharp edge worth stating: this branch runs
   * before authentication, so any query it does not know about is answered with a document about the server
   * instead of the thing that was asked for. `?pending=1` fell into it and returned `{name, version}` - no
   * error, no 401, just the wrong answer - and the banner that reads `waiting` from it silently never
   * appeared. A route that swallows unknown queries fails exactly like this: quietly, and looking fine. */
  const aGetForSomethingElse = req.query && (req.query.worker || req.query.pending || req.query.live
    || req.query.cancel);
  if (req.method === 'GET' && !aGetForSomethingElse) {
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'mouseflowapp.vercel.app';
    res.status(200).json({
      name: SERVER.name,
      version: SERVER.version,
      protocol: 'MCP over HTTP POST, JSON-RPC 2.0',
      /* Both ways in, and the one to prefer first. This said "Bearer <device token>" alone for as long as
       * a device token was the only answer, and went on saying it after OAuth landed - which is how a
       * document about a server starts describing a server that no longer exists. */
      auth: 'Add this URL to your client and sign in with your MouseFlow account (OAuth), or send '
        + 'Authorization: Bearer <device token> from Settings → My account',
      note: 'Reading works the moment you connect. Recording and running a skill need a computer attached '
        + 'to the account — in the app: Connections → "Let Claude drive this computer".',
      docs: `https://${host}/mcp`,
    });
    return;
  }

  if (!process.env.DATABASE_URL) {
    res.status(503).json({ error: 'This deployment has no database configured.' });
    return;
  }
  const sql = neon(process.env.DATABASE_URL);

  let who;
  try {
    who = await whoIsCalling(req, sql);
  } catch (_) {
    who = null;
  }
  if (!who) return unauthorized(req, res);

  /* "Is anything waiting for a machine?" - asked by the app, answered without a job id.
   *
   * The app is the only place a person can say yes, and it cannot offer to unless it knows there is
   * something to say yes TO. Without this the failure is silent in the one window that could fix it: a
   * command sits in a queue, the chat says nothing picked it up, and the app - open on the same screen -
   * shows an ordinary Record page. */
  if (req.method === 'GET' && req.query && req.query.pending) {
    const rows = await sql`
      select id, tool_name, created_at from run_queue
      where user_id = ${who.id} and state = 'queued'
      order by created_at limit 5
    `;
    res.status(200).json({
      ok: true,
      waiting: rows.length,
      oldest: rows.length ? rows[0].created_at : null,
      tools: rows.map((r) => r.tool_name).filter(Boolean),
    });
    return;
  }

  /* «ЧТО МАШИНА ДЕЛАЕТ САМА» - спрашивает приложение, открытое на том же экране.
   *
   * Прогон по расписанию ведёт агент через ?worker=step, и страница Create о нём не знает ничего: в 20:10
   * Outlook открылся и закрылся, а в приложении - ни ленты шагов, ни объявления, ни строки в истории до
   * перезагрузки. Человек прочитал это как «сделал молча». Этот ответ - то, чем страница узнаёт о прогонах,
   * которых не начинала: что идёт сейчас (шаги - из loop, где облачный цикл их держит между ходами) и что
   * закончилось только что (шаги - из user_run, потому что loop у законченного обнулён). Три минуты назад -
   * чтобы окончание, случившееся между двумя опросами, не пропало. Только строки этого человека. */
  if (req.method === 'GET' && req.query && req.query.live) {
    /* `days` - окно ИСТОРИИ очереди, для страницы Activity. Без него - три минуты, для живой ленты на Create.
     *
     * Зачем странице очередь, если у неё есть журнал прогонов: в журнал попадает только то, что БЫЛО. Работа,
     * отменённая до того, как машина её взяла, или упавшая на заборе («скилл удалён между просьбой и
     * взятием»), прогоном не становится и в user_run не пишется - а человек, глядя на «что стало с моей
     * просьбой из чата», обязан увидеть и это. Тридцать суток - потолок, потому что строки очереди чистятся
     * не так, как журнал, и лента из тысячи отменённых никому не нужна. */
    const days = Math.min(30, Math.max(0, Math.round(Number(req.query.days) || 0)));
    const rows = days
      ? await sql`
        select q.id, q.flow_id, q.tool_name, q.state, q.ok, q.said, q.loop, q.schedule_id,
               q.created_at, q.claimed_at, q.finished_at,
               f.name as flow_name, r.steps as run_steps, r.goal as run_goal, r.started_at as run_started
        from run_queue q
        left join user_flow f on f.user_id = q.user_id and f.client_id = q.flow_id
        left join user_run r on r.user_id = q.user_id and r.client_id = q.id
        where q.user_id = ${who.id}
          and (q.state in ('queued', 'claimed') or q.finished_at > now() - ${`${days} days`}::interval)
        order by q.created_at desc limit 200
      `
      : await sql`
        select q.id, q.flow_id, q.tool_name, q.state, q.ok, q.said, q.loop, q.schedule_id,
               q.created_at, q.claimed_at, q.finished_at,
               f.name as flow_name, r.steps as run_steps, r.goal as run_goal, r.started_at as run_started
        from run_queue q
        left join user_flow f on f.user_id = q.user_id and f.client_id = q.flow_id
        left join user_run r on r.user_id = q.user_id and r.client_id = q.id
        where q.user_id = ${who.id}
          and (q.state in ('queued', 'claimed') or q.finished_at > now() - interval '3 minutes')
        order by q.created_at desc limit 5
      `;
    res.status(200).json({
      ok: true,
      jobs: rows.map((q) => {
        const loop = q.loop && typeof q.loop === 'object' ? q.loop : null;
        return {
          id: q.id,
          state: q.state,
          ok: q.ok,
          said: q.said || null,
          name: q.flow_name || q.tool_name || q.flow_id,
          goal: (loop && loop.goal) || q.run_goal || null,
          scheduleId: q.schedule_id || null,
          /* Откуда работа: расписание, страница Create (человек сам, на этом компьютере) или чат через MCP.
           * Отдельным полем, потому что «by itself» и «you» - разные подписи у одной и той же строки. */
          source: q.schedule_id ? 'schedule' : q.tool_name === 'page' ? 'you' : 'chat',
          startedAt: (loop && loop.startedAt) || q.run_started || q.claimed_at || q.created_at,
          finishedAt: q.finished_at,
          /* Идущий - из loop; законченный - из журнала. Ни один не выдумывается. */
          steps: (loop && Array.isArray(loop.steps) && loop.steps)
            || (Array.isArray(q.run_steps) && q.run_steps) || [],
        };
      }),
    });
    return;
  }

  /* ОТМЕНИТЬ ОДНО - со страницы, кукой. mouseflow_stop отменяет ВСЁ и ходит с токеном; человеку на странице
   * Activity нужна кнопка у одной строки. Тот же SQL, что у стопа, сужённый до id: queued исчезает из очереди,
   * claimed останавливается на следующем шаге, который проверит агент (см. ?worker=state). Чужой id и
   * несуществующий отвечают одинаково - «нечего отменять», - как у расписаний и по той же причине. */
  if (req.method === 'POST' && req.query && req.query.cancel) {
    const id = String(req.query.cancel || '').trim();
    if (!/^[A-Za-z0-9_.:-]{1,80}$/.test(id)) return res.status(400).json({ error: 'that is not a job id' });
    const killed = await sql`
      update run_queue set state = 'cancelled', finished_at = now(),
             ok = false, said = 'cancelled before it finished'
      where user_id = ${who.id} and id = ${id} and state in ('queued', 'claimed')
      returning id, claimed_at
    `;
    if (!killed.length) return res.status(200).json({ ok: true, cancelled: false, said: 'nothing to cancel - it had already finished, or it is not yours' });
    return res.status(200).json({
      ok: true,
      cancelled: true,
      said: killed[0].claimed_at
        ? 'Stopping. A run already under way stops at the next step the machine checks, within a second or two.'
        : 'Cancelled. It never started.',
    });
  }

  /* ПРОГОН СО СТРАНИЦЫ - ТОЖЕ СТРОКА ОЧЕРЕДИ.
   *
   * Прогон с Create ведёт браузер напрямую с агентом, мимо облака: модель через /api/claude, действия по
   * локальной сети. Он никогда не становился строкой run_queue - и Activity, которая знает только очередь,
   * показывала «Nothing is running», пока вокруг экрана горела зелёная рамка. Остановить его было нечем,
   * кроме убийства агента в трее. Это и есть дыра: «всё, что идёт, - в одной очереди» было правдой для
   * машины и неправдой для человека.
   *
   * Поэтому страница ОБЪЯВЛЯЕТ свой прогон: `start` кладёт строку сразу claimed (забирать её агенту нечего -
   * claim берёт только queued), `step` подкладывает шаги, чтобы Activity показывала их живьём, `end` закрывает.
   * Отмена - тем же ?cancel, что у любой строки: страница видит state = cancelled в том же опросе, которым
   * рисует чужие прогоны, и останавливает цикл. Одна очередь, одна кнопка Stop, и «занята ли машина» для
   * расписаний теперь учитывает и прогон с страницы - одна мышь. */
  if (req.method === 'POST' && req.query && req.query.live && req.query.live !== '1') {
    const verb = String(req.query.live);
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const id = String(body.id || '').trim();
    if (!/^[A-Za-z0-9_.:-]{1,80}$/.test(id)) return res.status(400).json({ error: 'that is not a run id' });
    if (verb === 'start') {
      const loop = { goal: String(body.goal || '').slice(0, 4000), steps: [], startedAt: new Date().toISOString() };
      await sql`
        insert into run_queue (id, user_id, flow_id, tool_name, args, state, claimed_by, claimed_at, loop)
        values (${id}, ${who.id}, '#page', 'page', '{}'::jsonb, 'claimed', 'page', now(), ${JSON.stringify(loop)})
        on conflict (id) do nothing
      `;
      return res.status(200).json({ ok: true });
    }
    if (verb === 'step') {
      /* Только форма {tool, input}: шаги нужны, чтобы ЧИТАТЬ, что идёт, а не чтобы хранить всё, что прогон
       * знал. Двести - потолок ровно там же, где у журнала. */
      const steps = Array.isArray(body.steps) ? body.steps.slice(-200).map((s) => ({
        tool: String((s && s.tool) || '?'), input: s && typeof s.input === 'object' && s.input ? s.input : {},
      })) : [];
      const rows = await sql`
        update run_queue
        set loop = jsonb_set(coalesce(loop, '{}'::jsonb), '{steps}', ${JSON.stringify(steps)}::jsonb),
            claimed_at = now()
        where id = ${id} and user_id = ${who.id} and tool_name = 'page' and state = 'claimed'
        returning state
      `;
      /* Ответ несёт состояние, чтобы странице не нужен был второй запрос ради «меня не отменили?». */
      const now = rows.length ? 'claimed'
        : (await sql`select state from run_queue where id = ${id} and user_id = ${who.id}`)[0]?.state || 'gone';
      return res.status(200).json({ ok: true, state: now });
    }
    if (verb === 'end') {
      const ok = body.ok === true;
      await sql`
        update run_queue
        set state = ${ok ? 'done' : 'failed'}, ok = ${ok}, said = ${String(body.said || '').slice(0, 2000) || null},
            finished_at = now(), loop = null
        where id = ${id} and user_id = ${who.id} and tool_name = 'page' and state = 'claimed'
      `;
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: `no live verb "${verb}"` });
  }

  const action = req.query && req.query.worker;
  if (action) return workerRoute(String(action), req, res, sql, who);

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST' });
    return;
  }

  const body = req.body && typeof req.body === 'object' ? req.body : null;
  if (!body || body.jsonrpc !== '2.0' || typeof body.method !== 'string') {
    res.status(400).json(rpcError(body && body.id, -32600, 'not a JSON-RPC 2.0 request'));
    return;
  }

  const { id, method, params } = body;

  /* A notification has no id and gets no body - 202 is the documented answer, and replying to one would
   * put an unmatched response into the client's stream. */
  if (method.startsWith('notifications/')) {
    res.status(202).end();
    return;
  }

  try {
    if (method === 'initialize') {
      const asked = params && params.protocolVersion;
      res.setHeader('Mcp-Session-Id', randomUUID());
      res.status(200).json(rpc(id, {
        protocolVersion: SPOKEN.has(asked) ? asked : NEWEST,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER,
        instructions: 'Each tool other than mouseflow_status, mouseflow_stop and mouseflow_run_status is one '
          + 'skill on this person\'s MouseFlow account, and calling it moves the real mouse and keyboard on '
          + 'their computer. Two consequences worth holding on to: the actions cannot be undone from here, '
          + 'and a missing argument should be asked for rather than guessed. Nothing runs unless a worker is '
          + 'listening on that machine; mouseflow_status says whether one is.',
      }));
      return;
    }

    if (method === 'ping') {
      res.status(200).json(rpc(id, {}));
      return;
    }

    if (method === 'tools/list') {
      /* Fixed, and that is the change: this used to append one tool per skill, so the list - and the
       * tokens it costs in every request, and the permission dialog somebody reads - grew with the
       * library. Skills are found through mouseflow_recordings and run through mouseflow_run. */
      res.status(200).json(rpc(id, {
        tools: [
          ...READ_TOOLS,
          HELP_TOOL,
          SCHEDULE_TOOL, SCHEDULES_TOOL, UNSCHEDULE_TOOL,
          ...CASE_TOOLS,
          START_TOOL, STOP_RECORDING_TOOL,
          STATUS_TOOL, STOP_TOOL, RUN_STATUS_TOOL, RUN_TOOL, DO_TOOL,
        ],
      }));
      return;
    }

    if (method === 'tools/call') {
      res.status(200).json(rpc(id, await callTool(sql, who, params, req)));
      return;
    }

    res.status(200).json(rpcError(id, -32601, `no method "${method}"`));
  } catch (err) {
    /* A thrown error is still a tool answer when it happened inside one: the client should see a sentence
     * it can act on, not a transport failure it cannot. */
    if (method === 'tools/call') {
      res.status(200).json(rpc(id, say(`That did not work: ${err.message}`, true)));
      return;
    }
    res.status(200).json(rpcError(id, -32603, err.message));
  }
}

/* The outer net: anything thrown before or around the handler's own try block. */
export default wrap(handler, 'mcp');

