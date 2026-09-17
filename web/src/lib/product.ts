/* КАКОМУ ПРОДУКТУ ПРИНАДЛЕЖИТ ЭКРАН - одно определение, которое читают боковое меню, заголовок страницы
 * и первый тур. См. docs/SPLIT-PLAN.md §2.1 и §9, шаг 4.
 *
 * ЧТО ЗДЕСЬ РЕШАЕТСЯ, И ПОЧЕМУ ЭТО ОДИН ФАЙЛ. До него принадлежность экрана продукту не была записана
 * НИГДЕ, а его имя было записано ТРИЖДЫ: `NAV` в AppSidebar.tsx (ярлык), `TITLES` в AppLayout.tsx
 * (заголовок) и `STEPS` в OnboardingTour.tsx (цель подсветки). Три списка маршрутов, которые обязаны
 * совпадать и ничем не были связаны: /docs жил в меню ровно один день, и заголовок для него остался, а
 * шаг тура - нет. Пока списка два и больше, «показать один продукт за раз» - это правка в трёх местах,
 * и третье забывают.
 *
 * НАПРАВЛЕНИЕ СТРЕЛКИ - вот что делит, а не набор файлов (§0 плана):
 *
 *   'do'    машина действует, человек смотрит  - цель, очередь, доказательства, проверки
 *   'make'  человек действует, машина смотрит  - запись, имена, расшифровки, документы, числа
 *
 * `'both'` - НЕ третий продукт и не «мы не решили». Это экран, который по-настоящему отвечает на оба
 * вопроса и разрезается отдельным шагом плана: Skills (§5.1), Dashboard (§5.2), Gallery (§5.3). Пока он
 * стоит в обоих меню целиком - это честнее, чем спрятать его половину от того, кому она нужна.
 *
 * НИКАКИХ ЗАВИСИМОСТЕЙ, И ЭТО НАРОЧНО. Ни React, ни lucide, ни алиаса `@/`: файл импортируется прямо
 * из сюиты (`node` снимает типы сам), а импорт значка утащил бы за собой полдерева и превратил бы
 * проверку в сборку. Значки - представление, они лежат рядом с меню, и то, что у каждого пункта меню
 * значок есть, проверяется отдельно.
 *
 * ИМЕНА ПРОДУКТОВ - РАБОЧИЕ (SPLIT-PLAN §11.1, решение за владельцем, и оно ещё не принято). Они стоят
 * ровно в одном месте - в PRODUCTS ниже, - поэтому переименование это одна правка, а не поиск по
 * строкам в разметке.
 */

export type Product = 'do' | 'make';
/** Чей это экран. `'both'` - разрезается отдельным шагом плана, см. заголовок. */
export type Owner = Product | 'both';

/** Чем этот продукт вообще умеет действовать. */
export type Runner = 'browser' | 'desktop';

export interface ProductInfo {
  id: Product;
  /** Рабочее имя. SPLIT-PLAN §11.1. */
  name: string;
  /** Одной строкой, для переключателя: что человек получает, а не как это устроено. */
  blurb: string;
  /** Куда приводит выбор этого продукта. */
  home: string;
  /** Исполнители, которые этот продукт предлагает. Первый - тот, с которого начинают. */
  runsIn: Runner[];
}

export const PRODUCTS: Record<Product, ProductInfo> = {
  do: {
    id: 'do',
    name: 'Do it for me',
    blurb: 'Describe the job. The machine carries it out on your computer, and proves it still works.',
    home: '/create',
    /* ТОЛЬКО ЛОКАЛЬНЫЙ АГЕНТ - решение владельца от 2026-09-18, и слово «пока» в нём было.
     *
     * Расширение и агент - два разных исполнителя с разными обещаниями: расширение целится в элементы
     * страницы и не может выйти из браузера, агент видит весь экран. Выбор между ними стоял под каждым
     * сообщением, и в продукте про проверки это выбор, которого человек делать не должен: «проверь, что
     * выставление счёта ещё работает» проверяет то, что происходит на машине, а не во вкладке.
     *
     * Один исполнитель - и переключателя нет вовсе: сегментный контрол с одной кнопкой это не выбор, а
     * мебель. Всё остальное на Create уже ветвится по исполнителю, поэтому слова меняются сами. */
    runsIn: ['desktop'],
  },
  make: {
    id: 'make',
    name: 'Make it reusable',
    blurb: 'Record what you already do. It becomes a tool other agents can call and a document people '
      + 'can read.',
    home: '/record',
    /* Оба: запись в браузере - это и есть расширение, и оно у второго продукта не вспомогательное. */
    runsIn: ['browser', 'desktop'],
  },
};

export const PRODUCT_IDS: Product[] = ['do', 'make'];

/* ЧТО ОТКРЫВАЕТСЯ ПО УМОЛЧАНИЮ - ровно то, что открывалось до этого шага, то есть Record.
 *
 * «Какой продукт ведёт» - открытый вопрос владельца (§11.1 и SITE-DEBT §2), и он про главную страницу
 * сайта, а не про эту строку. Выбрать здесь что-то другое значило бы ответить на него молча и заодно
 * переставить первый экран у всех, кто уже пользуется приложением. Одна константа - и ответ, когда он
 * будет, это её правка. */
