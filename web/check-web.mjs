/* ОБОЛОЧКА ПРИЛОЖЕНИЯ: один список экранов, а не четыре.
 *
 * Этот файл появился вместе с шагом 4 из docs/SPLIT-PLAN.md §9 и закрепляет ровно его условие: НИЧТО НЕ
 * РЕШАЕТ ПРИНАДЛЕЖНОСТЬ ЭКРАНА ПРОДУКТУ ДВАЖДЫ.
 *
 * Что было до него. Набор экранов был записан ЧЕТЫРЕ раза и ни разу целиком:
 *   web/src/main.tsx            - маршруты (единственный полный список, и только адреса)
 *   web/src/shell/AppSidebar    - NAV: адрес, ярлык, значок, бета, счётчик
 *   web/src/shell/AppLayout     - TITLES: адрес -> заголовок
 *   web/src/shell/OnboardingTour- STEPS: адрес -> что о нём рассказать
 * Ни одна из копий не знала о других, и они уже разошлись: /docs пробыл в меню один день, заголовок для
 * него остался, шага тура не было никогда; тур водил по пяти экранам в приложении, где их восемь.
 * Продукта в этих списках не было вовсе - его негде было записать.
 *
 * ПОЧЕМУ ЭТО ИСПОЛНЯЕТСЯ, А НЕ ЧИТАЕТСЯ ГЛАЗАМИ. `web/src/lib/product.ts` намеренно без зависимостей -
 * ни React, ни lucide, ни алиаса `@/`, - поэтому node снимает с него типы и импортирует его напрямую.
 * Список экранов здесь настоящий, а не его описание: проверка спрашивает у него то же, что спрашивает
 * меню.
 *
 * Маршруты из main.tsx читаются ТЕКСТОМ, и это не обход правила: там нужен список строковых литералов
 * `path: '...'`, а не поведение роутера. Исполнить main.tsx нельзя - он монтирует приложение в DOM.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  DEFAULT_PRODUCT, PRODUCTS, PRODUCT_IDS, SCREENS,
  productAt, screenAt, screensFor, titleAt, tourFor,
} from './src/lib/product.ts';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, p), 'utf8').replace(/\r\n/g, '\n');

const main = read('src/main.tsx');
const sidebar = read('src/shell/AppSidebar.tsx');
const layout = read('src/shell/AppLayout.tsx');
const tour = read('src/shell/OnboardingTour.tsx');
const hook = read('src/shell/useProduct.ts');
const viteConfig = read('vite.config.ts');
const twoUp = read('scripts/two-products.mjs');

let pass = 0;
let fail = 0;
const check = (what, ok, detail) => {
  if (ok) { pass++; console.log('  ok   ' + what); return; }
  fail++;
  console.log('  FAIL ' + what + (detail ? '  -> ' + String(detail).slice(0, 300) : ''));
};
const group = (name) => console.log('\n' + name);
/** Никогда не бросает: выражение, собирающее подробность отказа, уже роняло сюиту в этом репозитории. */
const show = (v) => { try { return JSON.stringify(v); } catch (_) { return String(v); } };

/* ------------------------------------------------------------------ один список, а не четыре */

