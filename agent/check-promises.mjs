/* Проверка обещаний: то, что написано ПРО код, против самого кода.
 *
 * ПОЧЕМУ ЭТОТ ФАЙЛ ПОЯВИЛСЯ, и это стоит записать целиком, потому что случай был показательным.
 *
 * 1 сентября 2026 обнаружилось, что главное privacy-утверждение продукта расходилось с кодом - и притом в
 * ДВЕ противоположные стороны одновременно. Публичная дока говорила «что никогда не записывается: какая
 * клавиша нажата» и «читается один флаг на нажатие, и больше ничего». Этот репозиторий в трёх местах
 * говорил обратное: «записывается, что клавиша нажата и какая». Правда была третьей: клавиша, способная
 * дать символ, считается и никогда не опознаётся (vkCode не читается), а клавиша, которая ничего не может
 * написать - Enter, Tab, аккорд под Ctrl - записывается ПО ИМЕНИ, потому что иначе запись не знает, что
 * работа закончилась нажатием Send.
 *
 * Ни один тест этого не поймал, и не мог: весь набор проверял, что код делает то, что он делает. Никто
 * нигде не сравнивал ПРОЗУ с кодом. Нашлось случайно - я читал агента ради другой задачи.
 *
 * ЧТО ИМЕННО ЗДЕСЬ ПРОВЕРЯЕТСЯ, и чем это отличается от «грепа по фразе». Пин на фразу проходит вечно и не
 * знает про код: он ловит только того, кто удалил абзац. Здесь сравниваются ДВА СПИСКА - имена клавиш,
 * разобранные из обоих агентов, и список, напечатанный в docs/product/17-privacy-security.md, - в обе
 * стороны. Добавь кто-нибудь F5 в NamedKey и не тронь документ - падает. Удали строку из документа -
 * падает. Разойдись агенты между собой - падает, а они обещают друг другу «same rule as the macOS agent» в
 * собственных комментариях.
 *
 * И ОТДЕЛЬНО - ГРАНИЦА, а не список: CaptureKey() и captureKey() не принимают аргумента. Идентичность
 * клавиши может доехать до счётчика только будучи в него переданной, а передавать некуда. Подпись без
 * параметров - это и есть обещание «считается и не опознаётся», выраженное так, что его нельзя нарушить
 * молча.
 *
 * ПОЧЕМУ НЕ В ОСНОВНОМ СЬЮТЕ, А СВОИМ ФАЙЛОМ. Тут нет ни сборки, ни фикстур, ни сети - только чтение с
 * диска, - поэтому он запускается первым и дёшево. И он про свой класс ошибок: не «код неверен», а «то, что
 * мы про код рассказываем, больше не про этот код». Место для следующих таких же обещаний - здесь.
 *
 *   node agent/check-promises.mjs           проверки офлайн, входит в npm test
 *   node agent/check-promises.mjs --site    плюс живой сайт: не вернулся ли выброшенный лозунг в дока
 *
 * Флаг --site отдельный нарочно: тест, которому нужна сеть, в CI однажды упадёт не по своей вине, и его
 * выключат целиком вместе со всем остальным в этом файле.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');

let pass = 0;
let fail = 0;
const check = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  -> ' + detail : '')); }
};
const group = (t) => console.log('\n' + t);

const ps = read('mouseflow-agent.ps1');
const swift = read('mouseflow-agent.swift');
const privacy = read('../docs/product/17-privacy-security.md');

const same = (a, b) => a.size === b.size && [...a].every((one) => b.has(one));
const missing = (a, b) => [...a].filter((one) => !b.has(one));

/* ------------------------------------------------------------------ имена клавиш, из кода и из прозы */

group('какие клавиши записываются по имени - код и дока говорят один список');

/* Разбирается ТЕЛО switch, а не весь NamedKey: ниже в той же функции есть ветка для буквы под аккордом,
 * и она присваивает name из vk, а не из литерала. */
