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
