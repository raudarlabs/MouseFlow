/* Сторож аккаунта - вычислением. Ночь 2026-10-01: разовая задача на 04:30 не выполнилась, агент молчал,
 * и сказать об этом было некому до утра. Здесь проверяется, что сторож скажет вовремя, и только то, что
 * правда.
 *
 * Run: node api/_test-watch.mjs */
import { readFileSync } from 'node:fs';
import { AHEAD_MS, CATCH_UP_MS, SILENT_MS, watchVerdicts } from './_watch.mjs';

let pass = 0;
let fail = 0;
const check = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  -> ' + detail : '')); }
};
const group = (t) => console.log('\n' + t);
const show = (v) => JSON.stringify(v);

const now = Date.parse('2026-10-01T01:00:00Z');
const at = (ms) => new Date(ms).toISOString();
const min = 60_000;

group('скоро, а машина молчит');
{
  const soon = [{ id: 's1', next_at: at(now + 30 * min) }];
  check('молчит дольше порога - предупредить', show(watchVerdicts({ schedules: soon, seenMs: now - SILENT_MS - min, nowMs: now }))
    === show([{ id: 's1', kind: 'silent', dueMs: now + 30 * min }]));
  check('спрашивала минуту назад - молчать', watchVerdicts({ schedules: soon, seenMs: now - min, nowMs: now }).length === 0);
  check('не спрашивала никогда - предупредить', watchVerdicts({ schedules: soon, seenMs: null, nowMs: now })[0]?.kind === 'silent');
  check('дальше часа - ещё рано говорить',
    watchVerdicts({ schedules: [{ id: 'x', next_at: at(now + AHEAD_MS + min) }], seenMs: null, nowMs: now }).length === 0);
  check('на паузе - не о чем говорить',
    watchVerdicts({ schedules: [{ id: 'p', next_at: at(now + min), paused: true }], seenMs: null, nowMs: now }).length === 0);
}

group('прошло, и машина молчала в срок - пропуск');
{
  const due = now - 90 * min;
  const past = [{ id: 'm', next_at: at(due) }];
  check('молчала весь срок и окно догона - пропуск',
    watchVerdicts({ schedules: past, seenMs: due - 2 * 60 * min, nowMs: now })[0]?.kind === 'missed');
  /* Спросила ПОСЛЕ окна догона - значит такт расписаний уже всё решил и сказал сам. */
  check('спрашивала после окна догона - такт сказал сам, второй строки нет',
    watchVerdicts({ schedules: past, seenMs: due + CATCH_UP_MS + 5 * min, nowMs: now }).length === 0);
  check('окно догона ещё не кончилось - не пропуск',
    watchVerdicts({ schedules: [{ id: 'c', next_at: at(now - 10 * min) }], seenMs: null, nowMs: now }).length === 0);
  check('старше суток - не новость',
    watchVerdicts({ schedules: [{ id: 'o', next_at: at(now - 25 * 60 * min) }], seenMs: null, nowMs: now }).length === 0);
}

group('маршрут: закрыт секретом, говорит один раз');
{
  const route = readFileSync(new URL('./watch.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  check('без секрета в окружении - 503, а не открыто', /if \(!secret\) return res\.status\(503\)/.test(route));
  check('чужой вызов - 401', /`Bearer \$\{secret\}`/.test(route) && /status\(401\)/.test(route));
  check('каждое предупреждение - один раз на событие', /feedOnce\(sql, userId, `\$\{verdict\.kind\}\.\$\{row\.id\}`/.test(route));
  /* Тот же ключ, что у такта расписаний: «пропущено» не придёт дважды. */
  const worker = readFileSync(new URL('./_mcp-worker.mjs', import.meta.url), 'utf8');
  check('и такт расписаний пишет «пропущено» тем же ключом', /feedOnce\(sql, who\.id, `missed\.\$\{row\.id\}`/.test(worker));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
