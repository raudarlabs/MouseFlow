/* Дверь мессенджера, проверенная исполнением — SPLIT-PLAN §7.2, шаг 14a.
 *
 * ПОЧЕМУ ИМЕННО ЭТИ ПРОВЕРКИ. За сообщением в чате стоит настоящая мышь, и ошибиться здесь можно ровно
 * тремя способами: обслужить того, кого не знаешь; сделать из одного нажатия два прогона; запустить без
 * плана. Все три - про решение, а не про сеть, поэтому они выполняются, а не вычитываются.
 *
 * Run: node api/_test-telegram.mjs
 */
/* CRLF НОРМАЛИЗУЕТСЯ ПРИ ЧТЕНИИ. На Windows рабочая копия приходит с \r\n, а пины написаны с \n:
 * многострочный пин тогда не находит того, что стережёт, а одностроч­ный проходит, перестав проверять.
 * Та же идиома, что в agent/test-contract.mjs, mcp/test-mcp.mjs и extension/check-extension.mjs. */
import { readFileSync } from 'node:fs';

import {
  tagFor, tagIn,
  CHANNEL, DRAFT_TTL_MS, SAY, commandOf, draftId, expired, keyboardFor, looksLikeDeviceToken,
  outcomeMessage, planMessage, refusedDocument, routeOf, updateOf, verdictOf,
} from './_telegram.mjs';

let pass = 0;
let fail = 0;
const check = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  -> ' + detail : '')); }
};
const group = (t) => console.log('\n' + t);

const dm = (text, extra = {}) => ({
  message: {
    message_id: 7, from: { id: 42 }, chat: { id: 42, type: 'private' }, text, ...extra,
  },
});
const allowed = { state: 'allowed', user_id: 'u-1' };

group('что приехало: правленое сообщение НИКОГДА не отвечает');
{
  /* Правило openclaw, и оно не косметическое: телеграм шлёт правку отдельным полем, и обслужить её значит
   * запустить работу заново, когда человек поправил опечатку в позавчерашней просьбе. */
  const edited = updateOf({ edited_message: { chat: { id: 1 }, text: 'do it' } });
  check('правка - ignored', edited.kind === 'ignored');
  check('и причина названа, а не молчание', /edited/.test(edited.why || ''), edited.why);
  check('правка в канале - тоже', updateOf({ edited_channel_post: {} }).kind === 'ignored');
  check('пустое обновление - ignored с причиной',
    updateOf({}).kind === 'ignored' && !!updateOf({}).why);
  check('мусор вместо тела не бросает', updateOf(null).kind === 'ignored');
}

group('что приехало: сообщение, документ и нажатие');
{
  const m = updateOf(dm('send the invoices'));
  check('сообщение разобрано', m.kind === 'message' && m.text === 'send the invoices');
  check('отправитель - идентификатор, и он строка', m.senderId === '42' && typeof m.senderId === 'string');
  check('чат и его род названы', m.chatId === '42' && m.chatType === 'private');

  /* Подпись под документом - это и есть просьба: человек пишет её над файлом, а не отдельным сообщением. */
  const withDoc = updateOf(dm('', {
    text: undefined, caption: 'use this list',
    document: { file_id: 'F1', file_name: 'list.csv', file_size: 1200, mime_type: 'text/csv' },
  }));
  check('подпись читается как текст', withDoc.text === 'use this list');
  check('документ разобран', withDoc.document && withDoc.document.fileId === 'F1'
    && withDoc.document.name === 'list.csv' && withDoc.document.bytes === 1200);

  const cb = updateOf({
    callback_query: { id: 'c1', from: { id: 42 }, data: 'ok:dabc', message: { message_id: 9, chat: { id: 42, type: 'private' } } },
  });
  check('нажатие разобрано', cb.kind === 'callback' && cb.data === 'ok:dabc' && cb.callbackId === 'c1');
  check('и сообщение, под которым кнопка, тоже - клавиатуру с него снимать', cb.messageId === 9);
}

