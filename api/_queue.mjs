/* Дверь в очередь: положить одну работу и сказать честно, если положить её некуда.
 *
 * ЗАЧЕМ ОТДЕЛЬНЫЙ МОДУЛЬ, если очередь - это одна вставка в run_queue. Потому что вставка - меньшая часть
 * дела. Перед ней стоят две проверки, и у обеих есть СЛОВА, которые человек читает вместо результата:
 *
 *   - на аккаунте никогда не было машины, берущей работу - значит запускать не на чем, и в ответе должно
 *     стоять, что именно нажать, чтобы стало;
 *   - машина занята другой работой - одна мышь, и вторая работа не встаёт в очередь за первой молча.
 *
 * Эти два ответа уже существовали в api/mcp.js (queueAndWait) и понадобились странице тестов: кейс
 * запускается кнопкой «Run now», и она обязана отвечать теми же словами. Две копии одного отказа - это
 * инструкция, которая в одном месте останется верной, а в другом устареет; ровно это здесь уже случилось
 * однажды, когда в отказе называли воркера и команду, которых больше нет.
 *
 * ЧТО ЗДЕСЬ НЕ ПРОИСХОДИТ: ожидания. Тул MCP ждёт машину до 25 секунд, потому что ему надо ответить
 * результатом; страница не ждёт вовсе - она смотрит на Activity. Ожидание осталось у того, кому оно нужно.
 */
import { ONE_WAY } from './_brain.mjs';

/* Said in three different failures, so it is written once: an instruction that drifts between messages is
 * an instruction somebody follows to two different places. */
export const WHERE = 'open MouseFlow, click your avatar at the bottom of the sidebar, then Connections, then '
  + '"Let Claude drive this computer"';

export const jobId = () => `q_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** Расписание - та же очередь, только повторяющаяся, поэтому и id живёт здесь же. */
export const scheduleId = () => `sch_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/* СЛОВАРЬ ОЧЕРЕДИ, который пишет одна половина и читает другая.
 *
 * Работа, которую может выполнить ТОЛЬКО браузерное расширение: свободная цель, поставленная
 * mouseflow_do. Помечена идентификатором на '#', как и остальные команды, и на '.browser' - потому что
 * очередь развозит работу по поверхностям, и то, что умеет одна, обязано о себе это говорить: иначе
 * заберёт другая и ответит «не понимаю», а ход потрачен.
 *
 * ЗДЕСЬ, А НЕ В ОДНОЙ ИЗ ПОЛОВИН api/mcp.js: его пишет каталог тулов, а читает воркерский протокол, и
 * если положить эту строку в любую из них, вторая начнёт импортировать первую - после чего имя файла
 * перестанет отвечать на вопрос «чей это продукт», ради которого их и разделили. */
export const BROWSER_GOAL = '#goal.browser';

/* И ТА ЖЕ СВОБОДНАЯ ЦЕЛЬ НА ДЕСКТОПЕ - просьба, у которой нет навыка за спиной (SPLIT-PLAN §7.2, шаг 14a).
 *
 * Симметрична BROWSER_GOAL и заведена по тому же доводу: очередь развозит работу по поверхностям, и та,
 * что умеет одна, обязана о себе это говорить. Но одного имени мало - у этой работы есть второе свойство,
 * которого нет у прочих команд на '#': её может взять ТОЛЬКО забирающий с моделью в цикле. Курьер агента
 * умеет запустить запись, остановить её и проиграть тело; цель он брать не должен - он ответит «asked to
 * do something it does not understand», и ход будет потрачен. Ровно это и случилось в первый же прогон из
 * телеграма: строка на '#' в выборе claim'а проходила мимо проверки «умеешь ли ты цели».
 *
 * Поэтому имя названо ЗДЕСЬ, рядом с браузерным: его читают обе половины api/mcp.js и дверь мессенджера,
 * и положить его в любую из них значило бы, что вторая начнёт импортировать первую. */
export const DESKTOP_GOAL = '#goal.desktop';

/** Whether a machine has asked for work lately, and when. */
export async function workerSeen(sql, userId) {
  try {
    const rows = await sql`
      select value from user_pref where user_id = ${userId} and key = 'worker.seen'
    `;
    if (!rows.length) return null;
    const at = new Date(rows[0].value);
    return Number.isFinite(at.getTime()) ? at : null;
  } catch (_) {
    /* No table on this deployment yet. Absent is not false: it means nothing is known, and the caller is
     * told that rather than told there is no worker. */
    return undefined;
  }
}

