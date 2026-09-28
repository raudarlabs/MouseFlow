/* Тест-кейс: что запустить, что должно быть верно, и как назвать то, что получилось.
 *
 * ЗАВИСИМОСТЕЙ НЕТ НАРОЧНО - как у _brain.mjs, _schedule.mjs и _expect.mjs. Этот модуль читают с трёх
 * сторон: облачный драйвер (api/mcp.js, ?worker=step) дописывает проверки к цели, маршрут страницы
 * (api/cases.js) проверяет утверждения и считает вердикт, и браузер (web/src/features/tests) рисует тот же
 * вердикт теми же словами. Три вычисления одного вердикта разошлись бы первым же изменением правила, и
 * разошлись бы молча: отчёт, который на странице зелёный, а в чате красный, хуже отсутствующего.
 * Типы для браузера - в _case.d.mts, править вместе.
 *
 * ЧЕТЫРЕ ИСХОДА, А НЕ ДВА, и это тот же принцип, что три исхода у одной проверки (см. _expect.mjs):
 *
 *   pass     - процедура прошла, и все утверждения сошлись. Единственный зелёный.
 *   fail     - утверждение НЕ сошлось. Это найденный дефект продукта, и он не прячется ни за чем.
 *   blocked  - вердикта о продукте нет: агент не довёл процедуру, или проверить не удалось, или прогон
 *              вообще ничего не утверждал. Это НЕ красный: это «мы не узнали».
 *   pass_with_repairs - прошло, но шаг починила модель. Дремлет до пункта 4 плана (гибридный реплей): чинить
 *              шаги сегодня некому, и ни один прогон так пока не помечается. Считается всё равно - место
 *              для него в словаре важнее, чем аккуратность «добавим, когда понадобится»: без него первый
 *              починенный прогон приехал бы в отчёт зелёным.
 *
 * Смешать blocked с fail - самая дорогая из возможных ошибок здесь. Ночь, в которую агент не смог открыть
 * приложение, покрасила бы отчёт красным наравне с найденным дефектом; через неделю таких ночей отчёт
 * перестают читать, и вместе с ним перестают замечать настоящие дефекты.
 */

import { CHECKS } from './_expect.mjs';
/* Виды проверок, которые умеет ДОКУМЕНТ, а не дерево доступности: у DOM их девять против шести, потому что
 * точное число совпадений и адрес страницы знает только он. Живут в extension/, потому что расширение не
 * может импортировать ничего выше своей папки; сервер и браузер читают их оттуда. */
import { DOM_CHECKS } from '../extension/checks.js';

/**
 * ЧТО МОЖНО УТВЕРЖДАТЬ - ЗАВИСИТ ОТ ТОГО, ГДЕ ЭТО БУДЕТ ПРОВЕРЯТЬСЯ, и отказ поэтому приходит при записи
 * кейса, а не ночью. `url_contains` на десктопном скилле не бессмысленно - его просто нечем проверить: у
 * окна приложения нет адреса. Обратное неверно, поэтому у браузера набор шире.
 */
export const checksFor = (surface) => (surface === 'browser' ? DOM_CHECKS : CHECKS);

/** Ключ, под которым кейс едет в аргументах работы. Двойное подчёркивание - «это не параметр скилла». */
export const CASE_KEY = '__case';

/* СКОЛЬКО УТВЕРЖДЕНИЙ НА КЕЙС. Не техническое ограничение, а то же, что у чек-листа: восемь проверок в
 * конце одного прогона человек ещё читает, тридцать - уже нет, и кейс на тридцать утверждений почти всегда
 * означает, что это должно было быть тремя кейсами. Отказ называет число. */
export const EXPECTS_MAX = 8;

/* Длины - те же, что принимает шаг: имя контрола, искомый текст, процесс, «что это доказывает». Обрезать
 * молча было бы хуже: утверждение, у которого отрезали хвост, проверяет не то, что написали. */
const NAME_MAX = 200;
const TEXT_MAX = 400;
const WHY_MAX = 300;
/* МОМЕНТ, В КОТОРЫЙ УТВЕРЖДЕНИЕ ПРОВЕРЯЕТСЯ, - одним предложением. Двести знаков потому, что это фраза
 * («письмо отправлено»), а не процедура: момент, который не описывается предложением, - это не момент, а
 * второй кейс. */
const AFTER_MAX = 200;

