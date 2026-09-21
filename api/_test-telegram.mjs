/* Дверь мессенджера, проверенная исполнением — SPLIT-PLAN §7.2, шаг 14a.
 *
 * ПОЧЕМУ ИМЕННО ЭТИ ПРОВЕРКИ. За сообщением в чате стоит настоящая мышь, и ошибиться здесь можно ровно
 * тремя способами: обслужить того, кого не знаешь; сделать из одного нажатия два прогона; запустить без
 * плана. Все три - про решение, а не про сеть, поэтому они выполняются, а не вычитываются.
 *
 * Run: node api/_test-telegram.mjs
 */
import { readFileSync } from 'node:fs';

import {
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
  check('две кнопки, и одобрение первым', kb.inline_keyboard[0].length === 2
    && kb.inline_keyboard[0][0].callback_data === 'ok:dabc');
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
  const route = readFileSync(new URL('./telegram.js', import.meta.url), 'utf8');

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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