const psSwitch = (() => {
  const at = ps.indexOf('static string NamedKey(int vk)');
  if (at < 0) return '';
  const end = ps.indexOf('default: break;', at);
  return end < 0 ? '' : ps.slice(at, end);
})();
/* [A-Za-z0-9], а не [A-Za-z]: первая же попытка сломать эту проверку нарочно - «case 0x74: name = "F5"» -
 * прошла мимо неё, потому что в имени цифра. Проверка, которую нельзя уронить, ничего не проверяет; эту
 * уронили, и вот та версия, которая падает. */
const fromPs = new Set([...psSwitch.matchAll(/name = "([A-Za-z0-9]+)"/g)].map((m) => m[1]));

const swiftTable = (() => {
  const at = swift.indexOf('let NAMED_KEYS');
  if (at < 0) return '';
  /* От «= [», а не от первой скобки: первая - это тип, [Int64: String], и её закрывающая стоит раньше
   * первого имени. Резал по ней - таблица разбиралась в ноль имён, а проверка «оба агента называют одно и
   * то же» падала, указывая на macOS-агент, в котором всё было на месте. */
  const open = swift.indexOf('= [', at);
  if (open < 0) return '';
  const end = swift.indexOf(']', open + 3);
  return end < 0 ? '' : swift.slice(open, end);
})();
const fromSwift = new Set([...swiftTable.matchAll(/"([A-Za-z0-9]+)"/g)].map((m) => m[1]));

/* Список из документа - тот самый блок, про который в нём написано, что он машинно-проверяемый. */
const fromDoc = (() => {
  const at = privacy.indexOf('## The keyboard, exactly');
  if (at < 0) return new Set();
  const section = privacy.slice(at, privacy.indexOf('\n## ', at + 5));
  const fence = section.match(/```\n([^`]*)\n```/);
  return new Set(fence ? fence[1].trim().split(/\s+/) : []);
})();

check('обе таблицы в агентах разобрались', fromPs.size >= 13 && fromSwift.size >= 13,
  `ps ${fromPs.size}, swift ${fromSwift.size}`);
check('и список в 17-privacy тоже', fromDoc.size >= 13, String(fromDoc.size));

/* Агенты обещают это друг другу словами - «Same rule as the macOS agent» - и вот проверка этих слов. */
check('оба агента называют одни и те же клавиши', same(fromPs, fromSwift),
  `только в ps: ${missing(fromPs, fromSwift).join(', ') || '-'}; только в swift: ${missing(fromSwift, fromPs).join(', ') || '-'}`);

/* В ОБЕ СТОРОНЫ. Добавленная в код клавиша, про которую в доке молчат, - это ровно тот случай, из-за
 * которого этот файл написан; лишняя строка в доке - обещание, которого код не даёт. */
check('в доке названы все, что называет код', missing(fromPs, fromDoc).length === 0,
  missing(fromPs, fromDoc).join(', '));
check('и код называет все, что названы в доке', missing(fromDoc, fromPs).length === 0,
  missing(fromDoc, fromPs).join(', '));

/* ------------------------------------------------------------------ граница: символ не опознаётся */

group('символьная клавиша считается и не опознаётся - и передать её идентичность некуда');

check('CaptureKey() в Windows-агенте не принимает аргумента',
  /static void CaptureKey\(\)/.test(ps), 'подпись изменилась');
check('captureKey() в macOS-агенте тоже',
  /func captureKey\(\)/.test(swift), 'подпись изменилась');
check('и безымянный путь выбирается именно тогда, когда имени нет',
  /if \(named != null\) CaptureNamedKey\(named\); else CaptureKey\(\);/.test(ps));
check('на macOS - той же развилкой',
  /Recorder\.shared\.captureKey\(\)/.test(swift) && /if let named = NAMED_KEYS\[code\]/.test(swift));
/* Флаг - единственное, что читается у символьной клавиши, и читается он ради другого: чтобы воспроизведение
 * не попало в запись как человек, который печатает. */
check('у символьной клавиши читается только флаг инъекции',
  /`?vkCode`? and `?scanCode`? are NOT read/.test(ps) || /vkCode. and .scanCode. are NOT read/.test(ps));

/* --------------------------------------------- «оно только смотрит»: три списка, и все три обязаны совпасть
 *
 * ЭТО ВТОРОЕ ОБЕЩАНИЕ, КОТОРОЕ ПРОДАЁТСЯ СЛОВАМИ. Первое - про клавиши - разошлось с кодом в две стороны
 * сразу и стоило этому файлу существования. Второе - «агент только записывает» - устроено точно так же:
 * фраза на странице продукта, список в двух агентах и ни одного места, где их сравнивают. Разница в том,
 * что здесь список говорит НЕ о том, что делается, а о том, что РАЗРЕШЕНО, - и потому лишнее имя в нём
 * дороже, чем пропущенное: имя, дописанное в READS_ONLY по ошибке, открывает действие, а не закрывает.
 *
 * Поэтому сверяются все три: macOS-агент, Windows-агент и блок в 17-privacy, - и в обе стороны. */

group('«только запись»: оба агента и дока называют один список читающих действий');

const swiftReads = (() => {
  const at = swift.indexOf('let READS_ONLY');
  if (at < 0) return new Set();
  const open = swift.indexOf('= [', at);
  const end = open < 0 ? -1 : swift.indexOf(']', open + 3);
  return end < 0 ? new Set() : new Set([...swift.slice(open, end).matchAll(/"([a-z]+)"/g)].map((m) => m[1]));
})();

const psReads = (() => {
  const at = ps.indexOf('static readonly string[] ReadsOnly');
  if (at < 0) return new Set();
  const end = ps.indexOf('};', at);
  return end < 0 ? new Set() : new Set([...ps.slice(at, end).matchAll(/"([a-z]+)"/g)].map((m) => m[1]));
})();

const docReads = (() => {
  const at = privacy.indexOf('## Record-only');
  if (at < 0) return new Set();
  const part = privacy.slice(at, privacy.indexOf('\n## ', at + 5));
  const fence = part.match(/```\n([^`]*)\n```/);
  return new Set(fence ? fence[1].trim().split(/\s+/) : []);
})();

