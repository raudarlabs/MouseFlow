/* Вердикт кейса - вычислением, потому что читать его глазами уже нечестно.
 *
 * ЗДЕСЬ ОДНА ВАЖНАЯ ПРОВЕРКА, и остальные вокруг неё: НИ ОДИН ПРОГОН БЕЗ ДОКАЗАТЕЛЬСТВА НЕ ЗЕЛЁНЫЙ. Прогон,
 * который дошёл до finish ok:true и не сделал ни одной проверки, - самый вероятный способ получить ложный
 * зелёный в этом продукте: модель говорит «сделал», кейс говорит «passed», и ночь за ночью отчёт светится,
 * ничего не проверяя. Поэтому таких случаев здесь больше, чем прошедших.
 *
 * И вторая: ПРОВАЛ ПРОВЕРКИ НЕ ПРЯЧЕТСЯ ЗА «агент не довёл». Дефект, найденный в прогоне, который потом
 * сдался, - это дефект, а не потерянная ночь.
 *
 * Run: node api/_test-case.mjs
 */
/* CRLF НОРМАЛИЗУЕТСЯ ПРИ ЧТЕНИИ. На Windows рабочая копия приходит с \r\n, а пины написаны с \n:
 * многострочный пин тогда не находит того, что стережёт, а одностроч­ный проходит, перестав проверять.
 * Та же идиома, что в agent/test-contract.mjs, mcp/test-mcp.mjs и extension/check-extension.mjs. */
import { readFileSync } from 'node:fs';
import {
  CASE_KEY, EXPECTS_MAX, VERDICTS, caseGoal, caseIdOf, caseVerdict, expectLine, lateBound, readExpects,
  repairsOf, stripCase, tallyOf, verdictSaid,
} from './_case.mjs';
import { checksOnSkill, procedureWith, seedFrom } from './_procedure.mjs';

let pass = 0;
let fail = 0;
const check = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  -> ' + detail : '')); }
};
const group = (t) => console.log('\n' + t);

const checks = (passed, failed = 0, unchecked = 0) => ({ passed, failed, unchecked, tiers: {} });

group('ПРОГОН БЕЗ ДОКАЗАТЕЛЬСТВА НЕ ЗЕЛЁНЫЙ - ни одним путём');
{
  check('finish ok:true и ни одной проверки - это «вердикта нет», а не «прошло»',
    caseVerdict({ outcome: 'ok', checks: null, steps: [] }) === 'blocked',
    caseVerdict({ outcome: 'ok', checks: null, steps: [] }));
  check('и пустая сводка проверок - тоже',
    caseVerdict({ outcome: 'ok', checks: checks(0), steps: [] }) === 'blocked');
  check('проверка, которую НЕ УДАЛОСЬ сделать, зелёным не считается',
    caseVerdict({ outcome: 'ok', checks: checks(2, 0, 1) }) === 'blocked',
    caseVerdict({ outcome: 'ok', checks: checks(2, 0, 1) }));
  check('всё непроверяемо - тем более',
    caseVerdict({ outcome: 'ok', checks: checks(0, 0, 3) }) === 'blocked');
  check('а вот две сошлись и ничего не осталось - это единственный зелёный',
    caseVerdict({ outcome: 'ok', checks: checks(2) }) === 'pass');
}

group('ПРОВАЛ ПРОВЕРКИ ИДЁТ ПЕРВЫМ - его не заслоняет ничто');
{
  check('прошло и одна не сошлась - это дефект продукта',
    caseVerdict({ outcome: 'ok', checks: checks(3, 1) }) === 'fail');
  check('агент сдался ПОСЛЕ провала - всё равно дефект, а не потерянная ночь',
    caseVerdict({ outcome: 'failed', checks: checks(1, 1) }) === 'fail',
    caseVerdict({ outcome: 'failed', checks: checks(1, 1) }));
  check('человек остановил после провала - тоже дефект',
    caseVerdict({ outcome: 'stopped', checks: checks(0, 1) }) === 'fail');
  check('и починка не отменяет провала',
    caseVerdict({ outcome: 'ok', checks: checks(1, 1), steps: [{ repaired: true }] }) === 'fail');
}

