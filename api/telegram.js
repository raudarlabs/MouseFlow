/* Дверь мессенджера: сообщение становится планом, а план - строкой очереди, но только после «Approve».
 *
 * SPLIT-PLAN §7.2, шаг 14a. Здесь живут ПОСЛЕДСТВИЯ - запись в базу, вызов модели, отправка сообщения,
 * постановка работы. Все решения, у которых есть правильный ответ, - в api/_telegram.mjs, и они там
 * выполняются тестами. Ровно то же деление, что у api/_memory.mjs и api/memory.js.
 *
 * НАПРАВЛЕНИЕ СВЯЗИ НЕ ПЕРЕВОРАЧИВАЕТСЯ, и это главное, что надо сказать про этот файл. Он НЕ дотягивается
 * ни до чьего компьютера: он кладёт строку в run_queue, а машина сама её забирает тем же `?worker=claim`,
 * что и всегда (db/007_run_queue.sql). Телеграм здесь - ещё одно место, откуда приходит просьба, и ничего
 * больше.
 *
 * ВЕБХУК, А НЕ ДЛИННЫЙ ОПРОС: серверная функция не может держать соединение открытым, а держать его негде
 * ещё - у этого продукта нет своего процесса. Телеграм зовёт сюда, мы отвечаем 200 почти на всё: код
 * ошибки он повторяет с нарастающей задержкой, и одна плохая просьба превратилась бы в бесконечный поток.
 * Единственное исключение - неверный секрет: он значит, что зовут не оттуда.
 *
 * ДВА СЕКРЕТА, И У НИХ РАЗНАЯ РАБОТА. TELEGRAM_BOT_TOKEN - это право говорить ОТ бота. Второй,
 * TELEGRAM_WEBHOOK_SECRET, задаётся при setWebhook и приезжает заголовком: он единственное, что отличает
 * настоящий вызов от того, кто узнал адрес нашей функции. Адрес узнать легко.
 *
 * ЧЕГО ЗДЕСЬ НЕТ. Разговора: бот не ведёт беседу и не помнит прошлых сообщений. Каждая просьба - отдельное
 * намерение с отдельным планом и отдельной кнопкой. Память между ходами есть у прогона (run_queue.loop), а
 * не у чата; завести её тут значило бы второе состояние диалога рядом с уже существующим.
 */
import { neon } from '@neondatabase/serverless';

import { byDeviceToken } from './_session.js';
import { report, wrap } from './_report.js';
import { overSpend } from './_spend.mjs';
import { DESKTOP_GOAL, queueOne, workerSeen } from './_queue.mjs';
import { GOAL_MAX, goalWith, looksLikeText } from './_attach.mjs';
import { planFrom, planRequest } from './_plan.mjs';
import { recognise, refusedAudio } from './_transcribe.mjs';
import { callModel } from './_vision.mjs';
import { callTelegram, fileUrl, sendChat } from './_telegram-out.mjs';
import {
  CHANNEL, SAY, draftId, expired, keyboardFor, outcomeMessage, planMessage, refusedDocument,
  routeOf, updateOf, verdictOf,
} from './_telegram.mjs';

/* Модель для плана. Одна строка, одна причина: план - это один вызов перед прогоном, и он не должен стоить
 * как прогон. Ключ спускается тот же, что у всего остального, - ANTHROPIC_API_KEY этого деплоя. */
const PLAN_MODEL = 'claude-sonnet-5';

/** Ни одна ошибка мессенджера не должна валить вебхук: телеграм повторит то, на что мы ответили не-200. */
const ok = (res, said) => res.status(200).json({ ok: true, ...(said ? { said } : {}) });

const say = sendChat;

/* Скачать приложенный документ. Двумя вызовами, потому что телеграм так устроен: getFile отдаёт путь,
 * файл лежит по другому адресу. Текстом, а не байтами: в цель едет текст, и если это не текст - откажем
 * той же проверкой, что и страница (api/_attach.mjs). */
/* Скачать что угодно, присланное в чат, - путь один на документ и на голосовое. Телеграм устроен так:
 * getFile отдаёт путь, файл лежит по другому адресу. */
