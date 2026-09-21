/* Один мессенджер как входная дверь - всё, что решается БЕЗ базы и БЕЗ сети (SPLIT-PLAN §7.2, шаг 14a).
 *
 * ЧТО ТУТ ПРОИСХОДИТ, ОДНОЙ ФРАЗОЙ: сообщение превращается в НАМЕРЕНИЕ, а намерение показывается человеку
 * планом с двумя кнопками, и работа в очередь уходит только после «Approve». То есть одобрение стоит ДО
 * прогона, а не внутри него, - и поэтому ни один драйвер и ни один агент здесь не тронуты. Шлюз внутри
 * прогона - это шаг 14b, отдельный и заметно дороже; см. §7.2 и комментарий над toolsFor в api/_brain.mjs,
 * где сказано, почему облачный путь сегодня без шлюза нарочно.
 *
 * ПОЧЕМУ ЧИСТЫЙ МОДУЛЬ, А НЕ ВСЁ В МАРШРУТЕ. Здесь живут решения, у которых есть ПРАВИЛЬНЫЙ ОТВЕТ и
 * которые поэтому надо выполнять в тестах: кого обслуживаем, что считается командой, что отвечаем чужому.
 * Всё, у чего ответа нет, а есть последствие - запись в базу, вызов модели, отправка сообщения, - лежит в
 * api/telegram.js. Ровно то же деление, что у _memory.mjs и memory.js.
 *
 * ЧТО ВЗЯТО У OPENCLAW (MIT) - замысел, не код. Их телеграм-расширение это 284 файла и 2 МБ; наша очередь
 * уже делает трудную половину. Взяты четыре правила, каждое из которых здесь исполняется:
 *   - вебхук, а не длинный опрос: серверная функция не может держать соединение;
 *   - незнакомца СПАРИВАЮТ, а не обслуживают;
 *   - правленое сообщение НИКОГДА не отвечает - иначе правка старого запускает работу заново;
 *   - хранится идентификатор отправителя, а не имя: имена меняются.
 * Пятое правило наше: ограничение частоты. У них его в этом файле нет, а за нашими сообщениями - мышь.
 */

export const CHANNEL = 'telegram';

/* Сколько живёт показанный план. Полчаса - это «отвлёкся и вернулся», но не «нашёл вчерашнее сообщение и
 * нажал». Одобрение вчерашнего плана - это работа, о которой человек уже не помнит, на машине, которая с
 * тех пор выглядит иначе. */
export const DRAFT_TTL_MS = 30 * 60 * 1000;

/* Документ крупнее этого даже не скачивается. Потолок цели - двадцать тысяч знаков (api/_brain.mjs), то
 * есть от файла на пять мегабайт в прогон попало бы полпроцента: платить за скачивание и ждать его ради
 * этого незачем, и честнее отказать словами, чем молча приложить огрызок. */
export const DOC_MAX_BYTES = 512_000;

