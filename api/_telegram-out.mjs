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
import {
  FEED_KEY, feedLine, feedSource, feedWorthy, holdKeyboard, holdMessage, outcomeMessage,
} from './_telegram.mjs';

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

/** То же, когда строки под рукой нет, - один запрос на закрытие работы, и только на закрытие. */
export async function tellChatAbout(sql, userId, id, ok, said) {
  try {
    const [row] = await sql`
      select id, flow_id, tool_name, args, schedule_id, state from run_queue where id = ${id} and user_id = ${userId}
    `;
    if (row) await tellOutcome(sql, userId, row, ok, said);
  } catch (_) {
    /* Нет строки, нет таблицы, база моргнула - исход всё равно записан там, где его читают глазами. */
  }
}

/* ЛЕНТА (владелец, 2026-10-01: «пусть телеграм станет дашбордом»). Всем спаренным чатам аккаунта, у которых
 * она не выключена (/feed off), кроме `except` - того чата, которому этот исход уже сказан как ответ.
 * Лучшее усилие, как всё в этом файле. */
export async function tellFeed(sql, userId, line, except = null) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !userId) return;
  try {
    const [pref] = await sql`select value from user_pref where user_id = ${userId} and key = ${FEED_KEY}`;
    if (pref && pref.value === 'off') return;
    const chats = await sql`
      select distinct chat_id from chat_sender where user_id = ${userId} and state = 'allowed'
    `;
    for (const chat of chats) {
      if (except != null && String(chat.chat_id) === String(except)) continue;
      await sendChat(chat.chat_id, line);
    }
  } catch (_) {
    /* Нет таблицы (024 не применена), база моргнула - лента молчит, прогон записан. */
  }
}

/** Как работа называется в ленте: подпись расписания, имя скилла, цель - что есть. */
async function titleOf(sql, userId, job) {
  try {
    if (job.schedule_id) {
      const [one] = await sql`select label from user_schedule where id = ${job.schedule_id} and user_id = ${userId}`;
      if (one && one.label) return one.label;
    }
    const flow = String(job.flow_id || '');
    if (flow && !flow.startsWith('#')) {
      const [one] = await sql`select name from user_flow where user_id = ${userId} and client_id = ${flow}`;
      if (one && one.name) return one.name;
    }
  } catch (_) { /* название - украшение, а не условие */ }
  const args = job.args && typeof job.args === 'object' ? job.args : {};
  if (args.goal) return String(args.goal);
  if (job.loop && job.loop.goal) return String(job.loop.goal);
  const tool = String(job.tool_name || '');
  return tool.startsWith('case:') || tool.startsWith('page:') ? tool.slice(5) : tool || job.id;
}

/**
 * ИСХОД РАБОТЫ - ОДНА ВОРОНКА на все места, где работа закрывается. Чату, из которого она пришла, - ответом
 * (как всегда); остальным спаренным чатам аккаунта - строкой ленты. Один и тот же исход дважды в один чат не
 * уходит.
 *
 * @param {{id?: string, flow_id?: string, tool_name?: string, args?: object, schedule_id?: string|null,
 *          state?: string, loop?: object}} job
 */
export async function tellOutcome(sql, userId, job, ok, said) {
  if (!job) return;
  await tellChat(job.args, ok, said);
  if (!feedWorthy(job)) return;
  const origin = job.args && job.args.telegram ? job.args.telegram.chatId : null;
  const event = job.state === 'cancelled' || /^cancelled/.test(String(said || '')) ? 'cancelled' : ok ? 'done' : 'failed';
  const title = await titleOf(sql, userId, job);
  await tellFeed(sql, userId, feedLine({ event, title, said, source: feedSource(job) }), origin);
}

/* ПРОГОН ОСТАНОВИЛСЯ И СПРАШИВАЕТ (SPLIT-PLAN §7.2, шаг 14b).
 *
 * Тот же адрес, что и у исхода, и тот же довод: он замер в аргументах работы в момент постановки. Кнопки
 * несут ИДЕНТИФИКАТОР РАБОТЫ, а не черновика: черновик кончился в тот миг, когда нажали Approve, а
 * спрашивает теперь прогон.
 *
 * Лучшее усилие - как и всё в этом файле. Но цена у потери здесь выше, чем у потерянного исхода: прогон
 * будет стоять, пока не выйдет его время, и закроется причиной. Поэтому HOLD_MAX_MS существует. */
export async function askChat(args, jobId, hold) {
  const at = args && typeof args === 'object' && args.telegram && typeof args.telegram === 'object'
    ? args.telegram : null;
  if (!at || !at.chatId) return;
  try {
    await sendChat(at.chatId, holdMessage(hold && hold.said), { reply_markup: holdKeyboard(jobId) });
  } catch (_) {
    /* Сказано выше: молчание здесь дешевле падения. */
  }
}

/* ОДИН РАЗ НА СОБЫТИЕ. «Пропущено» может заметить и сторож (api/watch.js, по часам), и такт расписаний
 * (когда агент вернулся): человеку нужна одна строка, а не две. Метка - в user_pref, значение - момент, к
 * которому событие относится (next_at): тот же момент второй раз не сообщается, следующий - сообщается. */
export async function feedOnce(sql, userId, key, stamp, line) {
  try {
    const name = `feed.once.${key}`.slice(0, 120);
    const [had] = await sql`select value from user_pref where user_id = ${userId} and key = ${name}`;
    if (had && had.value === String(stamp)) return false;
    await sql`
      insert into user_pref (user_id, key, value) values (${userId}, ${name}, ${String(stamp)})
      on conflict (user_id, key) do update set value = excluded.value
    `;
  } catch (_) {
    return false;
  }
  await tellFeed(sql, userId, line);
  return true;
}