const str = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * Разобрать присланные утверждения. Одна проверка на маршрут страницы и на тул: список утверждений,
 * который приняла одна дверь и отвергла другая, - это два разных представления о том, что такое кейс.
 *
 * @returns {{ expects: object[], why: string }} why непустой - список не принят, и в нём сказано почему.
 */
export function readExpects(input, allowed) {
  const list = Array.isArray(input) ? input : [];
  /* Набор видов - ТОТ, ЧТО У ПОВЕРХНОСТИ, на которой это будет проверяться (checksFor). По умолчанию
   * десктопный: он строже, и кейс, записанный без указания поверхности, лучше отвергнуть, чем принять
   * утверждение, которое проверить будет нечем. */
  const kinds = Array.isArray(allowed) && allowed.length ? allowed : CHECKS;
  if (!list.length) {
    return {
      expects: [],
      /* Кейс без утверждений - это скилл с расписанием, и ровно этим он и должен быть. Отказ прямой:
       * тихо принятый пустой кейс каждую ночь выдавал бы «passed», ничего не проверив. */
      why: 'a case needs at least one check - without one it is a skill on a schedule, and every night it '
        + 'would report "passed" having proven nothing. Add what must be true when the run is done.',
    };
  }
  if (list.length > EXPECTS_MAX) {
    return { expects: [], why: `${EXPECTS_MAX} checks is the most one case takes; this has ${list.length}. `
      + 'More than that is usually several cases wearing one name.' };
  }
  const expects = [];
  for (let i = 0; i < list.length; i++) {
    const one = list[i] && typeof list[i] === 'object' ? list[i] : {};
    const check = str(one.check);
    const name = str(one.name).slice(0, NAME_MAX);
    const text = str(one.text).slice(0, TEXT_MAX);
    const process = str(one.process).slice(0, NAME_MAX);
    const why = str(one.why).slice(0, WHY_MAX);
    /* КОГДА проверять. Пусто - в конце прогона, как было всегда и как работает v1. */
    const after = str(one.after).slice(0, AFTER_MAX);
    const at = `check ${i + 1}`;
    if (!kinds.includes(check)) {
      return { expects: [], why: `${at}: "${check || '(nothing)'}" is not a kind of check here. `
        + `One of ${kinds.join(', ')}.` };
    }
    /* Адрес страницы имени не имеет: у url_is и url_contains требовать его - требовать бессмыслицу. */
    if (!name && check !== 'url_is' && check !== 'url_contains') {
      return { expects: [], why: `${at}: which control? Name it as it appears on screen.` };
    }
    /* Текст обязателен там, где без него утверждение бессмысленно: «value_is» без значения не утверждает
     * ничего, а прошёл бы как утверждение. */
    if (['value_is', 'value_contains', 'text_is', 'text_contains', 'url_is', 'url_contains', 'count_is']
      .includes(check) && !text) {
      return { expects: [], why: `${at}: ${check} needs \`text\` - the value it must hold.` };
    }
    /* «Что это доказывает» - не украшение: это единственная строка, которую человек читает в красном
     * отчёте в девять утра. Утверждение без неё оставляет его с именем контрола и догадкой. */
    if (!why) {
      return { expects: [], why: `${at}: say what it proves, in the goal's own words - it is what somebody `
        + 'reads in the report.' };
    }
    expects.push({
      check, name, ...(text ? { text } : {}), ...(process ? { process } : {}), why,
      ...(after ? { after } : {}),
    });
  }
  return { expects, why: '' };
}

/** Одно утверждение словами - тем же порядком, в котором его написали. */
export const expectLine = (want) => {
  const one = want && typeof want === 'object' ? want : {};
  const check = str(one.check) || 'present';
  /* У проверки про страницу целиком имени нет, и пустые кавычки в цели («url_contains "" = "…"») читаются
   * как забытое поле - в том числе моделью, которая эту строку и выполняет. */
  const bits = [str(one.name) ? `${check} "${str(one.name)}"` : check];
  if (str(one.text)) bits.push(`= "${str(one.text)}"`);
  if (str(one.process)) bits.push(`in ${str(one.process)}`);
  return `${bits.join(' ')}${str(one.why) ? ` - ${str(one.why)}` : ''}`;
};