group('команды: суффикс с именем бота не ломает узнавание');
{
  check('простая', JSON.stringify(commandOf('/status')) === JSON.stringify({ name: 'status', rest: '' }));
  check('с аргументом', commandOf('/pair mf_abc12345').rest === 'mf_abc12345');
  /* В группах телеграм дописывает @имя_бота. Команда, не узнавшая себя из-за суффикса, отвечает «не
   * понял» там, где человек всё сделал правильно. */
  check('с именем бота', commandOf('/status@mouse_bot').name === 'status');
  check('регистр не важен', commandOf('/STATUS').name === 'status');
  check('обычный текст - не команда', commandOf('do the thing') === null);
  check('дробь посреди фразы - не команда', commandOf('use a/b testing') === null);
  check('пусто - не команда', commandOf('') === null && commandOf(null) === null);
}

group('токен устройства узнаётся по форме, а подлинность решает база');
{
  check('наш префикс', looksLikeDeviceToken('mf_abcdefgh12345'));
  check('чужая строка - нет', !looksLikeDeviceToken('hello there'));
  check('слишком короткий - нет', !looksLikeDeviceToken('mf_abc'));
  check('пробел внутри - нет', !looksLikeDeviceToken('mf_abcdefgh 12345'));
}

group('НЕЗНАКОМЦА СПАРИВАЮТ, А НЕ ОБСЛУЖИВАЮТ - четыре состояния');
{
  /* Впервые вижу. */
  check('без строки вовсе - приветствие, а не работа',
    routeOf({ row: null, update: updateOf(dm('empty my inbox')) }).act === 'greet');
  /* Спаривается, но ещё не спарен. */
  check('состояние pairing - то же самое',
    routeOf({ row: { state: 'pairing', user_id: null }, update: updateOf(dm('empty my inbox')) }).act === 'greet');
  /* И КОМАНДЫ ТОЖЕ: /status, ответивший незнакомцу, рассказал бы о чужой машине. */
  check('и на /status незнакомцу - приветствие',
    routeOf({ row: null, update: updateOf(dm('/status')) }).act === 'greet');
  check('и на нажатие кнопки незнакомцем - тоже',
    routeOf({ row: null, update: updateOf({ callback_query: { id: 'c', from: { id: 9 }, data: 'ok:d1', message: { message_id: 1, chat: { id: 9, type: 'private' } } } }) }).act === 'greet');

  /* Заблокирован - МОЛЧАНИЕ. Ответ «вам нельзя» подтверждает, что бот жив и что адрес чего-то стоит. */
  check('заблокированному не отвечают вовсе',
    routeOf({ row: { state: 'blocked', user_id: 'u-1' }, update: updateOf(dm('hi')) }).act === 'ignore');
  check('и заблокированный не может спариться заново',
    routeOf({ row: { state: 'blocked', user_id: null }, update: updateOf(dm('/pair mf_abcdefgh1')) }).act === 'ignore');

  /* Спарен - обслуживаем. */
  check('спаренному - работа', routeOf({ row: allowed, update: updateOf(dm('empty my inbox')) }).act === 'goal');
  check('и команды', routeOf({ row: allowed, update: updateOf(dm('/status')) }).act === 'status'
    && routeOf({ row: allowed, update: updateOf(dm('/stop')) }).act === 'stop'
    && routeOf({ row: allowed, update: updateOf(dm('/start')) }).act === 'help');

  /* ПОРЯДОК ВЕТВЕЙ - ЭТО И ЕСТЬ ПРАВИЛО: /pair выше «я тебя не знаю», иначе спариться нельзя никогда. */
  const pairing = routeOf({ row: null, update: updateOf(dm('/pair mf_abcdefgh1')) });
  check('/pair от незнакомца - спаривание, а не приветствие', pairing.act === 'pair');
  check('и токен доехал', pairing.token === 'mf_abcdefgh1');
  check('/pair с мусором - отказ словами, а не молчание',
    routeOf({ row: null, update: updateOf(dm('/pair hunter2')) }).act === 'refuse');

  /* Группа - своя политика, и сегодня она «нет». */
  const group2 = routeOf({
    row: allowed,
    update: updateOf({ message: { message_id: 1, from: { id: 42 }, chat: { id: -100, type: 'group' }, text: 'do it' } }),
  });
  check('в группе не работаем, и это сказано', group2.act === 'refuse' && group2.say === SAY.groups);
  check('пустое сообщение спаренного - отказ словами',
    routeOf({ row: allowed, update: updateOf(dm('')) }).act === 'refuse');
  check('без отправителя - ignore', routeOf({ row: allowed, update: { kind: 'message', senderId: '' } }).act === 'ignore');
}