/** callback_data у телеграма - 64 байта. Идентификатор чернового плана короткий по этой причине. */
export const draftId = () => `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/* ВСЕ СЛОВА В ОДНОМ МЕСТЕ. Отказ, объяснённый в двух местах по-разному, - это инструкция, которая в одном
 * из них однажды устареет; ровно это уже случалось в этом проекте с WHERE (api/_queue.mjs), и WHERE
 * поэтому здесь ЦИТИРУЕТСЯ, а не переписывается. */
export const SAY = {
  stranger: 'I do not know you yet, so nothing will run.\n\n'
    + 'To pair this chat with your MouseFlow account, send me:\n'
    + '/pair mf_your_device_token\n\n'
    + 'A device token is made in MouseFlow: click your avatar at the bottom of the sidebar, then '
    + 'Connections. I delete the message with the token in it as soon as I have read it.',
  paired: 'Paired. This chat can now start work on your machines.\n\n'
    + 'Send me what you want done, in a sentence - typed, or held down as a voice message. Attach a text '
    + 'file if the task needs one. You will see the plan first, and nothing runs until you press Approve.',
  notAToken: 'That does not look like a device token. It begins with mf_ and is made in MouseFlow: '
    + 'avatar at the bottom of the sidebar, then Connections.',
  badToken: 'That token is not valid on this deployment - it may have been revoked. '
    + 'Make a new one in MouseFlow (avatar, then Connections) and send it again.',
  groups: 'I only work in a direct chat. A group has more than one person in it, and what runs here moves '
    + 'a real mouse on somebody\'s computer.',
  help: 'Send a sentence saying what you want done, and attach a text file if it is needed.\n\n'
    + 'A voice message works too - it is sent to OpenAI to be recognised, and you will see exactly what '
    + 'was heard above the plan, before anything runs.\n\n'
    + 'You will get a plan with Approve and Cancel. Nothing runs until Approve.\n\n'
    + '/status - is a computer of yours awake and taking work\n'
    + '/stop - stop whatever is running\n'
    + '/pair mf_... - pair this chat with an account',
  empty: 'There is nothing in that message to do. Say what you want done, in a sentence.',
  declined: 'Cancelled. Nothing was run.',
  expired: 'That plan is older than half an hour, so I did not run it. Send the task again and you will '
    + 'get a fresh plan.',
  gone: 'I do not have that plan any more.',
  tooBusy: 'You are sending faster than this can safely be answered. Wait a moment.',
  /* Голосовое, из которого ничего не вышло. Тишина в ответ на голосовое читалась бы как «не расслышал и
   * стесняюсь сказать», а человек в этот момент решает, повторить или напечатать. */
  heardNothing: 'I could not make out anything in that recording. Say it again, or type it.',
};

/**
 * Что вообще приехало. Всё, что не сообщение в личке и не нажатие кнопки, - `ignored` С ПРИЧИНОЙ: молчание
 * без причины неотличимо от поломки, а причину читает лог и тест.
 *
 * ПРАВЛЕНОЕ СООБЩЕНИЕ - отдельная причина, и это правило, а не мелочь: телеграм присылает правку как
 * `edited_message`, и обслужить её значит запустить работу заново, когда человек поправил опечатку в
 * позавчерашней просьбе.
 */
export function updateOf(body) {
  const u = body && typeof body === 'object' ? body : {};
  if (u.edited_message || u.edited_channel_post) {
    return { kind: 'ignored', why: 'an edited message never replies' };
  }
  if (u.callback_query && typeof u.callback_query === 'object') {
    const q = u.callback_query;
    const msg = q.message && typeof q.message === 'object' ? q.message : {};
    const chat = msg.chat && typeof msg.chat === 'object' ? msg.chat : {};
    return {
      kind: 'callback',
      callbackId: String(q.id || ''),
      senderId: q.from && q.from.id != null ? String(q.from.id) : '',
      chatId: chat.id != null ? String(chat.id) : '',
      chatType: String(chat.type || 'private'),
      messageId: msg.message_id != null ? Number(msg.message_id) : null,
      data: String(q.data || ''),
    };
  }
  const m = u.message && typeof u.message === 'object' ? u.message : null;
  if (!m) return { kind: 'ignored', why: 'no message and no button in this update' };
  const chat = m.chat && typeof m.chat === 'object' ? m.chat : {};
  const doc = m.document && typeof m.document === 'object' ? m.document : null;
  /* ГОЛОСОВОЕ - ЭТО ТА ЖЕ ДИКТОВКА, ТОЛЬКО ПРИЕХАВШАЯ ФАЙЛОМ (SPLIT-PLAN §7, шаг 13). Телеграм зовёт её
   * `voice` (ogg/opus, записана кнопкой микрофона) и `audio` (присланный музыкальный файл); для нас это
   * одно и то же - звук, который надо узнать. Разбирается здесь, а не в маршруте, потому что «что
   * приехало» - это вопрос с правильным ответом. */
  const heard = (m.voice && typeof m.voice === 'object' && m.voice)
    || (m.audio && typeof m.audio === 'object' && m.audio) || null;
  return {
    kind: 'message',
    senderId: m.from && m.from.id != null ? String(m.from.id) : '',
    chatId: chat.id != null ? String(chat.id) : '',
    chatType: String(chat.type || 'private'),
    messageId: m.message_id != null ? Number(m.message_id) : null,
    /* Подпись под документом - это тот же текст: человек, приложивший файл, пишет просьбу над ним. */
    text: String(m.text || m.caption || '').trim(),
    document: doc
      ? {
        fileId: String(doc.file_id || ''),
        name: String(doc.file_name || 'attachment').slice(0, 120),
        bytes: Number(doc.file_size) || 0,
        mime: String(doc.mime_type || ''),
      }
      : null,
    voice: heard
      ? {
        fileId: String(heard.file_id || ''),
        bytes: Number(heard.file_size) || 0,
        /* Умолчание названо: телеграм почти всегда присылает ogg/opus у голосовых, но «почти» - это не
         * «всегда», и пустой тип у нас означал бы отказ «не сказано, какой это звук» на совершенно
         * обычном сообщении. */
        mime: String(heard.mime_type || 'audio/ogg'),
        seconds: Number(heard.duration) || 0,
      }
      : null,
  };
}

/** `/pair mf_x` → `{ name: 'pair', rest: 'mf_x' }`. Не команда - null, и это не ошибка, а обычный случай. */
export function commandOf(text) {
  const said = String(text || '').trim();
  if (!said.startsWith('/')) return null;
  /* `/status@my_bot` - то же самое: в группах телеграм дописывает имя бота, и команда, не узнавшая себя
   * из-за суффикса, отвечает «не понял» там, где человек всё сделал правильно. */
  const m = /^\/([a-z_]{1,32})(?:@[\w]{1,64})?(?:\s+([\s\S]*))?$/i.exec(said);
  if (!m) return null;
  return { name: m[1].toLowerCase(), rest: (m[2] || '').trim() };
}

/** Похоже ли это на наш токен устройства. Проверка формы, а не подлинности: подлинность знает только база. */
export const looksLikeDeviceToken = (said) => /^mf_[A-Za-z0-9_-]{8,200}$/.test(String(said || '').trim());

/**
 * Кого и чем обслуживаем. Всё решение - одной функцией, чтобы его можно было ВЫПОЛНИТЬ в тесте, а не
 * вычитывать из ветвей маршрута.
 *
 * ЧЕТЫРЕ СОСТОЯНИЯ НЕЗНАКОМЦА, ровно как у openclaw: заблокирован - молчим; спаривается - говорим, как;
 * спарен - обслуживаем; о группах у нас своя политика, и она сегодня «нет».
 *
 * ПОРЯДОК ВЕТВЕЙ - ЭТО И ЕСТЬ ПРАВИЛО. `/pair` стоит выше «я тебя не знаю», иначе спариться нельзя
 * никогда; блокировка стоит выше `/pair`, иначе блокировка ничего не значит.
 *
 * @param {{ row: { state?: string, user_id?: string|null } | null, update: ReturnType<typeof updateOf> }} at
 * @returns {{ act: 'ignore'|'refuse'|'greet'|'pair'|'help'|'status'|'stop'|'goal'|'decide',
 *             say?: string, token?: string, data?: string }}
 */
export function routeOf({ row, update }) {
  if (!update || update.kind === 'ignored') return { act: 'ignore' };
  if (!update.senderId) return { act: 'ignore' };

  const state = row && row.state ? String(row.state) : null;
  /* Заблокированному не отвечают вовсе. Ответ «вам нельзя» - это подтверждение, что бот жив и что этот
   * адрес чего-то стоит; молчание не подтверждает ничего. */
  if (state === 'blocked') return { act: 'ignore' };

  if (update.chatType !== 'private') return { act: 'refuse', say: SAY.groups };

  if (update.kind === 'callback') {
    if (state !== 'allowed' || !(row && row.user_id)) return { act: 'greet' };
    return { act: 'decide', data: update.data };
  }

  const command = commandOf(update.text);
  if (command && command.name === 'pair') {
    if (!looksLikeDeviceToken(command.rest)) return { act: 'refuse', say: SAY.notAToken };
    return { act: 'pair', token: command.rest };
  }

  /* Незнакомцу - одно и то же на что угодно, включая команды: обслуживание начинается со спаривания, и
   * /status, ответивший незнакомцу про чужую машину, рассказал бы о чужом аккаунте. */
  if (state !== 'allowed' || !(row && row.user_id)) return { act: 'greet' };

  if (command) {
    if (command.name === 'status') return { act: 'status' };
    if (command.name === 'stop') return { act: 'stop' };
    /* `/start` у телеграма - первое, что нажимают; для спаренного это просто «напомни, что ты умеешь». */
    return { act: 'help' };
  }
  if (!update.text && !update.document && !update.voice) return { act: 'refuse', say: SAY.empty };
  return { act: 'goal' };
}

/** Почему этот документ не берём, или null. */
export function refusedDocument(doc) {
  if (!doc) return null;
  if (doc.bytes > DOC_MAX_BYTES) {
    return `${doc.name} is ${Math.round(doc.bytes / 1024)} kB, and a goal holds at most 20 000 characters - `
      + 'almost none of it would arrive. Send the part that matters.';
  }
  return null;
}

/* ПЛАН СЛОВАМИ - и первой строкой то, чем он НЕ является.
 *
 * Цикл реактивный: плана он не получает и о нём не узнаёт (см. api/_plan.mjs). Чекпоинты с номерами,
 * притворяющиеся программой, - худший вид полировки, потому что выглядят как гарантия. В чате это опаснее,
 * чем на странице: человек не видит экрана и у него нет ничего, кроме этих строк. */
export function planMessage({ plan, files = [], heard = null }) {
  const lines = [];
  /* ЧТО УСЛЫШАНО - ПЕРВОЙ СТРОКОЙ, ВЫШЕ ПЛАНА. У продиктованной задачи появился новый способ пойти не
   * туда, которого у напечатанной нет: распознавание. План, построенный по неверно услышанной фразе,
   * выглядит совершенно связным - он и есть связный, просто не про то, - и единственный момент, когда
   * это можно поймать, наступает до нажатия Approve. Поэтому сказанное показывается ДОСЛОВНО, а не
   * пересказывается заголовком плана. */
  if (heard) lines.push(`Heard: "${heard}"`, '');
  lines.push(plan && plan.title ? String(plan.title) : 'What I intend to do', '');
  (plan && Array.isArray(plan.checkpoints) ? plan.checkpoints : []).forEach((one, i) => {
    lines.push(`${i + 1}. ${one.title}${one.detail ? ` - ${one.detail}` : ''}`);
  });
  if (files.length) {
    lines.push('', `Attached: ${files.map((f) => `${f.name}${f.clipped ? ' (clipped)' : ''}`).join(', ')}`);
  }
  lines.push(
    '',
    'This is what I intend, not a script - the run decides each step from what is on screen, and it may '
    + 'go another way.',
    'Approve to start it on your machine.',
  );
  return lines.join('\n');
}

export const keyboardFor = (id) => ({
  inline_keyboard: [[
    { text: 'Approve', callback_data: `ok:${id}` },
    { text: 'Cancel', callback_data: `no:${id}` },
  ]],
});

/** Что нажали. Неизвестная кнопка - null, а не «наверное, одобрили». */
export function verdictOf(data) {
  const m = /^(ok|no):([A-Za-z0-9]{1,48})$/.exec(String(data || ''));
  return m ? { verdict: m[1] === 'ok' ? 'approved' : 'declined', draftId: m[2] } : null;
}

/** Просрочен ли показанный план. Считается от времени показа, а не от нажатия. */
export const expired = (createdAt, now = Date.now()) => {
  const at = new Date(createdAt).getTime();
  return !Number.isFinite(at) || now - at > DRAFT_TTL_MS;
};

/** Как прогон закончился, одним сообщением. */
export function outcomeMessage({ ok, said }) {
  const words = String(said || '').trim() || (ok ? 'Done.' : 'It did not finish, and said nothing about why.');
  return `${ok ? 'Done' : 'Not done'} - ${words}`;
}
