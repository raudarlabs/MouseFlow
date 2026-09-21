/* Всё, что этот проект ГОВОРИТ в телеграм. Одна дверь наружу, и вот зачем она отдельная.
 *
 * Говорят двое, и они на разных концах работы. api/telegram.js отвечает на сообщение - пока человек ждёт.
 * api/_mcp-worker.mjs отвечает, ЧЕМ КОНЧИЛОСЬ, - через минуту или через десять, когда машина доработала и
 * в чате уже другой разговор. Второму нечего знать про вебхук, а первому - про очередь.
 *
 * Правило этого репозитория: маршруты (`api/*.js`) импортируют модули (`api/_*.mjs`), а не друг друга.
 * Воркер, импортирующий маршрут ради одной функции, поставил бы стрелку в обратную сторону - и следующий,
 * кто станет делить продукты по файлам, не смог бы ответить на вопрос «чей это файл».
 *
 * ЛУЧШЕЕ УСИЛИЕ, И ЭТО СКАЗАНО ВСЛУХ. Ни один вызов отсюда не бросает: прогон, чей исход не доехал до
 * чата, всё равно записан в журнал и виден на странице. Потерять ответ неприятно; уронить из-за него
 * работу, которая уже сделана, - хуже.
 */
import { outcomeMessage } from './_telegram.mjs';

const API = 'https://api.telegram.org';

/** Один вызов Bot API. Никогда не бросает: причина возвращается полем, потому что звать её будут из мест,
 * где исключение означало бы потерю уже сделанной работы. */
export async function callTelegram(method, payload) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, why: 'no bot token on this deployment' };
  try {
    const r = await fetch(`${API}/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await r.json().catch(() => null);
    if (body && body.ok) return { ok: true, result: body.result };
    return { ok: false, why: (body && body.description) || `HTTP ${r.status}` };
  } catch (err) {
    return { ok: false, why: err && err.message ? err.message : 'the request failed' };
  }
}

/** Адрес файла, присланного в чат. Отдельным адресом, а не через Bot API - так устроен телеграм. */
export const fileUrl = (path) => `${API}/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${path}`;

export const sendChat = (chatId, text, extra = {}) =>
  callTelegram('sendMessage', { chat_id: chatId, text, disable_web_page_preview: true, ...extra });

/* РАБОТА, ПРИШЕДШАЯ ИЗ ЧАТА, ОТВЕЧАЕТ В ЧАТ (SPLIT-PLAN §7.2, шаг 14a) - и «отвечает» значит на КАЖДОМ
 * исходе, а не только на удачном.
 *
 * ЧТО ЗДЕСЬ БЫЛО СЛОМАНО И ПОЧЕМУ ЭТО ХУЖЕ ОБЫЧНОЙ ОШИБКИ. Сообщение об исходе сначала стояло в трёх
 * местах цикла шагов. Первая же настоящая задача из телеграма закончилась НЕ там: её забрал курьер агента
 * и закрыл через `?worker=report`, где такого сообщения не было. Человек написал задачу, получил
 * «Started. I will say how it went» - и тишину. Прогон при этом честно записан в журнал как неудачный, то
 * есть система знала ответ и не сказала его тому, кто ждал.
 *
 * Тишина хуже плохой новости ровно тем, что на неё нечем ответить: «не вышло» можно перечитать и
 * переспросить, а молчание читается как «наверное, ещё идёт» - и так весь день.
 *
 * ИЗ АРГУМЕНТОВ РАБОТЫ, а не из отдельной таблицы: очередь уже везёт `args`, и адрес чата замирает в ней
 * в момент постановки - тот же довод, по которому там замирает привязка к машине (db/022). Чат,
 * отвязанный от аккаунта наутро, не должен менять адрес у работы, которая уже сделана.
 *
 * ЛУЧШЕЕ УСИЛИЕ: потерянное сообщение - это потерянное сообщение, а не потерянный прогон. Слова исхода
 * одни и те же, из api/_telegram.mjs: вторая их редакция разошлась бы с первой. */
export async function tellChat(args, ok, said) {
  const at = args && typeof args === 'object' && args.telegram && typeof args.telegram === 'object'
    ? args.telegram : null;
  if (!at || !at.chatId) return;
  try {
    await sendChat(at.chatId, outcomeMessage({ ok, said }));
  } catch (_) {
    /* Сказано вслух выше: молчание здесь дешевле падения. */
  }
}

/** То же, когда аргументов под рукой нет, - один запрос на закрытие работы, и только на закрытие. */
export async function tellChatAbout(sql, userId, id, ok, said) {
  try {
    const [row] = await sql`select args from run_queue where id = ${id} and user_id = ${userId}`;
    if (row) await tellChat(row.args, ok, said);
  } catch (_) {
    /* Нет строки, нет таблицы, база моргнула - исход всё равно записан там, где его читают глазами. */
  }
}