group('нажатие: неизвестная кнопка - это НЕ «наверное, одобрили»');
{
  check('одобрение', JSON.stringify(verdictOf('ok:dabc')) === JSON.stringify({ verdict: 'approved', draftId: 'dabc' }));
  check('отмена', verdictOf('no:dabc').verdict === 'declined');
  check('чужая строка - null', verdictOf('run:dabc') === null);
  check('пусто - null', verdictOf('') === null && verdictOf(null) === null);
  check('подделка с двоеточием внутри - null', verdictOf('ok:d1:ok:d2') === null);

  const kb = keyboardFor('dabc');
  /* ТРИ КНОПКИ С 2026-09-21. Средняя появилась потому, что с двумя неверно понятая задача стоила ВСЕЙ
   * работы заново - а «вся работа» это тридцать секунд надиктованного или приложенный файл.
   * Порядок закреплён: Approve первым, Cancel последним - то, что нельзя нажать по ошибке рядом с ним. */
  check('три кнопки, одобрение первым, отмена последней', kb.inline_keyboard[0].length === 3
    && kb.inline_keyboard[0][0].callback_data === 'ok:dabc'
    && kb.inline_keyboard[0][1].callback_data === 'ch:dabc'
    && kb.inline_keyboard[0][2].callback_data === 'no:dabc');
  check('и правка - это третий вердикт, а не «наверное, одобрили»',
    verdictOf('ch:dabc').verdict === 'changing');
  /* callback_data у телеграма - 64 байта. Идентификатор, не влезший в кнопку, - это кнопка, которая не
   * работает, и узнать об этом можно только в проде. */
  check('и данные кнопки влезают в 64 байта телеграма',
    kb.inline_keyboard[0].every((b) => Buffer.byteLength(b.callback_data) <= 64));
  check('и сам идентификатор короткий', draftId().length <= 16 && /^d[a-z0-9]+$/.test(draftId()));
}

group('просроченный план не запускают');
{
  const now = Date.now();
  check('свежий - не просрочен', !expired(new Date(now - 60_000).toISOString(), now));
  check('старше получаса - просрочен', expired(new Date(now - DRAFT_TTL_MS - 1000).toISOString(), now));
  /* Нечитаемая дата - это НЕ «наверное, свежий»: одобрять то, о чём ничего не известно, хуже, чем
   * попросить прислать задачу заново. */
  check('нечитаемая дата считается просроченной', expired('not a date', now));
  check('и отсутствующая', expired(null, now));
}

group('что человек читает: план говорит, чем он НЕ является');
{
  const said = planMessage({
    plan: { title: 'Send September invoices', checkpoints: [
      { title: 'Outlook is open', detail: 'and the right account is signed in' },
      { title: 'Draft is written', detail: 'I check the address before sending' },
    ] },
    files: [{ name: 'list.csv', clipped: true }],
  });
  check('заголовок первым', said.startsWith('Send September invoices'));
  check('чекпоинты пронумерованы', /1\. Outlook is open/.test(said) && /2\. Draft is written/.test(said));
  /* В чате это опаснее, чем на странице: человек не видит экрана, и кроме этих строк у него нет ничего.
   * План, прочитанный как гарантия, - это обещание, которого цикл не давал. */
  check('сказано, что это намерение, а не сценарий', /not a script/.test(said));
  check('приложенное названо, и обрезка тоже', /list\.csv/.test(said) && /clipped/.test(said));
  check('и сказано, что запускает Approve', /Approve/.test(said));

  const bare = planMessage({ plan: { title: 'X', checkpoints: [] }, files: [] });
  check('без файлов строки про вложения нет', !/Attached/.test(bare));
}