async function fetchFile(fileId, name) {
  const got = await callTelegram('getFile', { file_id: fileId });
  if (!got.ok || !got.result || !got.result.file_path) {
    return { error: `${name} could not be fetched: ${got.why || 'no path came back'}` };
  }
  try {
    const r = await fetch(fileUrl(got.result.file_path));
    if (!r.ok) return { error: `${name} could not be downloaded (HTTP ${r.status})` };
    return { res: r };
  } catch (err) {
    return { error: `${name} could not be downloaded: ${err && err.message}` };
  }
}

async function fetchDocument(doc) {
  const got = await fetchFile(doc.fileId, doc.name);
  if (got.error) return { error: got.error };
  let raw;
  try {
    raw = await got.res.text();
  } catch (err) {
    return { error: `${doc.name} could not be read: ${err && err.message}` };
  }
  if (!looksLikeText(raw)) {
    return {
      error: `${doc.name} is not a text file - it looks binary. A .docx or a .pdf is a container, not `
        + 'text; export it as .txt or .md first.',
    };
  }
  const text = raw.slice(0, GOAL_MAX);
  return { one: { id: doc.fileId.slice(0, 24), name: doc.name, text, bytes: doc.bytes, clipped: raw.length > text.length } };
}

/* -------------------------------------------------------------------------------- что делает каждая ветвь */

async function greet(sql, update) {
  /* Строка заводится ДО ответа, и с состоянием `pairing`: иначе «впервые вижу» повторялось бы каждый раз,
   * а отличить первый разговор от сотого нечем - в том числе для будущего ограничения по частоте. */
  await sql`
    insert into chat_sender (channel, sender_id, chat_id, seen_at)
    values (${CHANNEL}, ${update.senderId}, ${update.chatId}, now())
    on conflict (channel, sender_id) do update set seen_at = now(), chat_id = excluded.chat_id
  `;
  await say(update.chatId, SAY.stranger);
}

async function pair(sql, update, token) {
  const who = await byDeviceToken(sql, token);
  /* СНАЧАЛА УБРАТЬ ТОКЕН, ПОТОМ ОТВЕТИТЬ - и убрать в обоих случаях, верный он или нет. Неверный токен
   * тоже чей-то секрет: человек мог промахнуться строкой. Удаление - лучшее усилие: бот может удалять
   * сообщения в личке, но не всегда и не вечно, и провал этого не должен ломать спаривание. */
  if (update.messageId) {
    await callTelegram('deleteMessage', { chat_id: update.chatId, message_id: update.messageId });
  }
  if (!who) return say(update.chatId, SAY.badToken);
  await sql`
    insert into chat_sender (channel, sender_id, user_id, state, chat_id, paired_at, seen_at)
    values (${CHANNEL}, ${update.senderId}, ${who.id}, 'allowed', ${update.chatId}, now(), now())
    on conflict (channel, sender_id) do update set
      user_id = excluded.user_id, state = 'allowed', chat_id = excluded.chat_id,
      paired_at = now(), seen_at = now()
  `;
  return say(update.chatId, SAY.paired);
}

async function status(sql, update, userId) {
  const seen = await workerSeen(sql, userId);
  if (seen === undefined) return say(update.chatId, 'I cannot tell right now - this deployment could not answer.');
  if (seen === null) {
    return say(update.chatId, 'No computer of yours has ever taken work, so there is nothing to run on.\n\n'
      + 'To let one: open MouseFlow, click your avatar at the bottom of the sidebar, then Connections, '
      + 'then "Let Claude drive this computer".');
  }
  const mins = Math.round((Date.now() - seen.getTime()) / 60000);
  const fresh = mins <= 2;
  return say(update.chatId, fresh
    ? 'A computer of yours is awake and taking work.'
    : `The last time a computer of yours asked for work was ${mins} minutes ago. It has to be awake and `
      + 'taking work when you press Approve, or the job simply waits.');
}