export const DEFAULT_PRODUCT: Product = 'make';

export interface TourStep {
  title: string;
  body: string;
}

export interface Screen {
  /** Маршрут, как он объявлен в web/src/main.tsx. */
  to: string;
  /** Ярлык в боковом меню. */
  label: string;
  /** Заголовок в шапке. Отличается от ярлыка там, где место и действие называются по-разному. */
  title: string;
  owner: Owner;
  /** Стоит ли в боковом меню. Экран без пункта меню всё равно нужен здесь - у него есть заголовок. */
  nav: boolean;
  beta?: boolean;
  /** Пункт со счётчиком «идёт прямо сейчас». */
  live?: boolean;
  /** Что о нём говорит первый тур. Экран без этого поля в туре не участвует. */
  tour?: TourStep;
}

/* ПОРЯДОК - ТОТ ЖЕ, ЧТО БЫЛ, и это не случайность: меню каждого продукта - это сегодняшнее меню, из
 * которого убрано чужое, а не новый порядок, придуманный заодно. Человек, открывший приложение после
 * этого изменения, находит то же там же. */
export const SCREENS: Screen[] = [
  {
    to: '/record',
    label: 'Record',
    title: 'Record',
    owner: 'make',
    nav: true,
    tour: {
      title: 'Record what you do',
      body: 'Press Record, work the way you normally would, and stop when you are done. Every click is '
        + 'kept with the name of the thing you clicked — "Send", not "1074, 159". Typing is kept as the '
        + 'fact that you typed and when, never as the words.',
    },
  },
  {
    to: '/create',
    label: 'Create',
    title: 'Create the flow',
    owner: 'do',
    nav: true,
    /* Beta on Create alone: of the things this product does, it is the one that acts on a real machine
     * from a model's decisions, so it is the one that can be wrong in a way that costs something. Saying
     * so is more use than a uniform confidence nobody believes. */
    beta: true,
    tour: {
      title: 'Say what you want done',
      body: 'Describe the job in a sentence and it works from a picture of your screen — so it reaches a '
        + 'spreadsheet, a folder or any window, not only a browser tab. It is the newest part, which is '
        + 'why it is marked Beta.',
    },
  },
  /* После Create и до Skills - в порядке, в котором человек встречает вещи: попросил, смотрит, что стало.
   * Счётчик у пункта - только идущее и ждущее, никогда история: число, растущее с каждым прогоном, было
   * бы шумом, а число «сейчас» - это то единственное, ради чего сюда идут не глядя.
   *
   * ИМЯ - LOGS, решение владельца от 2026-09-18. «Activity» описывало страницу, пока она была одной из
   * восьми; в приложении, где кроме неё осталось три экрана, это журнал - то место, куда идут узнать, что
   * именно произошло и почему. Адрес переехал на /logs, старый перенаправляет: он был живым. */
  {
    to: '/logs',
    label: 'Logs',
    title: 'Logs',
    owner: 'do',
    nav: true,
    live: true,
    tour: {
      title: 'Read what happened',
      body: 'Every run, with what was asked, what it did step by step, how long it took and how it ended '
        + '— and the frames it kept, so a failure comes with the evidence rather than with a claim.',
    },
  },
  /* Разорван пополам шагом 5 плана: библиотека потоков - это 'make', «запусти это» и расписания - 'do'.
   * Пока цел, стоит в обоих меню. */
  { to: '/skills', label: 'Skills', title: 'Skills', owner: 'both', nav: true,
    tour: {
      title: 'Keep the good ones as skills',
      body: 'A recording you keep becomes a skill: run it again whenever the same job comes back, or hand '
        + 'it to Create as one step of something larger.',
    } },
  /* СРАЗУ ЗА SKILLS, потому что кейс делается из скилла и читается рядом с ним: «что у меня есть» и «что
   * из этого проверяется каждую ночь» - два вопроса, которые задают друг за другом. */
  {
    to: '/tests',
    label: 'Tests',
    title: 'Tests',
    owner: 'do',
    nav: true,
    tour: {
      title: 'Prove it still works',
      body: 'A case is one question — "is this still true?" — asked on a schedule. It keeps the frames it '
        + 'saw, so a failure comes with the evidence rather than with a claim.',
    },
  },
  /* Asking about the numbers happens on the page that shows them, not at its own address.
   *
   * И это экран ТОЛЬКО второго продукта, решение владельца от 2026-09-18. Дашборд отвечает на вопрос «на
   * что ушла неделя» - вопрос человека о своей работе, а не о прогонах; §5.2 плана собиралась разрезать
   * его пополам, и половина «как отработал агент» в приложении про проверки не нужна: то же самое, только
   * с доказательствами, есть в Logs. `?half=` из шага 3 при этом не зря: он и делает дашборд однопродуктовым
   * без переписывания. */
  { to: '/dashboard', label: 'Dashboard', title: 'Dashboard', owner: 'make', nav: true,
    tour: {
      title: 'See where the time went',
      body: 'What your recordings add up to: which applications the work happens in, how long each '
        + 'stretch took, and what keeps repeating — which is usually the thing worth automating next.',
    } },
  /* A place rather than a setting. It was the fourth pane of the settings dialog, which was the right size
   * for a roster you fill in once and the wrong one for what it now is.
   *
   * ВРЕМЕННО НЕ В ПЕРВОМ ПРОДУКТЕ - решение владельца от 2026-09-18, и слово «пока» в нём было. Стоит
   * записать, что это стоит: в сборке, запертой на первый продукт, страница команд становится
   * недостижимой - из диалога настроек её убрали, когда она стала местом. Пока продукт один и сборка
   * обычная, туда попадают, переключившись. */
  { to: '/team', label: 'Teams', title: 'Teams', owner: 'make', nav: true },
  /* Last, and now it is the library rather than only the gallery: two shelves, other people's published
   * flows and the process documents written from your own recordings.
   *
   * ЧЕЙ ЭТО ЭКРАН - открытый вопрос §11.2 плана, и владелец ответил на него 2026-09-18: второго продукта.
   * Обе полки - и чужие опубликованные потоки, и документы - это «что уже сделано и можно взять», то есть
   * мастерская, а не проверки. */
  { to: '/gallery', label: 'Gallery', title: 'Gallery', owner: 'make', nav: true,
    tour: {
      title: 'Start from someone else’s work',
      body: 'Skills other people have shared. Take one, and it is yours to run and to change — a good way '
        + 'to see what this can do before recording anything at all.',
    } },

  /* Ниже - экраны БЕЗ пункта меню. Они здесь потому, что у них есть заголовок, и заголовок жил отдельным
   * списком, который расходился с меню молча. */
  { to: '/connect', label: 'Connections', title: 'Connections', owner: 'do', nav: false },
  { to: '/docs', label: 'Documents', title: 'Documents', owner: 'make', nav: false },
  /* Ассистент. Сегодня перенаправляет на дашборд, где он и живёт встроенной панелью; §5.3 плана
   * возвращает ему собственный адрес. Объявлен и сейчас - у живого маршрута обязан быть экран, иначе
   * заголовок для него однажды напишут вторым списком. */
  { to: '/chat', label: 'Assistant', title: 'Assistant', owner: 'make', nav: false },
  /* Прежний адрес журнала. Перенаправляет на /logs и остаётся объявленным: он был живым, на него ссылались
   * из чата и из писем расписаний, и закладка, отвечающая 404, - худший ответ, чем приводящая куда надо. */
  { to: '/activity', label: 'Logs', title: 'Logs', owner: 'do', nav: false },
  /* Страница О ПРОДУКТЕ, а не экран внутри него: читается без аккаунта. Принадлежит 'make' - это то, ради
   * чего чужой агент сюда подключается. */
  { to: '/mcp', label: 'MCP', title: 'MCP', owner: 'make', nav: false },
  /* Старый адрес дашборда. Оставлен живым: на него ссылается опубликованный обзор дорожной карты. Продукт
   * у него тот же, что у /dashboard, - иначе одна и та же страница переключала бы оболочку по-разному в
   * зависимости от того, каким адресом на неё зашли. */
  { to: '/insights', label: 'Dashboard', title: 'Dashboard', owner: 'make', nav: false },
];