check('список читающих действий разобран из macOS-агента', swiftReads.size === 6,
  [...swiftReads].join(', '));
check('и из Windows-агента', psReads.size === 6, [...psReads].join(', '));
check('и из 17-privacy', docReads.size === 6, [...docReads].join(', '));
check('оба агента разрешают ровно одно и то же', same(swiftReads, psReads),
  `только macOS: ${missing(swiftReads, psReads).join(', ') || '-'}; только Windows: ${missing(psReads, swiftReads).join(', ') || '-'}`);
check('и дока обещает ровно то, что разрешает код', same(docReads, psReads),
  `только в доке: ${missing(docReads, psReads).join(', ') || '-'}; только в коде: ${missing(psReads, docReads).join(', ') || '-'}`);

/* ЧЕГО В СПИСКЕ БЫТЬ НЕ ДОЛЖНО - названо поимённо, а не «ничего лишнего»: три этих действия ничего не
 * нажимают, и именно поэтому кто-нибудь однажды сочтёт их безобидными. Поднять чужое окно - это то, как
 * СЛЕДУЮЩЕЕ действие попадает в него; запустить программу и подменить буфер обмена - изменить машину. */
for (const act of ['activate', 'open', 'clipwrite', 'click', 'type', 'key', 'drag', 'clickname']) {
  check(`${act} не считается чтением ни в одном из агентов`,
    !swiftReads.has(act) && !psReads.has(act));
}

/* ОГОВОРКА - ЧАСТЬ ОБЕЩАНИЯ. Гарантия здесь кодовая, а не системная, и страница, забывшая это сказать,
 * продаёт защиту операционной системы, которой нет: на macOS то же разрешение Accessibility разрешает и
 * CGEventPost, на Windows SendInput не спрашивает вовсе. */
{
  const at = privacy.indexOf('## Record-only');
  const part = at < 0 ? '' : privacy.slice(at, privacy.indexOf('\n## ', at + 5));
  check('дока говорит, что систему это не обеспечивает', /Neither operating system enforces this/.test(part));
  check('и называет обе причины - CGEventPost и SendInput',
    /CGEventPost/.test(part) && /SendInput/.test(part));
  /* И в отказе, который читает человек, - теми же словами. Оговорка, живущая только в доке, до того, кто
   * упёрся в отказ, не доезжает. */
  check('macOS-агент говорит это же в тексте отказа',
    /not something macOS enforces/.test(swift));
  check('и Windows-агент - в своём',
    /not something Windows enforces/.test(ps));
}

