/* Часы, которые идут сами: раз в несколько минут спросить, не молчит ли чья-то машина перед задачей.
 *
 *   GET /api/watch   (Authorization: Bearer $CRON_SECRET - так его зовёт Vercel Cron)
 *
 * Решение - в api/_watch.mjs; здесь только чтение и отправка. Каждое предупреждение - один раз на событие
 * (feedOnce): сторож зовётся каждые десять минут, а человек должен прочитать «машина молчит» один раз, а не
 * шесть.
 *
 * ЗАКРЫТО СЕКРЕТОМ, А НЕ СЕССИЕЙ: вызывает не человек, а планировщик, и маршрут, который рассылает людям
 * сообщения, без замка был бы кнопкой «написать всем». Нет секрета в окружении - 503, а не «открыто».
 */
import { neon } from '@neondatabase/serverless';

import { report, wrap } from './_report.js';
import { whenSaid } from './_schedule.mjs';
import { feedLine } from './_telegram.mjs';
import { feedOnce } from './_telegram-out.mjs';
import { AHEAD_MS, MISSED_HORIZON_MS, watchVerdicts } from './_watch.mjs';

async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(503).json({ ok: false, error: 'CRON_SECRET is not set on this deployment' });
  if (String(req.headers.authorization || '') !== `Bearer ${secret}`) {
    return res.status(401).json({ ok: false, error: 'not the scheduler' });
  }
  if (!process.env.DATABASE_URL) return res.status(503).json({ ok: false, error: 'no database' });
  const sql = neon(process.env.DATABASE_URL);

  try {
    const rows = await sql`
      select s.id, s.user_id, s.label, s.zone, s.next_at, s.paused, p.value as seen
      from user_schedule s
      left join user_pref p on p.user_id = s.user_id and p.key = 'worker.seen'
      where s.deleted_at is null and s.paused = false and s.next_at is not null
        and s.next_at <= now() + ${`${Math.round(AHEAD_MS / 1000)} seconds`}::interval
        and s.next_at >= now() - ${`${Math.round(MISSED_HORIZON_MS / 1000)} seconds`}::interval
    `;
    const nowMs = Date.now();
    const byUser = new Map();
    for (const row of rows) {
      const list = byUser.get(row.user_id) || [];
      list.push(row);
      byUser.set(row.user_id, list);
    }
    let said = 0;
    for (const [userId, list] of byUser) {
      const seenMs = list[0].seen ? new Date(list[0].seen).getTime() : null;
      const seenSaid = seenMs ? whenSaid(seenMs, list[0].zone || 'UTC') : 'never';
      for (const verdict of watchVerdicts({ schedules: list, seenMs, nowMs })) {
        const row = list.find((one) => one.id === verdict.id);
        const due = whenSaid(verdict.dueMs, row.zone || 'UTC');
        const line = verdict.kind === 'silent'
          ? feedLine({ event: 'silent', title: row.label,
            said: `It is due ${due}, and the agent has not asked for work since ${seenSaid}. Wake the Mac or start `
              + 'the agent, or it will not run.', source: 'a schedule' })
          : feedLine({ event: 'missed', title: row.label,
            said: `It was due ${due}, and the agent was not taking work then (last asked ${seenSaid}).`,
            source: 'a schedule' });
        if (await feedOnce(sql, userId, `${verdict.kind}.${row.id}`, new Date(verdict.dueMs).toISOString(), line)) said++;
      }
    }
    return res.status(200).json({ ok: true, looked: rows.length, said });
  } catch (err) {
    await report(err, req, { route: 'watch' });
    return res.status(500).json({ ok: false, error: err.message });
  }
}

export default wrap(handler, 'watch');