/**
 * Цель прогона кейса: та же цель скилла плюс проверки, которые обязаны быть сделаны в конце.
 *
 * СЛОВАМИ, А НЕ ПОЛЕМ. Утверждения могли бы ехать в цикл отдельным полем и превращаться в вызовы expect
 * механически, без модели. Они дописаны к цели, потому что в конце прогона машина находится там, куда её
 * привёл сам прогон: «Sent Items» может быть за одним щелчком, а может требовать открыть папку, и решить
 * это может только тот, кто видит экран. Модель обязана ВЫЗВАТЬ expect - в brain уже сказано, что проверку
 * решает машина, а не картинка, - и вердикт считается по записанным шагам, а не по словам модели. Соврать в
 * отчёте ей нечем.
 *
 * ДВЕ ГРУППЫ С 5-v2. У утверждения появилось поле `after` - момент, в который его надо проверить, а не
 * дожидаться конца. Пустое `after` - конец прогона, ровно как в v1, и старый кейс не меняет поведения.
 *
 * ПОЧЕМУ МОМЕНТ - ФРАЗА, А НЕ НОМЕР ЧЕКПОИНТА. План пункта 5 говорил «привязать к чекпоинтам плана», и это
 * оказалось невыполнимо в том виде: чекпоинты приходят параметром в browser-драйвер от мастера Create
 * (`checkpoints` в desktop-engine.ts), у СОХРАНЁННОГО скилла их нет вовсе, а облачный драйвер получает
 * `toolsFor(false, …)` - без reached_checkpoint, потому что чекпоинт останавливает прогон, а на том конце
 * никого нет. То есть номер чекпоинта у ночного кейса указывал бы в пустоту.
 *
 * Фраза не требует ничего: момент называет АВТОР КЕЙСА, а решает, наступил ли он, тот же, кто видит экран, -
 * так же, как он решает, где искать «Sent Items». Ни плана, ни изменений в драйверах, ни нового поля на
 * проводе.
 *
 * И ЧТО ЭТО НЕ СТАЛО СЛОВОМ БЕЗ ПОСЛЕДСТВИЙ: сделать все проверки в конце - другой тест, чем сделать их по
 * ходу («Sent Items» пуста до отправки и после неё же и проверяется). Поэтому `lateBound` считает
 * привязанные проверки, сделанные всё равно в конце, и отчёт их называет. Не вердиктом: одна запоздавшая
 * проверка не отменяет найденного дефекта - но и молчать о ней нельзя, иначе `after` был бы украшением.
 */
export function caseGoal(goal, expects) {
  const list = Array.isArray(expects) ? expects : [];
  if (!list.length) return String(goal || '');
  /* Нумерация СКВОЗНАЯ по всему списку, а не по группе: человек читает отчёт по номерам, и «проверка 3»
   * обязана значить третью в кейсе, независимо от того, в какой она группе оказалась. */
  const numbered = list.map((want, i) => ({ want, n: i + 1 }));
  const bound = numbered.filter((one) => str(one.want.after));
  const atEnd = numbered.filter((one) => !str(one.want.after));
  const said = (one) => `${one.n}. ${expectLine(one.want)}`;

  let out = `${String(goal || '')}\n\nTHIS IS A TEST CASE.`;

  if (bound.length) {
    out += '\n\nThese checks belong to a MOMENT in the work, not to the end of it. The moment is named; '
      + 'you decide when it has arrived, from the screen. Call the expect tool for a check the moment its own is '
      + 'true, BEFORE doing anything that comes after it - leaving them all to the end is a different test, '
      + 'because what you would be checking has moved on by then:\n'
      + bound.map((one) => `${said(one)}  [when: ${str(one.want.after)}]`).join('\n');
  }

  if (atEnd.length) {
    out += `\n\n${bound.length ? 'And these belong to the end' : 'When the goal above is done'}`
      + ', before finish - check every one of them with the expect tool, one call each, all of them, '
      + `even when the screen makes the answer look obvious:\n${atEnd.map(said).join('\n')}`;
  }

  return `${out}\n\n`
    + 'A failed check does not end the run: say what it means and finish. Do not decide any of them by '
    + 'looking at the picture, and do not skip one because the goal appeared to succeed - a check nobody '
    + 'made is the whole reason a suite stops being trusted.';
}