group('а «не довёл» - это blocked, и это не красный');
{
  check('упал без проверок', caseVerdict({ outcome: 'failed', checks: null }) === 'blocked');
  check('остановлен человеком', caseVerdict({ outcome: 'stopped', checks: checks(2) }) === 'blocked');
  check('ещё идёт', caseVerdict({ outcome: 'running', checks: null }) === 'blocked');
  check('и прогон, которого нет вовсе', caseVerdict(null) === 'blocked');
}

group('починенный шаг виден отдельно - место для пункта 4 плана');
{
  check('шаг с пометкой считается',
    repairsOf([{ tool: 'click' }, { tool: 'click', repaired: true }]) === 1);
  check('без пометки - не считается (отсутствие это не «чинили»)',
    repairsOf([{ tool: 'click' }, { tool: 'type' }]) === 0);
  check('мусор вместо шагов ничего не ломает', repairsOf('нет') === 0 && repairsOf(null) === 0);
  check('прошло с починкой - свой вердикт, не pass',
    caseVerdict({ outcome: 'ok', checks: checks(2), steps: [{ repaired: true }] }) === 'pass_with_repairs');
  check('и сегодня так не помечается ни один прогон - вердикт дремлет',
    caseVerdict({ outcome: 'ok', checks: checks(2), steps: [{ tool: 'click' }] }) === 'pass');
  /* Список кейсов не тащит шаги - он спрашивает у базы одно число. Правило обязано быть одним. */
  check('готовое число починок читается вместо шагов',
    caseVerdict({ outcome: 'ok', checks: checks(2), repairs: 1 }) === 'pass_with_repairs');
  check('и ноль починок - это pass, а не «нет данных»',
    caseVerdict({ outcome: 'ok', checks: checks(2), repairs: 0 }) === 'pass');
  check('строка «2» из драйвера базы тоже число',
    caseVerdict({ outcome: 'ok', checks: checks(2), repairs: '2' }) === 'pass_with_repairs');
}

group('четыре вердикта - четыре РАЗНЫХ слова, иначе отчёт нечитаем');
{
  const words = Object.values(VERDICTS).map((v) => v.word);
  check('их четыре', words.length === 4, words.join(', '));
  check('и все различны', new Set(words).size === 4, words.join(', '));
  check('у каждого сказано, что это значит',
    Object.values(VERDICTS).every((v) => v.why && v.why.length > 20));
  check('«blocked» не называется провалом ни одним словом',
    !/fail/i.test(VERDICTS.blocked.word) && !/^the product/i.test(VERDICTS.blocked.why),
    VERDICTS.blocked.word);
  check('а fail говорит про продукт, а не про агента', /check/.test(VERDICTS.fail.word));
  check('вердикт словами склеивается', verdictSaid('fail').startsWith('failed a check - '));
  check('незнакомое имя отвечает собой, а не зелёным', verdictSaid('nonsense') === 'nonsense');
}

group('сводка по прогонам');
{
  const t = tallyOf(['pass', 'pass', 'fail', 'blocked', 'nonsense']);
  check('считает по видам', t.pass === 2 && t.fail === 1 && t.blocked === 1, JSON.stringify(t));
  check('и не выдумывает вид', t.pass_with_repairs === 0);
}

