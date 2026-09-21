/* Одна просьба в очередь, с кукой страницы - и один вопрос «чем кончилось».
 *
 *   POST /api/queue        { goal: "..." }   -> { ok: true, id: "q_..." }
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

const fail = (res, status, message) =>
  res.status(status).json({ ok: false, error: { type: 'queue_error', message } });

const ID = /^[A-Za-z0-9_.:-]{1,80}$/;

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
      if (!ID.test(id)) return fail(res, 400, 'that is not a job id');
      /* ЧУЖОЙ id И НЕСУЩЕСТВУЮЩИЙ ОТВЕЧАЮТ ОДИНАКОВО - как у расписаний и кейсов, и по той же причине:
       * существует ли работа на чужом аккаунте, это не вопрос, на который здесь отвечают. */
      const [job] = await sql`
        select state, ok, said from run_queue where id = ${id} and user_id = ${who.id}
      `;
      if (!job) return fail(res, 404, 'no such job on this account');
      const done = job.state === 'done' || job.state === 'failed' || job.state === 'cancelled';
      return res.status(200).json({
        ok: true,
        state: job.state,
        done,
        /* `good`, а не `ok`: у ответа уже есть `ok`, и оно значит «запрос удался», а не «прогон удался».
         * Два разных смысла под одним именем - это ровно тот ложный зелёный, против которого написан
         * весь цикл. */
        good: done ? job.ok === true : null,
        said: job.said || null,
      });
    }

    if (req.method !== 'POST') return fail(res, 405, 'GET or POST');

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const goal = String(body.goal || '').trim();
    if (!goal) return fail(res, 400, 'What should it do? Pass the errand as `goal`, in a sentence.');
    /* ОБРЕЗАТЬ МОЛЧА НЕЛЬЗЯ: цель, укороченная по дороге, - это прогон, который сделает почти то, о чём
     * просили, и будет при этом выглядеть нормально. Число одно на все места, из api/_brain.mjs. */
    if (goal.length > GOAL_MAX) {
      return fail(res, 413, `That is ${goal.length - GOAL_MAX} characters over what one goal can hold.`);
    }

    /* Оба отказа - «машины нет» и «машина занята» - живут в queueOne и приезжают готовыми словами. Вторая
     * их редакция здесь была бы инструкцией, которая в одном месте останется верной, а в другом устареет. */
    const put = await queueOne(sql, who.id, {
      flowId: DESKTOP_GOAL, toolName: 'mouseflow_do', args: { goal },
    });
    if (put.why) return res.status(409).json({ ok: false, error: { type: 'queue_error', message: put.why } });
    return res.status(200).json({ ok: true, id: put.id });
  } catch (err) {
    await report(err, req, { route: 'queue' });
    return fail(res, 500, err.message);
  }
}

export default wrap(handler, 'queue');