/* НЕ БЕРЁТ РАБОТУ ВОВСЕ - а не берёт и проваливает. Найдено живым запуском 2026-09-23: агент с флагом
 * рапортовал taking:true и собирался опрашивать очередь. Всё, что оттуда приезжает, требует действия, так
 * что взятая задача стоила бы человеку прогона, а очередь копила бы провалы вместо ожидания. Закреплено на
 * ОБОИХ, потому что дыра была одинаковой формы в обоих курьерах. */
{
  const swCourier = swift.slice(swift.indexOf('private static func loop() {'),
    swift.indexOf('private static func loop() {') + 1200);
  const psCourier = ps.slice(ps.indexOf('static void Loop()'), ps.indexOf('static void Loop()') + 1600);
  check('macOS-курьер не опрашивает очередь в режиме записи',
    /guard !recordOnly else \{ sleep\(\d+\); continue \}/.test(swCourier), swCourier.slice(0, 80));
  check('и Windows-курьер тоже',
    /if \(Agent\.RecordOnly\) \{ Thread\.Sleep\(\d+\); continue; \}/.test(psCourier));
  /* И СКАЗАНО ПРИ СТАРТЕ: строка «берёт работу» была бы правдой про переключатель и ложью про машину. */
  check('и баннер macOS не обещает, что работа берётся',
    /NOT taking work from it - this agent only watches/.test(swift));
}

/* ------------------------------------------------------------------ аккорд, и почему исключение узкое */

group('исключение названо вместе с его причиной, иначе оно читается как лазейка');

const section = (() => {
  const at = privacy.indexOf('## The keyboard, exactly');
  return at < 0 ? '' : privacy.slice(at, privacy.indexOf('\n## ', at + 5));
})();
check('дока называет модификаторы аккорда - Ctrl и Command',
  /\bCtrl\b/.test(section) && /\bCommand\b/.test(section));
check('и причину, по которой имена вообще читаются - иначе не видно, что работа кончилась Send',
  /Send/.test(section));
check('и ловушку с Alt, из-за которой AltGr - это набор текста, а не команда',
  /AltGr/.test(section));
/* Тот же довод обязан стоять и в коде, у самого списка: правило, которое можно найти только в доке,
 * первым же рефакторингом уезжает. */
check('код у списка объясняет то же самое',
  /Send/.test(psSwitch) || /pressing Send/.test(ps));
check('и Alt там назван не командным модификатором',
  /ALT IS NOT A COMMAND MODIFIER/.test(ps));

/* ------------------------------------------------------------------ выброшенные лозунги */

group('оба неверных лозунга не вернулись - ни в доку, ни в строки, которые читает модель');

/* «never which key» - половина правды, которая выглядит как обещание строже настоящего.
 * «pressed and which key» - половина правды в другую сторону. Ни одну нельзя использовать в прозе. */
const SLOGANS = [
  { was: /never which key/i, why: '«never which key» - обещание строже, чем код' },
  { was: /pressed and which key/i, why: '«pressed and which key» - обещание шире, чем код' },
];
const MODEL_FACING = [
  ['api/_docs.mjs', read('../api/_docs.mjs')],
  ['api/_search.mjs', read('../api/_search.mjs')],
  ['api/_recording-tools.js', read('../api/_recording-tools.js')],
  ['web/src/dev/mock-api.ts', read('../web/src/dev/mock-api.ts')],
];
/* 17-privacy НЕ в этом списке, и это не поблажка: он и есть тот файл, который рассказывает, что именно было
 * сказано неверно, - лозунги стоят там в кавычках, как история. Первая версия этой проверки пыталась
 * вырезать цитаты регуляркой по кавычкам и тем самым ослепла на .js-файлах, где кавычек полно: подсунутое
 * «pressed and which key» в api/_search.mjs она пропустила. Ниже проверяется то, что от документа
 * действительно требуется - точная формулировка и список, - а лозунги ловятся там, где их быть не должно
 * вовсе. */