group('утверждения проверяются на входе - одинаково для страницы и для тула');
{
  check('пустой список отвергается словами про ложный зелёный',
    readExpects([]).why.includes('proven nothing'), readExpects([]).why);
  check('больше потолка - отказ называет число',
    readExpects(new Array(EXPECTS_MAX + 1).fill({ check: 'present', name: 'x', why: 'y' }))
      .why.includes(String(EXPECTS_MAX)));
  check('неизвестный вид проверки перечисляет известные',
    readExpects([{ check: 'looks_right', name: 'Save', why: 'x' }]).why.includes('value_contains'));
  check('без имени контрола - отказ',
    readExpects([{ check: 'present', name: ' ', why: 'x' }]).why.includes('which control'));
  check('value_is без значения - отказ, а не утверждение ни о чём',
    readExpects([{ check: 'value_is', name: 'Subject', why: 'x' }]).why.includes('needs `text`'));
  check('без «что это доказывает» - отказ: это единственное, что читают в красном отчёте',
    readExpects([{ check: 'present', name: 'Save', why: '' }]).why.includes('what it proves'));
  const good = readExpects([
    { check: 'present', name: 'Sent Items', why: 'the reply left the outbox', extra: 'ignored' },
    { check: 'value_contains', name: 'Subject', text: 'Re: invoice', process: 'OUTLOOK', why: 'the right one' },
  ]);
  check('годный список принимается', good.why === '' && good.expects.length === 2, good.why);
  check('и в нём остаются только известные поля',
    Object.keys(good.expects[0]).join(',') === 'check,name,why', Object.keys(good.expects[0]).join(','));
  check('а пустой text не превращается в поле',
    good.expects[0].text === undefined && good.expects[1].text === 'Re: invoice');
}

group('цель кейса - цель скилла плюс проверки словами');
{
  const goal = caseGoal('reply to Ann that the invoice is approved', [
    { check: 'present', name: 'Sent Items', why: 'the reply left the outbox' },
    { check: 'value_contains', name: 'Subject', text: 'Re: invoice', why: 'the right thread' },
  ]);
  check('цель осталась целиком', goal.startsWith('reply to Ann that the invoice is approved'));
  check('проверки пронумерованы', goal.includes('1. present "Sent Items"') && goal.includes('2. value_contains "Subject" = "Re: invoice"'));
  check('сказано, чем их делать - тулом, а не глазами',
    /with the expect tool/.test(goal) && /not decide any of them by looking/.test(goal));
  check('и что провал не повод бросить прогон', /does not end the run/.test(goal));
  check('и что пропустить проверку нельзя, даже если и так видно', /do not skip one/.test(goal));
  check('без утверждений цель не меняется вовсе',
    caseGoal('just do it', []) === 'just do it' && caseGoal('just do it', null) === 'just do it');
  check('одно утверждение словами читается как утверждение',
    expectLine({ check: 'absent', name: 'Error', process: 'OUTLOOK', why: 'nothing broke' })
      === 'absent "Error" in OUTLOOK - nothing broke');
  /* У проверки про страницу целиком имени нет: пустые кавычки читаются как забытое поле - в том числе
   * моделью, которой эту строку и выполнять. */
  check('а у проверки про страницу целиком имени нет, и пустых кавычек тоже',
    expectLine({ check: 'url_contains', name: '', text: 'example.com', why: 'the tab went there' })
      === 'url_contains = "example.com" - the tab went there',
    expectLine({ check: 'url_contains', name: '', text: 'example.com', why: 'the tab went there' }));
}

group('служебный ключ не доезжает до скилла');
{
  const args = { who: 'Ann', [CASE_KEY]: { id: 'case_1' }, __other: 1 };
  check('id кейса читается из аргументов', caseIdOf(args) === 'case_1');
  check('а из обычных аргументов - нет', caseIdOf({ who: 'Ann' }) === null);
  check('мусор под ключом не становится id',
    caseIdOf({ [CASE_KEY]: 'case_1' }) === null && caseIdOf({ [CASE_KEY]: { id: '  ' } }) === null);
  const clean = stripCase(args);
  check('скилл получает только свои аргументы',
    Object.keys(clean).join(',') === 'who' && clean.who === 'Ann', Object.keys(clean).join(','));
  check('и ничего не ломается на мусоре', Object.keys(stripCase(null)).length === 0);
}