async function stop(sql, update, userId) {
  const killed = await sql`
    update run_queue set state = 'cancelled', finished_at = now(),
           ok = false, said = 'cancelled before it finished'
    where user_id = ${userId} and state in ('queued', 'claimed')
    returning id, claimed_at
  `;
  if (!killed.length) return say(update.chatId, 'Nothing is running.');
  return say(update.chatId, killed.some((r) => r.claimed_at)
    ? 'Stopping. A run already under way stops at the next step the machine checks, within a second or two.'
    : 'Cancelled. It never started.');
}

/* ЦЕЛЬ → ПЛАН → ДВЕ КНОПКИ. Работа в очередь здесь НЕ ставится. */
async function offer(sql, update, userId) {
  /* Потолок частоты - на самом дорогом, что тут есть, и это вызов модели. У незнакомца его нет вовсе:
   * ему мы ничего не считаем, потому что ничего для него и не считаем - до спаривания ни один вызов
   * модели не происходит. */
  const budget = await overSpend(sql, userId, 'telegram');
  if (!budget.ok) return say(update.chatId, SAY.tooBusy);

  /* ГОЛОС - ЭТО ПРОСТО ТЕКСТ, ПОЛУЧЕННЫЙ ДОРОЖЕ (SPLIT-PLAN §7, шаг 13). Узнанное становится тем же, чем
   * было бы напечатанное, и дальше по маршруту ничего не знает о том, как оно сюда попало. Единственное
   * отличие живёт в сообщении с планом: услышанное показывается ДОСЛОВНО, потому что у продиктованной
   * задачи есть способ пойти не туда, которого у напечатанной нет. */
  let heard = null;
  if (update.voice) {
    const refusedSound = refusedAudio({ bytes: update.voice.bytes, type: update.voice.mime });
    if (refusedSound) return say(update.chatId, refusedSound);
    const got = await fetchFile(update.voice.fileId, 'that recording');
    if (got.error) return say(update.chatId, got.error);
    let bytes;
    try {
      bytes = Buffer.from(await got.res.arrayBuffer());
    } catch (err) {
      return say(update.chatId, `that recording could not be read: ${err && err.message}`);
    }
    const said = await recognise(bytes, update.voice.mime);
    if (said.why) return say(update.chatId, `${said.why} Nothing was run.`);
    if (!said.text) return say(update.chatId, SAY.heardNothing);
    heard = said.text;
  }

  const files = [];
  if (update.document) {
    const refused = refusedDocument(update.document);
    if (refused) return say(update.chatId, refused);
    const got = await fetchDocument(update.document);
    if (got.error) return say(update.chatId, got.error);
    files.push(got.one);
  }

  /* Подпись под голосовым телеграм не присылает, так что одно из двух всегда пусто; склейка на случай
   * дня, когда присылать начнёт, - и потому что «сказал и дописал» это одна просьба, а не две. */
  const goal = goalWith([update.text, heard].filter(Boolean).join(' '), files);
  if (!goal) return say(update.chatId, SAY.empty);
  if (goal.length > GOAL_MAX) {
    return say(update.chatId, `That is ${goal.length - GOAL_MAX} characters over what one goal can hold.`);
  }

  /* КЛЮЧ ПРОВЕРЯЕТСЯ ЗДЕСЬ, А НЕ У МОДЕЛИ. Без него callModel уйдёт наверх с пустым заголовком и вернётся
   * с 401 - то есть «вас не узнали» вместо «на этом деплое не настроен общий ключ». Отличить одно от
   * другого по коду нельзя, а чинят это в разных местах. Те же слова, что у api/claude.js. */
  if (!process.env.ANTHROPIC_API_KEY) {
    return say(update.chatId, 'This deployment has no shared key configured (ANTHROPIC_API_KEY), so I '
      + 'cannot build a plan. Nothing was run.');
  }

  const answer = await callModel(
    { model: PLAN_MODEL, ...planRequest({ goal, where: 'messenger' }) },
    process.env.ANTHROPIC_API_KEY,
  );
  if (answer.status < 200 || answer.status >= 300) {
    /* СВОИМИ СЛОВАМИ ВЕРХА, ЕСЛИ ОН ИХ СКАЗАЛ. «HTTP 401» не говорит человеку ничего и не говорит ничего
     * тому, кто это чинит: 401 бывает и у протухшего ключа, и у ключа без доступа к этой модели. Ответ
     * модели содержит причину словами, и он уже лежит в answer.text - не показать его значило бы выбросить
     * единственное, что здесь объясняет отказ. */
    let why = '';
    try {
      const said = JSON.parse(answer.text);
      why = said && said.error && said.error.message ? String(said.error.message).slice(0, 300) : '';
    } catch (_) {
      why = String(answer.text || '').slice(0, 300);
    }
    if (answer.unreachable) why = answer.unreachable;
    if (answer.tooLarge) why = `the request was ${Math.round(answer.bytes / 1024)} kB, which is over the limit`;
    return say(update.chatId, `I could not build a plan for that (HTTP ${answer.status})`
      + `${why ? `: ${why}` : ''}. Nothing was run.`);
  }
  let body = null;
  try {
    body = JSON.parse(answer.text);
  } catch (_) {
    return say(update.chatId, 'The plan came back as something I could not read. Nothing was run.');
  }
  const { plan, error } = planFrom(body, goal);
  /* НЕТ ПЛАНА - НЕТ КНОПКИ. «План не получился, запускаю без него» - это ровно тот случай, ради которого
   * план и существует: человек не видит экрана, и кроме этих строк у него нет ничего. */
  if (!plan) return say(update.chatId, `I could not build a plan for that: ${error}. Nothing was run.`);

  const id = draftId();
  await sql`
    insert into chat_draft (id, channel, sender_id, user_id, chat_id, goal, plan)
    values (${id}, ${CHANNEL}, ${update.senderId}, ${userId}, ${update.chatId}, ${goal}, ${JSON.stringify(plan)})
  `;
  return say(update.chatId, planMessage({ plan, files, heard }), { reply_markup: keyboardFor(id) });
}

