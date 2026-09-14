/* Рендер записи памяти в текст хода — то немногое из api/_memory.mjs, что нужно и расширению.
 * MEMORY-PLAN.md §4.3, §4.6.
 *
 * ЗАЧЕМ ЭТО ЛЕЖИТ В extension/, а не в api/. Расширение загружается из этой папки и импортировать
 * что-либо выше неё не может - ни в MV3, ни вообще. `web:<origin>` - единственный ключ памяти, который
 * УМЕЕТ знать десктопный агент: он видит окна ОС (`win32:chrome`), а не адрес страницы внутри Chrome, и
 * прочитать её может только тот, кто эту страницу и открыл, - расширение. Значит и рендер записи под этим
 * ключом должен уметь работать здесь, своим ходом, а не через api/, который для расширения не существует.
 * Ровно так же уже сделан extension/checks.js: общий код живёт ЗДЕСЬ, api/_memory.mjs его РЕЭКСПОРТИРУЕТ.
 *
 * ЧТО ЗДЕСЬ, А ЧТО ОСТАЛОСЬ В api/_memory.mjs. Редакция (writeMemory, redactionProblem) и запись в базу -
 * дело формы на странице (Memory.tsx → api/memory.js), а расширение ничего не пишет, только читает уже
 * проверенное через GET /api/memory. Значит сюда переехало только то, что нужно ЧТЕНИЮ: разбор URL в ключ
 * (`webKeyFor`) и укладка записей в бюджет хода (`fitBlock`) - тот же бюджет и то же вытеснение, что у
 * десктопных ключей, одной функцией на оба пути, а не второй копией правила.
 */

/** 4.10: 600 символов на ключ. Совпадает с KEY_BUDGET в api/_memory.mjs - см. тест на обеих сторонах. */
export const KEY_BUDGET = 600;

/**
 * Ключ `web:<origin>` из настоящего URL — origin, без пути и без запроса (4.3), той же дисциплины, что
 * `PageUrl`/`Bare` в mouseflow-agent.ps1, но короче: там остаётся путь, здесь — только хозяин страницы.
 * @param {string} url
 * @returns {string|null}
 */
export function webKeyFor(url) {
  const said = String(url == null ? '' : url).trim();
  if (!said) return null;
  let parsed;
  try {
    parsed = new URL(said.includes('://') ? said : `https://${said}`);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  return `web:${parsed.host}`;
}

/** Как одна запись печатается в блок хода — `§ <провенанс> [версия|runId]   <текст>` (4.4). */
function lineFor(e) {
  const tag = e.provenance + (e.version != null ? ` v${e.version}` : '') + (e.runId ? ` ${e.runId}` : '');
  return `§ ${tag}   ${e.body}`;
}

/**
 * Уложить живые записи одного ключа в бюджет (4.10). `taught` не вытесняется никогда; `derived`
 * пересчитывается на чтении и не накапливается, так что и его вытеснять не нужно; вытесняется только
 * `learned`, и самое старое первым. Builtin и `rejected`/`pending` сюда не попадают вовсе — их место не
 * в блоке хода (4.9, 4.4).
 * @param {object[]} entries
 * @param {number} [budget]
 * @returns {{text: string, used: number, evicted: object[]}}
 */
export function fitBlock(entries, budget = KEY_BUDGET) {
  const live = (entries || []).filter((e) => e && e.provenance !== 'builtin' && (e.state == null || e.state === 'live'));
  const taught = live.filter((e) => e.provenance === 'taught');
  const derived = live.filter((e) => e.provenance === 'derived');
  const learned = live
    .filter((e) => e.provenance === 'learned')
    .slice()
    .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));

  const evicted = [];
  let kept = [...taught, ...derived, ...learned];
  let text = kept.map(lineFor).join('\n');

  while (text.length > budget && learned.length) {
    const gone = learned.shift();
    kept = kept.filter((e) => e !== gone);
    evicted.push(gone);
    text = kept.map(lineFor).join('\n');
  }
  /* Осталось только taught/derived, и всё равно не влезает - не портить их молча вытеснением, которого
   * 4.4 для них не разрешает; обрезать текст целиком, как `Clip` в ps1, а не одну запись наугад. */
  if (text.length > budget) text = text.slice(0, budget - 1) + '…';

  return { text, used: text.length, evicted };
}