/**
 * ПРИВЯЗАННЫЕ ПРОВЕРКИ, СДЕЛАННЫЕ ВСЁ РАВНО В КОНЦЕ.
 *
 * Признак простой и считается по записанным шагам: проверка «на месте», если ПОСЛЕ неё в прогоне было хоть
 * одно действие, кроме проверки. Всё, за чем не последовало ничего кроме проверок и finish, сделано в конце.
 *
 * Сопоставление с кейсом - по (check, name, text): ровно те поля, которые модели и велено передать, и ровно
 * те, что печатает expectLine. Кейс с двумя одинаковыми утверждениями, различающимися только моментом, здесь
 * не различится - но такой кейс и человеку не различить, а значит это два кейса.
 *
 * ИМЯ ШАГА ЧИТАЕТСЯ КАК `tool || name`, И ЭТО НЕ ПЕРЕСТРАХОВКА: драйверов три, и пишут они по-разному -
 * облачный (api/_step.mjs) и браузерный (desktop-engine.ts) кладут `tool`, расширение (extension/agent.js)
 * кладёт `name`. Правило, прочитавшее одно поле, тихо считало бы ноль на веб-кейсах - то есть ровно там,
 * где проверок больше всего. Идиома та же, что в checksOf (extension/checks.js) и в api/chat.js.
 *
 * Отдельной функцией, а не внутри caseVerdict, потому что читателей два и им нужно разное: вердикт этим не
 * меняется (см. комментарий к caseGoal), а отчёт число называет.
 *
 * @param {unknown} steps шаги прогона: [{ name, input }]
 * @param {unknown} expects утверждения кейса
 * @returns {number} сколько привязанных проверок оказались в конце
 */
/** Имя шага, как его записал ЛЮБОЙ из трёх драйверов. См. lateBound. */
const named = (step) => str(step && (step.tool || step.name));

export function lateBound(steps, expects) {
  const want = (Array.isArray(expects) ? expects : []).filter((one) => one && str(one.after));
  if (!want.length) return 0;
  const list = Array.isArray(steps) ? steps : [];
  const key = (one) => `${str(one && one.check)}\u0000${str(one && one.name)}\u0000${str(one && one.text)}`;
  const bound = new Set(want.map(key));

  let late = 0;
  for (let i = 0; i < list.length; i++) {
    const step = list[i];
    if (!step || typeof step !== 'object' || named(step) !== 'expect') continue;
    if (!bound.has(key(step.input))) continue;
    /* Было ли ПОСЛЕ неё хоть одно действие, кроме проверки. finish действием не считается: прогон,
     * закончившийся проверкой и finish, сделал её в конце. */
    let acted = false;
    for (let k = i + 1; k < list.length; k++) {
      const next = list[k];
      const name = next && typeof next === 'object' ? named(next) : '';
      if (!name || name === 'expect' || name === 'finish') continue;
      acted = true;
      break;
    }
    if (!acted) late++;
  }
  return late;
}

/** Аргументы скилла без служебных ключей: скилл не знает и не должен знать, что его гоняет кейс. */
export function stripCase(args) {
  const out = {};
  for (const key of Object.keys(args && typeof args === 'object' ? args : {})) {
    if (key.startsWith('__')) continue;
    out[key] = args[key];
  }
  return out;
}

/** Id кейса из аргументов работы, если работа - прогон кейса. */
export function caseIdOf(args) {
  const it = args && typeof args === 'object' ? args[CASE_KEY] : null;
  const id = it && typeof it === 'object' ? str(it.id) : '';
  return id || null;
}

/* Шаги, которые починила модель. Пункт 4 плана помечает такой шаг сам; здесь считается по признаку, а не по
 * его отсутствию - «нет пометки» значит «не чинили», и это тот же случай, что отсутствующий флаг агента. */
export function repairsOf(steps) {
  let n = 0;
  for (const step of Array.isArray(steps) ? steps : []) {
    if (step && typeof step === 'object' && step.repaired) n++;
  }
  return n;
}

/**
 * Вердикт одного прогона кейса.
 *
 * ПОРЯДОК ПРОВЕРОК - ЭТО И ЕСТЬ ПРАВИЛО. Провал утверждения идёт ПЕРВЫМ, раньше «агент не довёл»: прогон,
 * в котором проверка не сошлась и после этого агент сдался, - это найденный дефект, а не потерянная ночь, и
 * спрятать его в blocked значило бы потерять единственное, ради чего всё это гоняется.
 */