/* ------------------------------------------------------------------ МАШИНЫ (Hivelink H1)
 *
 * Машина - это токен агента (см. db/025_device.sql и byDeviceToken). Метку ставит привязка агента на
 * Connections; расширение и токены, выданные руками, - не машины, которым дают команды. */
export const AGENT_LABEL = 'This computer';

/* «На связи» - спрашивал работу недавно. Агент спрашивает каждые 3 с и при сбоях отступает до 60 с, так что
 * полторы минуты тишины значат, что он выключен, спит или работу не берёт. last_used_at, а не seen_at из 025:
 * он есть на любом развёртывании и пишется на каждом запросе с токеном - для «жив ли» этого достаточно. */
export const DEVICE_ONLINE_MS = 90_000;

/** Сколько машин аккаунта сейчас на связи. 0 - ни одной, и это тоже ответ. */
export async function onlineAgents(sql, userId) {
  try {
    const rows = await sql`
      select count(*)::int as n from device_token
      where user_id = ${userId} and revoked_at is null and label = ${AGENT_LABEL}
        and last_used_at > now() - ${`${Math.round(DEVICE_ONLINE_MS / 1000)} seconds`}::interval
    `;
    return rows.length ? Number(rows[0].n) || 0 : 0;
  } catch (_) {
    return 0;
  }
}

/** Машина этого аккаунта по id, или null - чужая, отозванная или несуществующая выглядят одинаково. */
export async function deviceOf(sql, userId, deviceId) {
  if (!deviceId || !/^dev_[0-9a-f]{4,40}$/.test(String(deviceId))) return null;
  const rows = await sql`
    select id, label, to_jsonb(device_token) ->> 'name' as name, to_jsonb(device_token) ->> 'hostname' as hostname
    from device_token where id = ${String(deviceId)} and user_id = ${userId} and revoked_at is null limit 1
  `;
  return rows.length ? rows[0] : null;
}

/** Как назвать машину в словах отказа: её имя, имя компьютера или, если не знаем ничего, «that machine». */
export const deviceSaid = (one) => (one && (one.name || one.hostname)) || 'that machine';

/* ЧТО СЕЙЧАС ЗАНЯТО. Одна работа на МАШИНУ, а не на аккаунт: десять машин - десять мышей.
 *
 * Работа с привязкой (run_queue.machine) занимает свою машину; без привязки - любую свободную. Поэтому:
 *   - привязанная к D встаёт, если у D нет ни поставленной на неё, ни взятой ею работы;
 *   - непривязанная встаёт, если работ в ходу меньше, чем машин на связи (и не меньше одной - машина,
 *     замолчавшая минуту назад, всё ещё может взять следующую, как это было до H1).
 * claimed_device - через to_jsonb, как machine у 022: до применения 025 колонки нет, и запрос, назвавший
 * её прямо, ронял бы постановку в очередь целиком, а не «не считал по машинам». */
async function busyFor(sql, userId, pin) {
  const active = await sql`
    select id, tool_name, to_jsonb(q) ->> 'machine' as machine, to_jsonb(q) ->> 'claimed_device' as claimed_device
    from run_queue q where user_id = ${userId} and state in ('queued', 'claimed')
  `;
  if (pin) {
    const mine = active.find((one) => one.machine === pin || one.claimed_device === pin);
    return mine || null;
  }
  const seats = Math.max(1, await onlineAgents(sql, userId));
  return active.length >= seats ? active[0] : null;
}

/** То же правило для часов расписаний (dueNow): можно ли поставить ещё одну работу без привязки. */
export async function roomForOne(sql, userId) {
  return !(await busyFor(sql, userId, null));
}

/**
 * Положить одну работу в очередь, если её есть куда положить.
 *
 * @returns {Promise<{ id: string, unpinned?: string, why?: undefined }
 *   | { id?: undefined, why: string, kind: 'no-machine'|'busy' }>}
 *   `why` - готовый ответ человеку, а не код ошибки: у обоих отказов ровно один способ быть полезным.
 *   `unpinned` - работа поставлена, но привязать её к машине НЕ УДАЛОСЬ; вызывающий обязан сказать это
 *   вслух, см. ниже.
 */