/** Экран, которому принадлежит этот адрес. Самое длинное совпадение по префиксу, потому что `/docs/x`
 *  принадлежит `/docs`, а не корню - и потому что `/insights` не должен ловиться на `/in`. */
export const screenAt = (path: string): Screen | null => {
  let best: Screen | null = null;
  for (const screen of SCREENS) {
    if (path !== screen.to && !path.startsWith(screen.to + '/')) continue;
    if (!best || screen.to.length > best.to.length) best = screen;
  }
  return best;
};

/** Заголовок в шапке. Незнакомый адрес - имя продукта целиком, а не пустая шапка. */
export const titleAt = (path: string): string => screenAt(path)?.title ?? 'MouseFlow';

/** Продукт, которому принадлежит адрес, или null - если экран общий или адрес незнакомый.
 *
 *  ЭТО И ЕСТЬ ТО, ЧТО ДЕРЖИТ ОБОЛОЧКУ И АДРЕС В СОГЛАСИИ. Выбор продукта - предпочтение, но адрес
 *  сильнее: открыв ссылку на /tests, человек должен видеть меню того продукта, в котором /tests живёт,
 *  а не того, который он выбрал вчера. Иначе появляется состояние «я в make, а на экране do», и починить
 *  его можно только ещё одним правилом. */
export const productAt = (path: string): Product | null => {
  const screen = screenAt(path);
  return screen && screen.owner !== 'both' ? screen.owner : null;
};

/** Пункты меню этого продукта, в порядке объявления. Общие экраны стоят в обоих. */
export const screensFor = (product: Product): Screen[] =>
  SCREENS.filter((s) => s.nav && (s.owner === product || s.owner === 'both'));

/** Шаги первого тура для этого продукта - те же экраны и в том же порядке, что в его меню. */
export const tourFor = (product: Product): Screen[] =>
  screensFor(product).filter((s) => s.tour);