group('набор экранов записан один раз');
{
  /* Прежние копии не просто не используются - их НЕТ. Неиспользуемый список рядом с используемым это
   * ровно то состояние, из которого расхождение и вырастает: кто-то правит тот, который нашёл. */
  check('в меню нет своего списка пунктов',
    !/const NAV = \[/.test(sidebar) && /screensFor\(product\)/.test(sidebar), 'AppSidebar.tsx');
  check('в шапке нет своей таблицы заголовков',
    !/const TITLES/.test(layout) && /titleAt\(path\)/.test(layout), 'AppLayout.tsx');
  check('в туре нет своего списка шагов',
    !/const STEPS: Step\[\] = \[/.test(tour) && /tourFor\(product\)/.test(tour), 'OnboardingTour.tsx');
  /* И общий файл ни от чего не зависит - иначе его нельзя было бы исполнить здесь, и проверка
   * превратилась бы в чтение текста. */
  const product = read('src/lib/product.ts');
  const imports = product.match(/^\s*import\s/gm) || [];
  check('а сам список экранов ничего не импортирует', imports.length === 0, show(imports));
}

group('каждый живой маршрут - это экран, и у каждого экрана есть маршрут');
{
  /* Адреса, которые оболочка вообще показывает: без входа, без админки и без параметрических. */
  const BARE = ['/sign-in', '/sign-up', '/reset-password', '/admin', '/users', '/models', '/'];
  const routed = [...new Set((main.match(/path: '([^']*)'/g) || [])
    /* `path: '` - семь знаков. Восемь их было в первой версии этой строки, и список выходил пустым: обе
     * проверки ниже проходили, не сравнив ничего. Поймано первым же запуском. */
    .map((line) => line.slice(7, -1)))]
    .filter((p) => p.startsWith('/'))
    .filter((p) => !p.includes('$'))
    .filter((p) => !BARE.includes(p));

  const missing = routed.filter((p) => !SCREENS.some((s) => s.to === p));
  check('у каждого маршрута оболочки есть экран', missing.length === 0, show(missing));

  /* И наоборот: экран без маршрута - это пункт меню, ведущий в никуда, или заголовок, который никогда не
   * покажется. `/chat` и `/docs` перенаправляют, но объявлены, поэтому найдутся. */
  const orphans = SCREENS.filter((s) => !routed.includes(s.to));
  check('и у каждого экрана есть маршрут', orphans.length === 0, show(orphans.map((s) => s.to)));

  /* Заголовок отвечает на каждый из них - незнакомый адрес даёт имя приложения, и это тоже ответ, но
   * ни один ЗНАКОМЫЙ адрес не должен до него доходить. */
  const nameless = routed.filter((p) => titleAt(p) === 'MouseFlow' && screenAt(p)?.title !== 'MouseFlow');
  check('и у каждого есть заголовок', nameless.length === 0, show(nameless));
}

group('значок есть у каждого пункта меню');
{
  /* Значки остались в AppSidebar - они представление, - поэтому здесь читается их таблица. Пункт без
   * значка рисуется запасным, то есть выглядит как чужой. */
  const block = sidebar.slice(sidebar.indexOf('const ICONS'), sidebar.indexOf('};', sidebar.indexOf('const ICONS')));
  const drawn = new Set((block.match(/'(\/[a-z-]+)'/g) || []).map((q) => q.slice(1, -1)));
  const inNav = [...new Set(PRODUCT_IDS.flatMap((id) => screensFor(id).map((s) => s.to)))];
  const without = inNav.filter((to) => !drawn.has(to));
  check('каждый пункт обоих меню нарисован своим значком', without.length === 0, show(without));
  /* И наоборот - значок для того, чего в меню нет, это остаток от удалённого пункта. */
  const extra = [...drawn].filter((to) => !inNav.includes(to));
  check('и нет значка для того, чего в меню нет', extra.length === 0, show(extra));
}

/* ------------------------------------------------------------------ два продукта, а не один */

group('переключение продукта меняет оболочку');
{
  const doNav = screensFor('do').map((s) => s.to);
  const makeNav = screensFor('make').map((s) => s.to);
  check('у продуктов разные меню', doNav.join(',') !== makeNav.join(','),
    show({ do: doNav, make: makeNav }));
  /* И у каждого есть то, чего нет у другого: два меню, различающиеся только порядком, - это не два
   * продукта, а одно меню, перетасованное. */
  check('и у каждого есть хотя бы один свой экран',
    doNav.some((to) => !makeNav.includes(to)) && makeNav.some((to) => !doNav.includes(to)),
    show({ onlyDo: doNav.filter((t) => !makeNav.includes(t)),
      onlyMake: makeNav.filter((t) => !doNav.includes(t)) }));
  /* Домашний экран продукта обязан стоять в его собственном меню: переключатель ведёт именно туда, и
   * адрес, которого в меню нет, выглядит как промах. */
  for (const id of PRODUCT_IDS) {
    check('дом продукта ' + id + ' стоит в его меню',
      screensFor(id).some((s) => s.to === PRODUCTS[id].home), PRODUCTS[id].home);
    /* И принадлежит ему, а не общей части: дом - это то, что отвечает на вопрос «где я». */
    check('и принадлежит ему, а не обоим', productAt(PRODUCTS[id].home) === id,
      show(productAt(PRODUCTS[id].home)));
  }
  check('по умолчанию открывается существующий продукт', PRODUCT_IDS.includes(DEFAULT_PRODUCT),
    DEFAULT_PRODUCT);
  /* Корень ведёт домой ВЫБРАННОГО продукта, а не на постоянный адрес. */
  check('и корень ведёт домой выбранного, а не на один зашитый адрес',
    /PRODUCTS\[storedProduct\(\)\]\.home/.test(main) && !/redirect\(\{ to: '\/record' \}\)/.test(main),
    'main.tsx');
}

group('чем продукт умеет действовать - решает продукт');
{
  const create = read('src/features/create/CreateView.tsx');
  /* Решение владельца от 2026-09-18: первый продукт действует ТОЛЬКО локальным агентом. Расширение и агент
   * дают разные обещания - расширение целится в элементы страницы и не выходит из браузера, - и в продукте
   * про проверки это выбор, которого человек делать не должен. */
  check('первый продукт действует только локальным агентом',
    PRODUCTS.do.runsIn.join() === 'desktop', show(PRODUCTS.do.runsIn));
  check('а второй - и браузером тоже: запись в браузере это и есть расширение',
    PRODUCTS.make.runsIn.includes('browser'), show(PRODUCTS.make.runsIn));
  /* И страница СПРАШИВАЕТ у продукта, а не решает сама: запомненное «в браузере» в такой сборке иначе
   * или исполнилось бы молча агентом, или показало бы переключатель на одну кнопку. */
  check('и Create спрашивает об этом продукт, а не решает сам',
    /const runners = PRODUCTS\[product\]\.runsIn;/.test(create)
      && /return runners\.includes\(was\) \? was : runners\[0\];/.test(create), 'CreateView.tsx');
  check('переключателя с одной кнопкой не бывает',
    /\{runners\.length > 1 && \(/.test(create), 'CreateView.tsx');
}

group('порядок меню закреплён по каждому продукту');
{
  /* ЦЕЛИКОМ, а не «Gallery последняя»: порядок говорит, в каком порядке об этих экранах думают, и пин на
   * нём существует затем, чтобы и добавление пункта, и удаление были видны в диффе теста. Объединение
   * обоих закреплено отдельно, в mcp/test-mcp.mjs, - оно и есть сегодняшнее меню до разделения. */
  const ORDER = {
    /* Первый продукт - это ПРОВЕРКИ: попросил, прочитал журнал, сложил в навык, проверяешь. Галерея,
     * дашборд и команды ушли во второй - решение владельца от 2026-09-18, см. комментарии в product.ts. */
    do: '/create,/logs,/skills,/tests',
    make: '/record,/skills,/dashboard,/team,/gallery',
  };
  for (const id of PRODUCT_IDS) {
    const now = screensFor(id).map((s) => s.to).join();
    check('меню продукта ' + id + ' - тот порядок, о котором договорились', now === ORDER[id], now);
  }
}

group('адрес сильнее выбора');
{
  /* Иначе появляется состояние «я в make, а на экране Tests», и чинить его приходится ещё одним
   * правилом. Экран одного продукта отвечает своим продуктом независимо ни от чего. */
  check('экран одной половины называет её', productAt('/tests') === 'do' && productAt('/record') === 'make');
  /* А общий не называет никакой - и это не «не решили», а «по-настоящему оба»: такой экран не должен
   * переключать оболочку под человеком. Общим остался Skills - его разрезает §5.1 плана; дашборд, команды
   * и галерея с 2026-09-18 принадлежат второму продукту целиком. */
  check('а общий не называет никакой', productAt('/skills') === null);
  check('и таких экранов остался ровно один',
    SCREENS.filter((s) => s.owner === 'both').length === 1,
    show(SCREENS.filter((s) => s.owner === 'both').map((s) => s.to)));
  check('и незнакомый адрес тоже', productAt('/nowhere') === null);
  /* Вложенный адрес принадлежит своему экрану, а не корню: /docs/x - это Documents. */
  check('вложенный адрес принадлежит своему экрану',
    screenAt('/docs/abc')?.to === '/docs' && titleAt('/docs/abc') === 'Documents',
    show(screenAt('/docs/abc')));
  /* И совпадение по префиксу не ловит соседа с общим началом. */
  check('и совпадение не ловит соседа с общим началом', screenAt('/teams-of-mine') === null,
    show(screenAt('/teams-of-mine')));
}

group('тур водит по тому продукту, в котором стоят');
{
  for (const id of PRODUCT_IDS) {
    const steps = tourFor(id);
    check('у продукта ' + id + ' есть что показать', steps.length > 0, String(steps.length));
    /* И шаги идут в том же порядке, что пункты меню: тур ведёт вниз по колонке, и подсветка, прыгающая
     * вверх, читается как промах. */
    const inNav = screensFor(id).map((s) => s.to);
    const order = steps.map((s) => inNav.indexOf(s.to));
    check('и его шаги идут сверху вниз по его же меню',
      order.every((n, i) => n >= 0 && (i === 0 || n > order[i - 1])), show(order));
  }
  /* А НАПИСАННЫЙ ШАГ ОБЯЗАН ГДЕ-ТО ПОКАЗАТЬСЯ.
   *
   * Найдено мутацией, которая ничего не сломала: проверка выше спрашивала у tourFor, стоят ли его шаги в
   * меню, - а tourFor сам собран из пунктов меню, так что ответ был «да» всегда. Опасность обратная:
   * текст, написанный экрану БЕЗ пункта меню, не покажется никогда, и узнать об этом неоткуда - тур
   * выглядит нормально, просто в нём на один шаг меньше, чем кто-то написал. Подсветка меряет элемент по
   * `data-tour`, и у экрана вне меню такого элемента на странице нет. */
  const unreachable = SCREENS.filter((s) => s.tour && !s.nav);
  check('а текст тура не написан экрану, которого нет в меню', unreachable.length === 0,
    show(unreachable.map((s) => s.to)));
  /* Первым шагом - сам переключатель, и у него есть во что целиться. */
  check('первый шаг целится в переключатель', /target: 'product'/.test(tour)
    && /data-tour="product"/.test(sidebar));
  /* Последний - установка агента, и он общий: агент нужен обоим. */
  check('последний шаг - установка, и он один на оба продукта',
    /const INSTALL: Step = \{/.test(tour) && /INSTALL,\n\]/.test(tour));
}

group('сборка на один продукт - половина без второй половины');
{
  /* Уровень 2 из SPLIT-PLAN §0: `VITE_PRODUCT=do|make` собирает приложение, в котором второй половины
   * нет. План говорил ПОДГОТОВИТЬ этот разрез, а не выполнить его, и здесь ровно подготовленное: обе
   * половины можно поднять рядом и посмотреть. Второй домен, второй проект на Vercel и разрезанный
   * `api/` - это шаги 5-8, и их здесь нет. */
  check('опечатка в переменной останавливает сборку, а не собирает обычное приложение',
    /VITE_PRODUCT must be "do", "make" or unset/.test(viteConfig), 'vite.config.ts');
  /* Каждая половина в свой каталог, иначе вторая сборка затирает первую и сравнивать нечего. */
  check('и каждая половина собирается в свой каталог',
    /outDir: onlyProduct \? 'dist-' \+ onlyProduct : 'dist'/.test(viteConfig), 'vite.config.ts');
  /* ЗАМОК СИЛЬНЕЕ И АДРЕСА. Адрес сильнее выбора - но в сборке на одну половину экранов другой в меню
   * нет, и подчинить оболочку адресу значило бы показать меню, которого в этой сборке не существует. */
  check('замок сильнее и выбора, и адреса',
    /if \(LOCKED\) return LOCKED;/.test(hook)
      && /if \(LOCKED\) return \{ product: LOCKED, chosen: LOCKED \};/.test(hook), 'useProduct.ts');
  /* И переключателя в ней нет: кнопка, предлагающая половину, которой в сборке не существует, хуже её
   * отсутствия. Как и шага тура, который её объясняет. */
  check('переключателя в ней нет', /\{locked \? \(/.test(sidebar), 'AppSidebar.tsx');
  check('и шага тура про переключатель тоже', /\.\.\.\(locked \? \[\] : \[\{/.test(tour),
    'OnboardingTour.tsx');
  /* Собираются ОТДЕЛЬНЫМИ процессами: `VITE_PRODUCT` читается на загрузке конфига, и конфиг кэшируется -
   * в одном процессе вторая половина вышла бы копией первой под другим именем. */
  check('половины собираются отдельными процессами, а не в одном',
    /spawnSync\(process\.execPath/.test(twoUp) && /VITE_PRODUCT: half\.id/.test(twoUp),
    'two-products.mjs');
  /* И поднимаются на РАЗНЫХ портах - иначе «рядом» не получится. */
  const ports = [...twoUp.matchAll(/port: (\d+)/g)].map((m) => m[1]);
  check('и поднимаются рядом, на разных портах',
    ports.length === 2 && ports[0] !== ports[1], show(ports));
}

group('имена продуктов стоят ровно в одном месте');
{
  /* SPLIT-PLAN §11.1: имена рабочие, решение за владельцем. Переименование обязано быть одной правкой, а
   * не поиском по разметке. */
  /* Включая комментарии - нарочно. Имя, оставшееся в объяснении рядом с кодом, переживает переименование
   * так же тихо, как имя в разметке, и читается следующим как действующее. */
  for (const id of PRODUCT_IDS) {
    const name = PRODUCTS[id].name;
    const inShell = [sidebar, layout, tour, main].filter((f) => f.includes(name));
    check('имя «' + name + '» не вписано в оболочку руками', inShell.length === 0,
      String(inShell.length) + ' файлов');
  }
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
