/* Правило отступления при переполнении диска - ИСПОЛНЕНИЕМ.
 *
 * Проверяется здесь ровно одно свойство, и оно того стоит: запись, у которой нет второй копии на аккаунте,
 * НЕ отдаёт свои события ни при каких обстоятельствах. Всё остальное в этом правиле - про место на диске;
 * это - про то, потеряет ли человек свою работу.
 *
 * Регулярка над исходником прошла бы и на коде, отсортированном не в ту сторону, и на коде, где фильтр по
 * `syncedAt` стоит после `slice`. Поэтому - выполнение.
 *
 * Запуск: node api/_test-quota.mjs
 */
/* CRLF НОРМАЛИЗУЕТСЯ ПРИ ЧТЕНИИ. На Windows рабочая копия приходит с \r\n, а пины написаны с \n:
 * многострочный пин тогда не находит того, что стережёт, а одностроч­ный проходит, перестав проверять.
 * Та же идиома, что в agent/test-contract.mjs, mcp/test-mcp.mjs и extension/check-extension.mjs. */
import { readFileSync, readdirSync } from 'node:fs';
import { freeingOrder, heldElsewhere } from './_quota.mjs';
import { LIMITS } from './_spend.mjs';

let pass = 0;
let fail = 0;
const check = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  -> ' + detail : '')); }
};
const group = (t) => console.log('\n' + t);

const events = (n) => Array.from({ length: n }, (_, i) => ({ x: i, y: i, action: 'Mouse Movement', delayMs: 1 }));
const synced = (id, n) => ({ id, name: id, syncedAt: '2026-08-28T00:00:00.000Z', events: events(n) });
const local = (id, n) => ({ id, name: id, events: events(n) });

group('что отдаёт события, и в каком порядке');
check('самая большая первой',
  JSON.stringify(freeingOrder([synced('small', 10), synced('big', 900), synced('mid', 100)]))
    === JSON.stringify(['big', 'mid', 'small']));
check('пустая запись не в очереди - отдавать нечего',
  JSON.stringify(freeingOrder([synced('has', 5), { id: 'empty', syncedAt: 'x', events: [] }]))
    === JSON.stringify(['has']));
/* Порядок при равенстве фиксирован, иначе тест иногда проходит - а это хуже, чем не иметь его. */
check('одинаковые по размеру идут в устойчивом порядке',
  JSON.stringify(freeingOrder([synced('b', 50), synced('a', 50)])) === JSON.stringify(['a', 'b']));

group('ТО, ЧЕГО НЕТ НА АККАУНТЕ, НЕ ОТДАЁТ НИЧЕГО');
/* Единственная копия. Выложить её события значит их потерять - то есть сделать ровно то, ради чего всё это
 * и написано. Она может быть какой угодно большой: размер здесь не аргумент. */
check('запись без штампа не попадает в очередь никогда',
  JSON.stringify(freeingOrder([local('mine', 99999), synced('theirs', 1)]))
    === JSON.stringify(['theirs']));
check('и даже когда она единственная - очередь пуста, а не «ну ладно»',
  JSON.stringify(freeingOrder([local('only', 99999)])) === JSON.stringify([]));
check('пустой штамп - это отсутствие штампа',
  JSON.stringify(freeingOrder([{ id: 'x', syncedAt: '', events: events(10) }])) === JSON.stringify([]));
check('и heldElsewhere отвечает то же самое',
  heldElsewhere(synced('a', 1)) === true && heldElsewhere(local('b', 1)) === false
    && heldElsewhere(null) === false);

group('мусор на входе не роняет и не выдумывает');
check('не массив - пустая очередь', JSON.stringify(freeingOrder(null)) === JSON.stringify([]));
check('дыры в списке пропускаются',
  JSON.stringify(freeingOrder([null, undefined, synced('ok', 3)])) === JSON.stringify(['ok']));
check('запись без событий вовсе не роняет',
  JSON.stringify(freeingOrder([{ id: 'no-events', syncedAt: 'x' }])) === JSON.stringify([]));
check('и запись без id тоже',
  JSON.stringify(freeingOrder([{ syncedAt: 'x', events: events(5) }])) === JSON.stringify([]));

/* ------------------------------------------------------------------ потолки и продукты (шаг 10) */

group('у каждого потолка есть продукт, и каждый потолок кто-то спрашивает');
{
  const spend = readFileSync(new URL('./_spend.mjs', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const keys = Object.keys(LIMITS);

  /* SPLIT-PLAN §8. Три значения, и `both` - не «не решили», а общая инфраструктура. */
  const stray = keys.filter((k) => !['do', 'make', 'both'].includes(LIMITS[k].product));
  check('у каждого ключа назван продукт', stray.length === 0, stray.join(', '));
  /* И оба продукта в таблице есть: колонка, где у всех одно значение, ничего не разделяет. */
  const sides = new Set(keys.map((k) => LIMITS[k].product));
  check('и в таблице есть оба продукта, а не один', sides.has('do') && sides.has('make'),
    [...sides].join(','));

  /* КАЖДЫЙ ПОТОЛОК СТОРОЖИТ НАСТОЯЩИЙ МАРШРУТ. Найдено при разметке: ключ `plan` не тратил никто -
   * построение плана идёт через /api/claude. Потолок, который никто не спрашивает, читается как
   * защита, которой нет. */
  const dir = new URL('./', import.meta.url);
  const asked = new Set();
  for (const name of readdirSync(dir)) {
    if (!/\.(mjs|js)$/.test(name) || name.startsWith('_test')) continue;
    const text = readFileSync(new URL(name, dir), 'utf8').replace(/\r\n/g, '\n');
    /* НЕ `[^)]*?`: у api/claude.js первым аргументом стоит `neon(process.env.DATABASE_URL)`, и запрет на
     * скобку обрывал совпадение на его закрывающей - ключ `claude` не находился, и проверка объявляла
     * его несторожащим. Поймано первым же запуском. */
    for (const m of text.matchAll(/overSpend\([\s\S]{0,160}?'([a-z-]+)'\s*\)/g)) asked.add(m[1]);
  }
  const unguarded = keys.filter((k) => !asked.has(k));
  check('и каждый потолок кто-то спрашивает', unguarded.length === 0, unguarded.join(', '));
  /* И наоборот: маршрут, спрашивающий ключ, которого в таблице нет, не ограничен ничем - overSpend
   * молча отвечает «можно». */
  const unlimited = [...asked].filter((k) => !keys.includes(k));
  check('а всё, что спрашивают, в таблице есть', unlimited.length === 0, unlimited.join(', '));

  /* Число живо, а не только объявлено: overSpend читает именно его. */
  check('и overSpend читает эту таблицу, а не свои числа',
    /const limit = LIMITS\[route\];/.test(spend) && /limit\.windowMs/.test(spend) && /limit\.max/.test(spend));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