export function caseVerdict(run) {
  const it = run && typeof run === 'object' ? run : {};
  const checks = it.checks && typeof it.checks === 'object' ? it.checks : null;
  const failed = checks ? Number(checks.failed) || 0 : 0;
  const passed = checks ? Number(checks.passed) || 0 : 0;
  const unchecked = checks ? Number(checks.unchecked) || 0 : 0;

  if (failed > 0) return 'fail';
  /* Не «ok» - вердикта о продукте нет. Сюда попадает и прогон, который ещё идёт. */
  if (it.outcome !== 'ok') return 'blocked';
  /* Прошло, но НИЧЕГО не утверждало, или утверждать не удалось. Зелёным это быть не может: кейс без
   * доказательства - это ровно тот ложный зелёный, против которого написан весь этот файл. */
  if (!passed || unchecked > 0) return 'blocked';
  /* Число ПОЧИНЕННЫХ ШАГОВ или сами шаги - смотря что есть у того, кто спрашивает. Перечень кейсов считает
   * его запросом (шаги прогона весят до сотен килобайт, и тащить их ради одного признака в список из
   * тридцати ночей значило бы качать мегабайты на страницу), а один раскрытый прогон уже держит шаги в
   * руках. Одно правило, два входа - иначе список и раскрытая строка однажды скажут разное. */
  const repairs = Number.isFinite(Number(it.repairs)) && it.repairs != null
    ? Number(it.repairs) : repairsOf(it.steps);
  if (repairs > 0) return 'pass_with_repairs';
  return 'pass';
}

/* Слова вердикта - одни для страницы, для тула и для отчёта. `word` короткое, для чипа; `why` - строка,
 * которую человек читает, когда хочет знать, что это значит. */
export const VERDICTS = {
  pass: { word: 'passed', why: 'the procedure ran and every check held' },
  pass_with_repairs: {
    word: 'passed · repaired',
    why: 'every check held, but the model had to repair a step - a case that needs repairing is not yet '
      + 'stable enough to trust unattended',
  },
  fail: { word: 'failed a check', why: 'the run finished and something that must be true was not' },
  blocked: {
    word: 'no verdict',
    why: 'nothing was proven about the product: the run did not finish, or a check could not be evaluated, '
      + 'or it made none',
  },
};

/** Вердикт словами. Неизвестное имя отвечает своим именем, а не «pass». */
export const verdictSaid = (verdict) =>
  (VERDICTS[verdict] ? `${VERDICTS[verdict].word} - ${VERDICTS[verdict].why}` : String(verdict || 'unknown'));

/** Сводка по прогонам кейса: сколько чего. Считает один раз тот, кто их и так прочитал. */
export function tallyOf(verdicts) {
  const out = { pass: 0, pass_with_repairs: 0, fail: 0, blocked: 0 };
  for (const one of Array.isArray(verdicts) ? verdicts : []) {
    if (out[one] === undefined) continue;
    out[one]++;
  }
  return out;
}

/* ------------------------------------------------------------------ РАЗОВЫЙ ПРОГОН С ПРОВЕРКАМИ
 *
 * ЗАЧЕМ (владелец, 2026-09-28). Кейсы, которые хранятся здесь, - это один случай. Второй: кейсы живут в
 * чужой системе учёта (TestRail и подобные), и ассистент, подключённый к обеим, говорит нам «выполни это и
 * скажи, прошло ли». Держать у себя копию такого кейса значило бы завести второй источник правды, который
 * разойдётся с первым после первой же правки там. Поэтому у mouseflow_do есть проверки БЕЗ кейса: цель,
 * утверждения и чужой номер на входе, вердикт и то, что не сошлось, на выходе - и ничего не сохраняется.
 *
 * ТЕ ЖЕ ПРАВИЛА, А НЕ ВТОРАЯ ИХ РЕДАКЦИЯ: утверждения разбирает readExpects, цель с проверками
 * составляет caseGoal, вердикт считает caseVerdict. Отличается только то, где лежат утверждения: у кейса -
 * в user_case, у разового прогона - в аргументах работы, под служебными ключами (двойное подчёркивание, как
 * CASE_KEY), которые stripCase снимает прежде, чем они дойдут до чего-нибудь ещё. */

/** Утверждения разового прогона - в аргументах работы, а не в строке кейса. */
export const EXPECT_KEY = '__expect';

/** Чужой номер (например, «C1234» из TestRail): приехал с просьбой и уезжает с ответом, ничего не значит здесь. */
export const REF_KEY = '__ref';

/* ГДЕ ЛЕЖИТ ЗАПИСЬ ПРОГОНА, если не под id работы. Облачный драйвер пишет user_run под id работы; расширение -
 * под своим 'run_<startedAt>' (им же подписаны кадры, см. extension/background.js), и сообщает его в отчёте.
 * Без этой ссылки вердикт браузерного прогона было бы не из чего считать. */
export const RUN_KEY = '__run';