group('МОМЕНТ ПРОВЕРКИ - 5-v2: часть утверждений проверяется по ходу, а не в конце');
{
  /* ПОЧЕМУ ФРАЗА, А НЕ НОМЕР ЧЕКПОИНТА, написано в _case.mjs: у сохранённого скилла плана нет, а
   * облачный драйвер получает toolsFor(false) - без reached_checkpoint, потому что чекпоинт
   * останавливает прогон, а на том конце никого. Номер указывал бы в пустоту. */
  const bound = { check: 'present', name: 'Sent Items', why: 'the reply left the outbox',
    after: 'the message has been sent' };
  const atEnd = { check: 'value_is', name: 'Subject', text: 'Re: hi', why: 'it kept the subject' };
  const kinds = ['present', 'value_is'];

  const read = readExpects([bound, atEnd], kinds);
  check('момент принимается и сохраняется', read.expects[0].after === 'the message has been sent',
    JSON.stringify(read.expects[0]));
  check('а без момента поля нет вовсе - отсутствие остаётся отсутствием',
    !('after' in read.expects[1]), JSON.stringify(read.expects[1]));
  /* СТАРЫЙ КЕЙС НЕ МЕНЯЕТ ПОВЕДЕНИЯ: v1 писал утверждения без момента, и они по-прежнему в конце. */
  const v1 = caseGoal('Reply to Ann', [atEnd]);
  check('кейс без моментов не упоминает их ни словом',
    !/MOMENT|when:/.test(v1) && /When the goal above is done/.test(v1), v1.slice(0, 120));

  const goal = caseGoal('Reply to Ann', read.expects);
  check('в цели две группы, и обе названы',
    /belong to a MOMENT/.test(goal) && /And these belong to the end/.test(goal));
  check('момент напечатан рядом со своим утверждением',
    /1[.] present "Sent Items".*\[when: the message has been sent\]/.test(goal),
    (goal.match(/^1[.].*$/m) || [])[0]);
  /* НУМЕРАЦИЯ СКВОЗНАЯ. «Проверка 2» в отчёте обязана значить вторую В КЕЙСЕ, а не вторую в группе -
   * иначе красная строка отчёта указывает не на то утверждение, которое не сошлось. */
  check('нумерация сквозная по кейсу, а не по группе',
    /^2[.] value_is "Subject"/m.test(goal), (goal.match(/^2[.].*$/m) || [])[0]);
  /* И МОДЕЛИ СКАЗАНО, ЧТО ОТЛОЖИТЬ ИХ НА КОНЕЦ - ДРУГОЙ ТЕСТ. Без этой фразы `after` был бы намёком. */
  check('и сказано, почему нельзя отложить на конец',
    /leaving them all to the end is a different test/.test(goal));

  /* ВСЕ УТВЕРЖДЕНИЯ ПРИВЯЗАНЫ - тогда группы конца нет, и фраза про конец не печатается. */
  const allBound = caseGoal('Reply to Ann', readExpects([bound], kinds).expects);
  check('кейс целиком из привязанных не выдумывает группу конца',
    /belong to a MOMENT/.test(allBound) && !/belong to the end/.test(allBound));
}