/* НАЖАТИЕ. Половина этой функции - про то, чтобы одно нажатие не стало двумя прогонами. */
async function decide(sql, update, userId) {
  const said = verdictOf(update.data);
  /* Кнопка должна перестать крутиться, что бы мы дальше ни решили. */
  await callTelegram('answerCallbackQuery', { callback_query_id: update.callbackId });
  if (!said) return;

  /* ОДНИМ ОПЕРАТОРОМ, а не «прочитать, проверить, записать». Телеграм повторяет callback при плохой связи,
   * и между чтением и записью успевает пройти второй такой же: условие `state = 'offered'` в самом UPDATE
   * означает, что выиграет ровно один. Второй не найдёт строки и не поставит второй работы. */
  const [draft] = await sql`
    update chat_draft set state = ${said.verdict}, decided_at = now()
    where id = ${said.draftId} and user_id = ${userId} and state = 'offered'
    returning id, goal, plan, chat_id, created_at
  `;
  if (!draft) {
    const [seen] = await sql`select state from chat_draft where id = ${said.draftId} and user_id = ${userId}`;
    return say(update.chatId, seen ? `Already ${seen.state}.` : SAY.gone);
  }

  /* Клавиатуру снимаем в обоих случаях: кнопка, которая осталась под решённым планом, приглашает нажать
   * её ещё раз, и вся защита выше существует только потому, что мы этого не сделали. */
  if (update.messageId) {
    await callTelegram('editMessageReplyMarkup', { chat_id: update.chatId, message_id: update.messageId });
  }

  if (said.verdict === 'declined') return say(update.chatId, SAY.declined);

  if (expired(draft.created_at)) {
    await sql`update chat_draft set state = 'expired' where id = ${draft.id}`;
    return say(update.chatId, SAY.expired);
  }

  /* СВОБОДНАЯ ЦЕЛЬ НА ДЕСКТОПЕ. Не BROWSER_GOAL - тот помечает работу как «умеет только браузерное
   * расширение». И не выдуманное здесь имя: словарь очереди один на всех, api/_queue.mjs, и имя, которого
   * в нём нет, доедет до агента командой, которой он не знает. */
  const put = await queueOne(sql, userId, {
    flowId: DESKTOP_GOAL,
    toolName: 'mouseflow_do',
    args: { goal: draft.goal, telegram: { chatId: draft.chat_id } },
  });
  if (put.why) return say(update.chatId, put.why);

  await sql`update chat_draft set job_id = ${put.id} where id = ${draft.id}`;
  return say(update.chatId, 'Started. I will say how it went.');
}