/* Длина чужого номера. Это номер, а не описание: сто двадцать знаков вмещают «TestRail C123456 · run 42»
 * и не вмещают абзац, который следовало положить в цель. */
export const REF_MAX = 120;

/** Утверждения разового прогона, или null, если их не просили. */
export function expectsOf(args) {
  const list = args && typeof args === 'object' ? args[EXPECT_KEY] : null;
  return Array.isArray(list) && list.length ? list : null;
}

/** Чужой номер из аргументов работы, или null. */
export function refOf(args) {
  const ref = args && typeof args === 'object' ? str(args[REF_KEY]) : '';
  return ref ? ref.slice(0, REF_MAX) : null;
}

/** Под каким id лежит запись прогона этой работы. */
export function runIdOf(jobId, args) {
  const run = args && typeof args === 'object' ? str(args[RUN_KEY]) : '';
  return run || String(jobId || '');
}

/**
 * Отчёт о разовом прогоне с проверками - словами, которые ассистент перенесёт в чужую систему учёта.
 *
 * КАЖДАЯ ПРОВЕРКА ОТДЕЛЬНОЙ СТРОКОЙ, и сошедшиеся тоже. У кейса в TestRail ожидаемый результат обычно не один,
 * и отчёт «1 из 3 не сошлась» без того, какая именно, заставил бы угадывать, какой шаг там пометить красным.
 *
 * НЕТ ЗАПИСИ - НЕТ ВЕРДИКТА, а не «прошло». Прогон мог кончиться раньше, чем запись доехала, или не доехать
 * вовсе (старое расширение не присылает, где она); тогда отчёт говорит это и называет исход работы как есть.
 *
 * @param {{ ok?: boolean|null, said?: string|null, ref?: string|null, run?: {
 *   outcome?: string|null, checks?: object|null, steps?: unknown } | null, asked?: unknown }} it
 * @returns {{ verdict: string, text: string }}
 */
export function checkedReport(it) {
  const run = it && it.run && typeof it.run === 'object' ? it.run : null;
  const asked = Array.isArray(it && it.asked) ? it.asked : [];
  const head = [];
  if (it && it.ref) head.push(`Ref: ${it.ref}`);

  if (!run) {
    head.push(`Verdict: ${verdictSaid('blocked')}.`,
      'The record of this run did not reach the account, so no check can be read from it. '
        + (it && it.ok ? 'The run itself reported success - that is not a verdict.' : 'The run did not succeed.'));
    if (it && it.said) head.push(`It said: ${it.said}`);
    return { verdict: 'blocked', text: head.join('\n') };
  }

  const made = (Array.isArray(run.steps) ? run.steps : [])
    .filter((step) => step && typeof step === 'object' && named(step) === 'expect' && step.outcome);
  /* ПРОСИЛИ БОЛЬШЕ, ЧЕМ СДЕЛАНО - и это не зелёный. caseVerdict видит только сделанные: несделанная
   * проверка не попадает даже в `unchecked`, и прогон, проверивший одно из трёх, читался бы полным pass.
   * Провал при этом остаётся провалом - найденный дефект не прячется за тем, что проверили не всё. */
  const skipped = Math.max(0, asked.length - made.length);
  const judged = caseVerdict({ outcome: run.outcome, checks: run.checks, steps: run.steps });
  const verdict = skipped && (judged === 'pass' || judged === 'pass_with_repairs') ? 'blocked' : judged;
  head.push(`Verdict: ${verdictSaid(verdict)}.`);
  if (it && it.said) head.push(`It said: ${it.said}`);

  const lines = made.map((step) => {
    const word = step.outcome.pass === true ? 'held'
      : step.outcome.pass === false ? 'DID NOT HOLD' : 'could not be checked';
    const evidence = str(step.outcome.evidence);
    return `  ${word}: ${expectLine(step.input || {})}${evidence ? ` -> ${evidence}` : ''}`
      + `${step.outcome.how ? ` (${step.outcome.how})` : ''}`;
  });
  if (lines.length) head.push('Checks:', ...lines);

  if (skipped) {
    head.push(`${skipped} of the ${asked.length} checks asked for ${skipped === 1 ? 'was' : 'were'} never made.`);
  }
  const late = lateBound(run.steps, asked);
  if (late > 0) {
    head.push(`${late} check${late === 1 ? '' : 's'} bound to a moment ${late === 1 ? 'was' : 'were'} made at `
      + 'the end anyway, so this ran as a weaker test than it says.');
  }
  return { verdict, text: head.join('\n') };
}