group('И ПРИВЯЗКА НЕ СЛОВО БЕЗ ПОСЛЕДСТВИЙ: проверка, сделанная всё равно в конце, посчитана');
{
  /* Сделать все проверки в конце - другой тест, чем сделать их по ходу: «Sent Items» пуста до отправки
   * и после неё же и проверяется. Признак: за проверкой «на месте» следует хоть одно ДЕЙСТВИЕ. */
  const expects = [
    { check: 'present', name: 'Sent Items', why: 'x', after: 'the message has been sent' },
    { check: 'value_is', name: 'Subject', text: 'Re: hi', why: 'y' },
  ];
  const step = (name, input = {}) => ({ name, input });
  const sent = { check: 'present', name: 'Sent Items' };
  const subj = { check: 'value_is', name: 'Subject', text: 'Re: hi' };

  check('за привязанной проверкой было действие - она на месте',
    lateBound([step('click'), step('expect', sent), step('click'), step('expect', subj),
      step('finish')], expects) === 0);
  check('а если после неё только проверки и finish - она в конце',
    lateBound([step('click'), step('expect', sent), step('expect', subj), step('finish')],
      expects) === 1);
  /* finish ДЕЙСТВИЕМ НЕ СЧИТАЕТСЯ: прогон, кончившийся проверкой и finish, сделал её в конце. */
  check('finish не спасает проверку от «в конце»',
    lateBound([step('click'), step('expect', sent), step('finish')], expects) === 1);
  /* НЕПРИВЯЗАННЫЕ НЕ СЧИТАЮТСЯ НИКОГДА: их место - конец, это и есть их правило. */
  check('проверка без момента в счёт не идёт',
    lateBound([step('expect', subj), step('finish')], [expects[1]]) === 0);
  check('и кейс без моментов не считается вовсе',
    lateBound([step('expect', subj), step('finish')], []) === 0);
  check('мусор на входе отвечает нулём, а не падает',
    lateBound(null, expects) === 0 && lateBound([], null) === 0);

  /* И ВЕРДИКТ ЭТИМ НЕ МЕНЯЕТСЯ. Одна запоздавшая проверка не отменяет найденного дефекта и не красит
   * зелёное в серое: отчёт число называет, вердикт считается по доказательствам. */
  check('вердикт от запоздавшей проверки не меняется',
    caseVerdict({ outcome: 'ok', checks: checks(2), steps: [] }) === 'pass');
}