/* --------------------------------------------------------------------------------------------- вебхук */

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST' });

  /* СЕКРЕТ ПЕРЕД ВСЕМ ОСТАЛЬНЫМ, включая чтение тела: адрес функции узнать легко, и это единственное, что
   * отличает телеграм от того, кто его узнал. Отсутствие секрета в окружении - тоже отказ: маршрут,
   * который «пока без проверки», это открытая дверь к чужой мыши. */
  const want = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!want) return res.status(503).json({ error: 'this deployment has no TELEGRAM_WEBHOOK_SECRET set' });
  if (String(req.headers['x-telegram-bot-api-secret-token'] || '') !== want) {
    return res.status(401).json({ error: 'not from telegram' });
  }
  if (!process.env.DATABASE_URL) return res.status(503).json({ error: 'no database' });

  const sql = neon(process.env.DATABASE_URL);
  const update = updateOf(req.body);
  if (update.kind === 'ignored') return ok(res, update.why);

  let row = null;
  try {
    const rows = await sql`
      select user_id, state from chat_sender where channel = ${CHANNEL} and sender_id = ${update.senderId}
    `;
    row = rows[0] || null;
  } catch (err) {
    /* Таблицы может не быть - db/024 не применена. Сказать это, а не изобразить незнакомца: отсутствие
     * таблицы и отсутствие права - разные вещи, и вторая читается как «вас заблокировали». */
    if (/chat_sender/.test(String(err.message))) {
      await say(update.chatId, 'This deployment has no channel table yet (db/024_chat_channel.sql is not '
        + 'applied), so I cannot tell who you are. Nothing was run.');
      return ok(res, 'db/024 not applied');
    }
    throw err;
  }

  const route = routeOf({ row, update });
  const userId = row && row.user_id ? row.user_id : null;
  try {
    if (route.act === 'ignore') return ok(res, 'ignored');
    if (route.act === 'refuse') { await say(update.chatId, route.say); return ok(res, 'refused'); }
    if (route.act === 'greet') { await greet(sql, update); return ok(res, 'greeted'); }
    if (route.act === 'pair') { await pair(sql, update, route.token); return ok(res, 'pairing'); }
    if (route.act === 'help') { await say(update.chatId, SAY.help); return ok(res, 'help'); }

    /* Отсюда и ниже всё требует аккаунта, и routeOf уже это обеспечил - но проверка стоит здесь ещё раз,
     * потому что именно тут начинаются последствия. Пропуск в этой ветке стоит чужого прогона. */
    if (!userId) { await greet(sql, update); return ok(res, 'no account'); }

    /* Последнее, что видели от этого отправителя, - для будущего разговора о частоте и для отзыва. */
    sql`update chat_sender set seen_at = now() where channel = ${CHANNEL} and sender_id = ${update.senderId}`
      .catch(() => {});

    if (route.act === 'status') { await status(sql, update, userId); return ok(res, 'status'); }
    if (route.act === 'stop') { await stop(sql, update, userId); return ok(res, 'stopped'); }
    if (route.act === 'decide') { await decide(sql, update, userId); return ok(res, 'decided'); }
    if (route.act === 'goal') { await offer(sql, update, userId); return ok(res, 'offered'); }
    return ok(res, 'nothing to do');
  } catch (err) {
    if (/chat_draft/.test(String(err.message))) {
      await say(update.chatId, 'This deployment has no channel table yet (db/024_chat_channel.sql is not '
        + 'applied). Nothing was run.');
      return ok(res, 'db/024 not applied');
    }
    await report(err, req, { route: 'telegram' });
    /* Человеку - словами, телеграму - 200: иначе он будет повторять эту же ошибку с нарастающей задержкой,
     * и каждая попытка снова дойдёт до того же места. */
    await say(update.chatId, `Something went wrong on my side: ${err && err.message}. Nothing was run.`);
    return ok(res, 'failed');
  }
}

export default wrap(handler, 'telegram');