for (const [name, text] of MODEL_FACING) {
  for (const slogan of SLOGANS) {
    check(`${name}: ${slogan.why}`, !slogan.was.test(text));
  }
}

group('а документ, который рассказывает об ошибке, обязан содержать сам ответ');
/* От документа требуется не настроение, а МЕХАНИЗМ: та половина обещания, которую можно сверить с кодом.
 * «Символьная клавиша не опознаётся» держится на том, что vkCode не читается, - значит документ обязан это
 * назвать. Перепиши кто-нибудь раздел красиво и без механизма - и сверять станет нечего. */
check('17-privacy формулирует правило через механизм, а не через настроение',
  /cannot spell anything/i.test(section)
    && /vkCode/.test(section) && /not touched|not read/i.test(section),
  'в разделе нет «cannot spell anything» или не назван нечитаемый vkCode');
check('и держит машинно-проверяемый список, а не только прозу',
  fromDoc.size >= 13);

/* А точная формулировка, наоборот, обязана быть - и именно в тех строках, которые уезжают в модель:
 * ответ, собранный из них, кто-нибудь потом процитирует как ответ продукта. */
group('и точная формулировка есть там, где её прочитает модель');
for (const [name, text] of [['docs/product/17-privacy-security.md', privacy], ...MODEL_FACING]) {
  check(`${name} говорит про клавиши, которые ничего не могут написать`,
    /cannot spell anything|which cannot spell/i.test(text));
}

/* ------------------------------------------------------------------ воспроизведение играет имена */

group('обещание про воспроизведение: названные клавиши нажимаются, безымянные - нет');
check('в ветке воспроизведения имя играется',
  /e\.Action\.StartsWith\("Key "\)/.test(ps));
check('а «Key Down» из неё исключён по имени - иначе печатавший человек воспроизводится как стрелка вниз',
  /e\.Action != "Key Down"/.test(ps));

/* ------------------------------------------------------------------ живой сайт, по флагу */

if (process.argv.includes('--site')) {
  group('и публичная дока на живом сайте говорит то же самое');
  const base = process.env.MOUSEFLOW_DOCS_URL || 'https://mouse-flow.vercel.app/docs/llms.json';
  try {
    const res = await fetch(base);
    const body = await res.json();
    const pages = new Map((body.pages || []).map((one) => [one.id, one.markdown || '']));
    const record = pages.get('record-a-flow') || '';
    const priv = pages.get('privacy-and-data') || '';
    check('страницы прочитаны', !!record && !!priv, `pages: ${pages.size}`);
    check('правило названо на странице про запись', /cannot spell anything/i.test(record));
    check('и на странице про приватность', /cannot spell anything/i.test(priv));
    for (const key of ['Enter', 'Tab', 'Escape', 'Backspace', 'Delete']) {
      check(`${key} назван прямо`, record.includes(key));
    }
    check('и лозунг «never captured: which key» не вернулся',
      !/never captured: which key/i.test(record + priv));
  } catch (err) {
    check('сайт отвечает', false, err.message);
  }
}

/* -------------------------------------------- два оглавления документации против одного списка экранов
 *
 * ШАГ 15 ПЛАНА, и его условие готовности («check-promises.mjs по-прежнему зелёный») было слишком слабым:
 * оно проходило и для двух оглавлений, набранных руками и разошедшихся с приложением на следующей неделе.
 * Этот файл существует ровно против такого расхождения, так что оглавления сделаны ПРОВЕРЯЕМЫМИ: строка
 * экрана несёт его МАРШРУТ, а кому маршрут принадлежит, знает web/src/lib/product.ts - тот самый единственный
 * список, который читают меню, заголовок и тур.
 *
 * Значит третьего списка нет. Страница, положенная не в ту половину, падает здесь; страница, добавленная в
 * набор и не попавшая ни в одно оглавление, падает здесь же. Руками остаётся только текст описания - то,
 * ради чего документ и пишут.
 *
 * product.ts импортируется как есть: он намеренно без зависимостей, а node снимает типы сам (см. шапку
 * web/check-web.mjs, где это уже сделано по той же причине). */