group('исход словами - и «не вышло» читается как «не вышло»');
{
  check('удача', outcomeMessage({ ok: true, said: 'Sent 4 invoices.' }) === 'Done - Sent 4 invoices.');
  check('неудача названа первым словом', outcomeMessage({ ok: false, said: 'Outlook asked for a password.' })
    .startsWith('Not done'));
  /* Молчание в исходе - это не успех: прогон, ничего не сказавший, должен читаться как непонятный, а не
   * как сделанный. */
  check('пустое «сказал» у неудачи не превращается в успех',
    /did not finish/.test(outcomeMessage({ ok: false, said: '' })));
  check('и у удачи есть слово по умолчанию', outcomeMessage({ ok: true, said: null }) === 'Done - Done.');
}

group('документ: отказ ДО скачивания, и он объясняет себя');
{
  check('обычный проходит', refusedDocument({ name: 'a.csv', bytes: 2000 }) === null);
  const big = refusedDocument({ name: 'dump.csv', bytes: 5_000_000 });
  /* Потолок цели - двадцать тысяч знаков: от файла на пять мегабайт в прогон попало бы полпроцента.
   * Молча приложить огрызок - это прогон, которому дали не то, и выглядящий при этом нормально. */
  check('крупный - отказ', !!big);
  check('и в отказе названы и размер, и потолок', /kB/.test(big) && /20 000/.test(big), big);
  check('нет документа - нет отказа', refusedDocument(null) === null);
}

group('канал назван один раз');
{
  check('и это telegram', CHANNEL === 'telegram');
  /* WHERE (api/_queue.mjs) - единственное место, где написано, куда нажать, чтобы дать машину. Слова
   * приглашения в чате обязаны вести туда же, иначе у человека две разные инструкции. */
  check('приглашение незнакомца ведёт в Connections', /Connections/.test(SAY.stranger));
  check('и говорит, что ничего не запустится', /nothing will run/i.test(SAY.stranger));
  check('и что сообщение с токеном будет удалено', /delete/i.test(SAY.stranger));
}


/* ------------------------------------------------------------------ то, что можно проверить только чтением
 *
 * Четыре свойства маршрута, у которых нет способа быть выполненными без базы и без сети, и каждое из
 * которых ломается МОЛЧА: сломанное видно только в проде и только на чужой мыши. Поэтому они закреплены
 * чтением исходника - и закреплено МЕСТО, а не слово. */