group('КРУГ МЕЖДУ КЕЙСОМ И СКИЛЛОМ - чеки едут туда и обратно (SPLIT-PLAN §9, шаг 1b)');
{
  const expect = (why) => ({ check: 'text_contains', name: 'Status', text: 'Sent', why });
  const withProcedure = (verification) => ({
    client_id: 'sk1', name: 'Send it', kind: 'created', source: 'desktop',
    payload: { procedure: { whenToUse: 'w', steps: [{ name: 'Click Send' }], pitfalls: [], verification } },
  });

  /* СВОИ ЧЕКИ ВАЖНЕЕ ЧУЖИХ. Автор кейса, написавший проверки, не должен получить вместо них те, что
   * лежали на скилле. */
  const mine = [expect('mine')];
  const own = seedFrom(mine, withProcedure([expect('skill')]));
  check('переданные чеки не подменяются теми, что на скилле',
    own.seeded === false && own.list === mine, JSON.stringify(own.seeded));

  /* НЕ ДАЛИ - БЕРЁМ СО СКИЛЛА. Это и есть половина круга: автор второго кейса начинает не с нуля. */
  const sown = seedFrom(undefined, withProcedure([expect('skill')]));
  check('своих нет - берутся чеки скилла', sown.seeded === true && sown.list.length === 1,
    JSON.stringify(sown));
  /* Пустой список - это тоже «не дали»: передать [] и получить отказ, когда на скилле чеки лежат, - два
   * разных ответа на один вопрос. */
  check('и пустой список считается «не дали», а не «дали ноль»',
    seedFrom([], withProcedure([expect('skill')])).seeded === true);

  check('на скилле пусто - сеять нечего, и отказ остаётся прежним',
    seedFrom([], withProcedure([])).seeded === false);
  check('и у скилла без процедуры - тоже',
    seedFrom([], { payload: {} }).seeded === false && checksOnSkill({ payload: {} }).length === 0);

  /* ПОСЕЯННОЕ ПРОХОДИТ ТОГО ЖЕ СУДЬЮ. Скилл с испорченным чеком отвергается теми же словами, что и
   * написанный руками, - иначе на скилле можно было бы пронести то, чего дверь не принимает. */
  const rotten = seedFrom([], withProcedure([{ check: 'text_contains', name: 'S', text: 'x' }]));
  check('посеянное судит readExpects, а не доверие к скиллу',
    !!readExpects(rotten.list, ['text_contains']).why,
    readExpects(rotten.list, ['text_contains']).why.slice(0, 50));

  /* ОБРАТНАЯ ПОЛОВИНА: чеки ложатся в процедуру, и только туда. */
  const after = procedureWith(withProcedure([]).payload, [expect('written')]);
  check('чеки записываются в procedure.verification',
    after.procedure.verification.length === 1 && after.procedure.verification[0].why === 'written',
    JSON.stringify(after.procedure.verification));
  /* Защищённо: мутация, выкидывающая steps, иначе роняет тест на `.length` - то есть ровно тогда, когда
   * он должен краснеть, он уносит с собой всё, что ниже. */
  const proc = (after && after.procedure) || {};
  check('и остальная процедура не трогается',
    Array.isArray(proc.steps) && proc.steps.length === 1 && proc.whenToUse === 'w',
    JSON.stringify(Object.keys(proc)));
  /* Скиллу без процедуры сочинять её здесь нельзя: это было бы второе мнение о том, что он делает. */
  check('скиллу без процедуры процедура не сочиняется',
    procedureWith({ goalTemplate: 'x' }, [expect('written')]) === null,
    JSON.stringify(procedureWith({ goalTemplate: 'x' }, [expect('written')])));
  check('и процедура с пустыми шагами процедурой не считается',
    procedureWith({ procedure: { steps: [] } }, [expect('w')]) === null);

  /* И ХЕНДЛЕР ЗОВЁТ ИМЕННО ЭТИ ДВЕ - функция, которую никто не зовёт, это то же самое, что её нет. */
  const src = readFileSync(new URL('./cases.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  check('создание кейса сеет через seedFrom', /const sow = seedFrom\(body\.expects, found\.skill\);/.test(src));
  check('и судит посеянное тем же readExpects', /readExpects\(sow\.list,/.test(src));
  /* Посеянное обратно не пишется: оно оттуда и пришло, а запись сдвинула бы updated_at ни за чем. */
  check('посеянное обратно не записывается',
    /const kept = seeded \? true\s*\n\s*: await keepChecksOnSkill\(/.test(src));
  /* Правка чеков - ровно тот момент, когда скиллу стоит их узнать. */
  check('правка кейса тоже пишет чеки на скилл',
    /kept = on\.skill\s*\n\s*\? await keepChecksOnSkill\(sql, userId, rows\[0\]\.flow_id, on\.skill\.payload, expects\)/
      .test(src));
  /* Неудача записи не отменяет кейс и не притворяется успехом. */
  check('и обе половины названы в ответе, а не подразумеваются',
    /seededFromSkill: seeded,/.test(src) && /checksKeptOnSkill: kept,/.test(src));

  /* ДВЕ ДВЕРИ, ОДНО ПОВЕДЕНИЕ. Дверь, которая сеет, и дверь, которая не сеет, - это два разных
   * представления о том, что такое кейс, ровно как и два разных судьи. */
  /* Каталог тулов, а не mcp.js: половины разъехались по файлам на шаге 2 (SPLIT-PLAN §4.2), и дверь
   * тула теперь живёт здесь. */
  const mcp = readFileSync(new URL('./_mcp-tools.mjs', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  check('и тул сеет той же функцией, что страница',
    /const sow = seedFrom\(args && args\.expects, entry\);/.test(mcp)
      && /readExpects\(sow\.list, checksFor\(on\)\)/.test(mcp));
  check('и тоже пишет чеки обратно на скилл',
    /const payload = procedureWith\(entry\.payload, read\.expects\);/.test(mcp));
  check('и обе двери берут эти функции из одного модуля, а не друг у друга',
    /from '\.\/_procedure\.mjs'/.test(mcp) && /from '\.\/_procedure\.mjs'/.test(src));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exitCode = fail ? 1 : 0;