export async function queueOne(
  sql, userId, { flowId, toolName, args, scheduleId = null, machine = null, device = null },
) {
  const seen = await workerSeen(sql, userId);
  if (seen === null) {
    return {
      kind: 'no-machine',
      why: 'This account has no computer listening, so there is nothing to run this on. To let one: '
        + WHERE + ". It takes one click - nothing to type, nothing to copy - and the agent's own menu bar is "
        + 'where you switch it off again. Nothing was queued.',
    };
  }

  /* МАШИНА, НАЗВАННАЯ ПО ID (Hivelink H1). Чужая или отозванная - отказ словами, а не работа, которую
   * никто никогда не возьмёт. Имя компьютера (`machine`, у кейсов) по-прежнему принимается как было. */
  let target = null;
  if (device) {
    target = await deviceOf(sql, userId, device);
    if (!target) {
      return {
        kind: 'no-device',
        why: 'That machine is not attached to this account any more, so nothing was queued for it. Pick one '
          + 'from the machines on Overview.',
      };
    }
  }
  const pin = target ? target.id : machine;

  const already = await busyFor(sql, userId, pin);
  if (already) {
    return {
      kind: 'busy',
      why: (pin
        ? `${deviceSaid(target)} is already busy (${already.tool_name || already.id}). One thing at a time on `
          + 'one machine - there is one mouse. Wait for it, or call mouseflow_stop.'
        : `Every machine that is listening is already busy (${already.tool_name || already.id}). One thing at `
          + 'a time per machine - there is one mouse each. Wait for one, or call mouseflow_stop.'),
    };
  }

  const id = jobId();
  await sql`
    insert into run_queue (id, user_id, flow_id, tool_name, args, schedule_id)
    values (${id}, ${userId}, ${flowId}, ${toolName}, ${JSON.stringify(args || {})}, ${scheduleId})
  `;

  /* ПРИВЯЗКА К МАШИНЕ - ВТОРЫМ ОПЕРАТОРОМ, И ЭТО ПРО НЕПРИМЕНЁННУЮ МИГРАЦИЮ.
   *
   * 022 (run_queue.machine) написана и НЕ применена - применяется только по явному разрешению владельца.
   * Назвать колонку во вставке выше значило бы, что до применения падает вся постановка в очередь, то
   * есть ломается всё, а не «не работает привязка». Отдельный UPDATE падает один и ничего за собой не
   * уносит: работа уже стоит.
   *
   * НО НЕ МОЛЧА. Кейс, привязанный к QA-VM и запущенный где угодно, - это ровно ложное зелёное: человек
   * думает, что проверял на той машине, а проверяли на этой. Поэтому неудача привязки ВОЗВРАЩАЕТСЯ, и
   * вызывающий обязан сказать её словами. Тихий catch тут был бы худшим из возможных решений. */
  if (!pin) return { id };
  try {
    await sql`update run_queue set machine = ${pin} where id = ${id} and user_id = ${userId}`;
    return { id };
  } catch (_) {
    return { id, unpinned: pin };
  }
}

/* ------------------------------------------------------------------ РЕЖИМ: автомат или «спроси прежде»
 *
 * ГДЕ ЛЕЖИТ ВЫБОР. В user_pref, а не на аккаунте отдельной колонкой: это предпочтение человека, а не факт
 * о нём. Ключ с точкой - как `worker.seen` и `model.desktop`.
 *
 * ЗДЕСЬ, А НЕ В api/queue.js, с 2026-09-28: его читают две двери - панель (api/queue.js) и мессенджер
 * (api/telegram.js, команда /mode), - и выбор, сделанный в одной, обязан действовать в другой. Две копии
 * чтения однажды разошлись бы в том, что значит «не выбрано». */
export const MODE_KEY = 'gate.mode';

/** Что выбрано. Отсутствие строки - автомат, и отсутствие ТАБЛИЦЫ тоже: absent не значит «включить». */
export async function modeOf(sql, userId) {
  try {
    const [row] = await sql`select value from user_pref where user_id = ${userId} and key = ${MODE_KEY}`;
    return row && row.value === ONE_WAY ? ONE_WAY : 'auto';
  } catch (_) {
    return 'auto';
  }
}

/** Запомнить выбор. Всё, кроме ONE_WAY, - автомат: неизвестное значение не включает остановки. */
export async function setMode(sql, userId, mode) {
  const want = mode === ONE_WAY ? ONE_WAY : '';
  await sql`
    insert into user_pref (user_id, key, value) values (${userId}, ${MODE_KEY}, ${want})
    on conflict (user_id, key) do update set value = excluded.value
  `;
  return want || 'auto';
}