group('маршрут: четыре вещи, которые ломаются молча');
{
  const route = readFileSync(new URL('./telegram.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

  /* СЕКРЕТ ПЕРЕД ВСЕМ ОСТАЛЬНЫМ. Адрес функции узнать легко, и заголовок телеграма - единственное, что
   * отличает его от того, кто адрес узнал. Маршрут «пока без проверки» - это открытая дверь к мыши. */
  check('без TELEGRAM_WEBHOOK_SECRET маршрут отказывает, а не работает открытым',
    /if \(!want\) return res\.status\(503\)/.test(route));
  check('и сверяет заголовок телеграма',
    /x-telegram-bot-api-secret-token/.test(route) && /!== want/.test(route));

  /* ОДНО НАЖАТИЕ - ОДИН ПРОГОН. Телеграм повторяет callback при плохой связи. Прочитать черновик,
   * проверить состояние и потом записать - значит оставить щель между чтением и записью, в которую
   * помещается второй такой же callback и второй прогон на настоящей машине. Условие обязано стоять В
   * САМОМ UPDATE. */
  check('одобрение - один UPDATE с условием, а не чтение и запись',
    /update chat_draft set state = \$\{said\.verdict\}[\s\S]{0,200}?state = 'offered'/.test(route));

  /* НЕТ ПЛАНА - НЕТ КНОПКИ. «План не получился, запускаю без него» - ровно тот случай, ради которого план
   * и существует: человек не видит экрана. Проверяется, что отказ стоит ДО вставки черновика. */
  const offer = route.slice(route.indexOf('async function offer'), route.indexOf('async function decide'));
  check('без плана черновик не создаётся и кнопки нет',
    offer.indexOf('if (!plan) return say') > 0
      && offer.indexOf('if (!plan) return say') < offer.indexOf('insert into chat_draft'));

  /* РАБОТА ДЛЯ АГЕНТА, А НЕ ДЛЯ РАСШИРЕНИЯ. BROWSER_GOAL пометил бы цель как «умеет только браузерное
   * расширение» - и агент бы её не взял, а человек ждал бы ответа, которого нет. Словарь очереди один на
   * всех: api/_queue.mjs. */
  /* И ИМЯ РАБОТЫ - ИЗ ОБЩЕГО СЛОВАРЯ, А НЕ НАПИСАНО ЗДЕСЬ. Первая редакция ставила литерал '#goal',
   * которого в словаре нет; агент взял строку, не нашёл ни тела, ни знакомой команды и ответил «asked to
   * do something it does not understand». Пин проверяет ОТКУДА берётся имя, потому что сломать это можно
   * только одним способом - написать строку руками. */
  check('цель ставится свободной целью для агента', /flowId: DESKTOP_GOAL/.test(route));
  check('и это имя ввезено из словаря очереди',
    /import \{ DESKTOP_GOAL[^}]*\} from '\.\/_queue\.mjs'/.test(route));
  check('а литерала цели в маршруте нет', !/'#goal/.test(route));
  check('и адрес чата замирает в аргументах работы', /telegram: \{ chatId/.test(route));
}


/* ------------------------------------------------------------------- тишина как отдельный род поломки
 *
 * ЧТО СЛУЧИЛОСЬ. Первая настоящая задача из телеграма закончилась неудачей, и человек не узнал об этом
 * НИЧЕГО: он написал просьбу, получил «Started. I will say how it went» и тишину. Прогон был честно
 * записан в журнал - то есть ответ существовал и просто не дошёл до того, кто ждал.
 *
 * Сообщение об исходе стояло в трёх местах цикла шагов, а закрылась работа в четвёртом - в `?worker=report`,
 * куда отчитался курьер агента. Пин, перечисляющий три места, повторил бы ту же ошибку. Поэтому он
 * ПЕРЕСЧИТЫВАЕТ ВСЕ закрытия строки в файле и требует, чтобы рядом с каждым был ответ в чат: новое
 * закрытие, добавленное завтра, обязано или сказать, или упасть здесь.
 *
 * И тишина - отдельный род поломки, а не мелкая недоделка: «не вышло» можно перечитать и переспросить, а
 * молчание читается как «наверное, ещё идёт», и читается так весь день. */
group('ни одно закрытие работы не остаётся беззвучным');
{
  const worker = readFileSync(new URL('./_mcp-worker.mjs', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const lines = worker.split('\n');
  /* Закрытием считается любой UPDATE, ставящий терминальное состояние, - включая то, которое вычисляется
   * выражением: `${ok ? 'done' : 'failed'}` это закрытие ровно так же, как литерал. */
  const closes = /update run_queue set state = ('failed'|'done'|'cancelled'|\$\{)/;
  const silent = [];
  lines.forEach((ln, i) => {
    if (!closes.test(ln)) return;
    if (!/tellChat/.test(lines.slice(i, i + 14).join('\n'))) silent.push(i + 1);
  });
  const found = lines.filter((ln) => closes.test(ln)).length;
  check('закрытия найдены - иначе этот пин ничего не сторожит', found >= 8, String(found));
  check('и у каждого рядом есть ответ в чат', silent.length === 0, silent.join(', '));

  /* ТОЛЬКО КОГДА СТРОКА ДЕЙСТВИТЕЛЬНО ЗАКРЫТА ЭТИМ ВЫЗОВОМ. Отчёт по уже отменённой работе ничего не
   * закрывает, и сообщать о нём значило бы сказать «не вышло» про то, что человек сам остановил. */
  check('отчёт говорит в чат только если он и закрыл строку',
    /if \(done\.length === 1\) await tellChatAbout/.test(worker));

  /* ОТМЕНА СО СТРАНИЦЫ - ТОЖЕ ИСХОД. Нажавший кнопку получает ответ маршрута; тот, кто держит телефон,
   * не видит ничего и считает, что прогон идёт. Это два разных человека, даже когда это один человек. */
  const mcp = readFileSync(new URL('./mcp.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  check('и отмена со страницы доходит до чата',
    /returning id, claimed_at, args/.test(mcp) && /await tellChat\(killed\[0\]\.args/.test(mcp));

  /* СЛОВА ИСХОДА - ОДНИ. Вторая их редакция в воркере разошлась бы с первой первым же уточнением. */
  check('и слова исхода берутся из общего модуля, а не пишутся в воркере',
    /from '\.\/_telegram-out\.mjs'/.test(worker) && !/Not done -/.test(worker));
}


/* -------------------------------------------------------------- «Change»: правка вместо переделки
 *
 * ЗАЧЕМ ТРЕТЬЯ КНОПКА. С двумя неверно понятая задача стоила ВСЕЙ работы заново, а «вся работа» - это
 * тридцать секунд надиктованного или приложенный файл, который ещё надо найти. Cancel дёшев только для
 * той задачи, которую набрали одной строкой.
 *
 * И ПОЧЕМУ ЭТО НЕ РЕЖИМ. Напрашивалось состояние: нажал - бот ждёт правку - следующее сообщение читается
 * как правка. Состояние плохо тем, чем везде: человек нажимает, отвлекается и через три часа пишет НОВУЮ
 * задачу, которую режим приклеит к старой. Телеграм уже хранит нужную связь сам - ответ несёт то
 * сообщение, на которое отвечают, - поэтому метка печатается в плане, а правкой считается ОТВЕТ на неё.
 * Режима нет; написанное не в ответ остаётся новой задачей. */
group('правка плана держится на ответе, а не на режиме');
{
  check('метка узнаётся в тексте', tagIn(`plan text\n\n${tagFor('d1abc')}`) === 'd1abc');
  check('и её нет там, где её нет', tagIn('just a sentence about #tags') === null);
  check('чужая решётка не считается меткой', tagIn('#hello') === null && tagIn('#123') === null);
  check('пусто не бросает', tagIn('') === null && tagIn(null) === null);

  const planned = planMessage({ plan: { title: 'X', checkpoints: [{ title: 'a', detail: 'b' }] }, id: 'd1abc' });
  check('план несёт свою метку', tagIn(planned) === 'd1abc');
  check('и зовёт ответить, а не только нажать', /reply to this message/i.test(planned));
  /* Обещание, ради которого всё: приложенное и надиктованное НЕ теряются. Сказать это надо там, где
   * человек решает, нажать Cancel или Change. */
  check('и обещает, что приложенное сохранится', /attached or said is kept/.test(planned));

  const reply = (text, to) => updateOf({
    message: { message_id: 9, from: { id: 42 }, chat: { id: 42, type: 'private' }, text, reply_to_message: { text: to } },
  });
  const amend = routeOf({ row: allowed, update: reply('no, in Safari', planned) });
  check('ответ на план - это правка, а не новая задача', amend.act === 'amend' && amend.draftId === 'd1abc');
  /* РАНЬШЕ КОМАНД: правка, начинающаяся со слэша, - обычная человеческая фраза, и разбирать её как
   * команду значило бы ответить «не понял» на осмысленное. */
  check('и слэш в начале правки её не ломает',
    routeOf({ row: allowed, update: reply('/tmp is the folder, not Documents', planned) }).act === 'amend');
  check('а ответ на сообщение БЕЗ метки - обычная новая задача',
    routeOf({ row: allowed, update: reply('do something else', 'hello there') }).act === 'goal');
  check('и написанное не в ответ - тоже',
    routeOf({ row: allowed, update: updateOf(dm('do something else')) }).act === 'goal');
  check('незнакомец не может править чужой план',
    routeOf({ row: null, update: reply('no, in Safari', planned) }).act === 'greet');

  const route = readFileSync(new URL('./telegram.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  /* ПРАВКА ДОПИСЫВАЕТСЯ К ПРЕЖНЕЙ ЦЕЛИ, А НЕ ЗАМЕНЯЕТ ЕЁ. «Нет, в Safari» само по себе не задача; смысл
   * есть только рядом с прежней целью - в которой уже лежит файл и надиктованное. */
  check('прежняя цель берётся из черновика и несёт правку',
    /Correction from the person who asked/.test(route) && /\{ carry: was\.goal \}/.test(route));
  check('и править можно только нерешённое',
    /state !== 'offered' && was\.state !== 'changing'/.test(route));
  check('и Change спрашивает ответом, а не молча ждёт следующей строки',
    /force_reply: true/.test(route));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