group('документация: два оглавления и один список экранов - без третьего списка');
{
  const { productAt, PRODUCTS } = await import('../web/src/lib/product.ts');
  const dir = fileURLToPath(new URL('../docs/product/', import.meta.url));
  const pages = readdirSync(dir).filter((f) => /^\d\d-.+\.md$/.test(f)).sort();
  const index = { do: read('../docs/product/do.md'), make: read('../docs/product/make.md') };

  check('в наборе найдены страницы', pages.length >= 27, String(pages.length));
  check('и оба оглавления читаются', !!index.do && !!index.make);

  /* Строка экрана: ссылка на страницу и маршрут в обратных кавычках - ровно то, что печатает таблица. */
  const rows = (text) => [...text.matchAll(/\|\s*\[[^\]]+\]\((\d\d-[a-z0-9-]+\.md)\)\s*\|\s*`(\/[a-z]*)`\s*\|/g)]
    .map((m) => ({ page: m[1], route: m[2] }));

  for (const id of ['do', 'make']) {
    const mine = rows(index[id]);
    check(`у половины ${id} разобраны строки экранов`, mine.length >= 6, String(mine.length));
    for (const row of mine) {
      /* САМ ФАЙЛ СУЩЕСТВУЕТ. Оглавление со ссылкой в никуда - худший вид оглавления: оно выглядит полным. */
      check(`${id}: ${row.page} существует`, pages.includes(row.page));
      /* И МАРШРУТ ПРИНАДЛЕЖИТ ЭТОЙ ЖЕ ПОЛОВИНЕ - по product.ts, а не по нашему мнению. */
      check(`${id}: ${row.route} принадлежит этой же половине`, productAt(row.route) === id,
        `${row.route} -> ${productAt(row.route)}`);
    }
  }

  /* НИ ОДНОЙ ПОТЕРЯННОЙ СТРАНИЦЫ. Набор растёт; страница, не попавшая никуда, невидима для обоих читателей
   * и заметна только тому, кто её написал. */
  const listed = new Set([...pages].filter((one) =>
    index.do.includes('(' + one + ')') || index.make.includes('(' + one + ')')));
  const lost = pages.filter((one) => !listed.has(one));
  check('каждая страница набора стоит хотя бы в одном оглавлении', lost.length === 0, lost.join(', '));

  /* И В ОБЩЕМ ОГЛАВЛЕНИИ ТОЖЕ - оно остаётся полным списком, а не третьей половиной. */
  const readme = read('../docs/product/README.md');
  const notInReadme = pages.filter((one) => !readme.includes('(' + one + ')'));
  check('и в README, который остаётся полным набором', notInReadme.length === 0, notInReadme.join(', '));
  check('а README ведёт на оба оглавления', /\(do\.md\)/.test(readme) && /\(make\.md\)/.test(readme));

  /* ИМЯ ПРОДУКТА - ИЗ product.ts, а не набрано в заголовке. Рабочие имена меняются решением владельца
   * (§11.1), и оглавление, повторившее старое, - это ровно то расхождение, против которого файл написан. */
  for (const id of ['do', 'make']) {
    check(`заголовок половины ${id} называет её так же, как product.ts`,
      index[id].includes(PRODUCTS[id].name), PRODUCTS[id].name);
    /* И КАЖДОЕ ВЕДЁТ НА ДРУГОЕ: читатель, пришедший не туда, должен уйти по ссылке, а не решить, что
     * страницы пропали. */
    check(`и ${id} называет, что лежит в другой половине`,
      new RegExp('\\(' + (id === 'do' ? 'make' : 'do') + '\\.md\\)').test(index[id]));
  }
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
/* exitCode, а не process.exit(): в режиме --site остаётся открытый пул соединений undici, и выход посреди
 * его закрытия печатает на Windows ассерт libuv - «41 passed» и следом строка, похожая на падение. Здесь
 * нечего дренировать - ни таймеров, ни серверов, только чтение файлов, - поэтому Node выходит сам. */
process.exitCode = fail ? 1 : 0;
