/* Spending the shared key on a conversation that carries pictures.
 *
 * api/_provider.js is the general way to talk to a model and it deliberately carries no images - the note at
 * its head says so, and points here. This is the other path: the decision loop's turn, which is a screenshot
 * plus a tool schema, and which has always gone straight to Anthropic.
 *
 * It lived inside api/claude.js, which is the endpoint the BROWSER calls. The cloud step has to make the same
 * call from inside another function, and calling our own HTTP endpoint to do it would be a second invocation,
 * a second authentication and a second set of caps that can drift from these. So the call moved here and both
 * use it. The caps are the point of the file as much as the fetch is: this spends money for anyone who can
 * reach it, so what ONE request can cost is bounded here, once.
 */

const UPSTREAM = 'https://api.anthropic.com/v1/messages';

// Only what the loops use, and only within these bounds.
export const ALLOWED_MODELS = new Set(['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5-20251001']);
export const MAX_TOKENS_CAP = 16000;
export const MAX_MESSAGES = 120;         // a runaway loop hits this long before it hits the balance
/* Vision turns carry a picture, and the platform allows ~4.5MB. A cap of 1.5MB made this the tightest gate
 * in the chain at a third of what the platform permits - and the failure it produced said only "request too
 * large". The agents send JPEG now, which is where the real saving is; this is the backstop, and it reports
 * the size so the number is not a mystery. */
export const MAX_BODY_BYTES = 4_000_000;

/* ЧТО У ЭТОГО ЗАПРОСА НЕ МЕНЯЕТСЯ ОТ ХОДА К ХОДУ - и почему это самое дорогое место в цикле.
 *
 * ИЗМЕРЕНО НА ПРОГОНАХ (пункт 6 плана требует мерить до и после; запрос - в самом пункте): медиана
 * решения модели 5035 мс, p90 9560, p99 18159. И она РОВНАЯ по инструментам: click 5238, press_key 5848,
 * type_text 5504, activate_window 4197 - разброс меньше, чем между двумя прогонами одного инструмента.
 * То есть платится не за инструмент и не за картинку решения, а ЗА ХОД: каждый ход заново отправляет
 * несколько тысяч токенов, которые не менялись, - SYSTEM и схему инструментов.
 *
 * `cache_control` помечает конец такого префикса. Дальше платформа отдаёт его из кеша: время до первого
 * токена падает на каждом ходу, кроме первого, а при медиане в 13 шагов на удачный прогон первый ход -
 * одна тринадцатая.
 *
 * ДВЕ ОТМЕТКИ, А НЕ ОДНА, и порядок здесь и есть смысл. Префикс запроса - это system, потом tools, потом
 * messages; отметка кеширует ВСЁ ДО СЕБЯ. Отметка на последнем инструменте кеширует system+tools одним
 * куском - это и есть та неменяющаяся часть. Отметка на system нужна отдельно для тех вызовов, у которых
 * инструментов нет вовсе (askForHandoff в api/_step.mjs зовёт с HANDOFF_SYSTEM и без tools).
 *
 * ПОЧЕМУ ПОСЛЕДНИЙ ИНСТРУМЕНТ - ЭТО ВСЕГДА `finish`: в TOOLS он стоит последним, а toolsFor вырезает
 * только reached_checkpoint, который стоит раньше. Отметка ставится на ПОЗИЦИЮ, а не на имя, поэтому её
 * не сломает переименование - но сломает потеря этого порядка, и на это стоит пин.
 *
 * ЧЕГО ЗДЕСЬ НЕТ: порога «кешировать только длинное». Платформа сама не кеширует префикс короче своего
 * минимума, и делает это молча - то есть порог здесь был бы вторым, нашим, который однажды разошёлся бы
 * с её первым.
 *
 * И `system` СТАНОВИТСЯ МАССИВОМ БЛОКОВ. На строку отметку не поставить; массив с одним текстовым блоком
 * для модели - то же самое. Массив на входе пропускается как есть: вызывающий, который уже собрал блоки,
 * знает про них больше, чем это место. */
const EPHEMERAL = { type: 'ephemeral' };

/* ТРЕТЬЯ ОТМЕТКА - НА ПЕРВОМ СООБЩЕНИИ, и вот что она кеширует.
 *
 * Префикс запроса - system, tools, messages. Первые две отметки закрывают system+tools; на этом кеш и
 * кончался, а сразу за ним лежит `messages[0]` - открывающее сообщение, то есть ЦЕЛЬ: что попросили,
 * признак готовности, фон прошлых прогонов и всё, что человек приложил файлом. За прогон оно не меняется
 * ни разу, а отправлялось заново на каждом из тринадцати ходов по полной цене. Отметка на нём двигает
 * границу кеша за него.
 *
 * ИМЕННО ЭТО ДЕЛАЕТ ВОЗМОЖНЫМ БОЛЬШОЙ GOAL_MAX (api/_brain.mjs): двадцать килобайт приложенного текста
 * платятся один раз записью в кеш, а не тринадцать раз отправкой.
 *
 * КОПИЕЙ, А НЕ НА МЕСТЕ, и это не стиль. `loop.messages` уезжает в `run_queue.loop` jsonb между ходами
 * (api/_step.mjs), поэтому отметка, поставленная на месте, СОХРАНИЛАСЬ БЫ В БАЗЕ и уехала бы во все
 * будущие запросы этого прогона - и в те, где она уже не первая. Тот же довод, по которому ниже копируется
 * общий массив TOOLS, только цена ошибки выше: там расползлось бы по процессу, здесь - по таблице.
 *
 * СТРОКА СТАНОВИТСЯ БЛОКОМ: openingMessage (api/_brain.mjs) отдаёт content строкой, а отметку можно
 * поставить только на блок. Массив с одним текстовым блоком для модели - то же самое, что строка.
 *
 * УЖЕ ОТМЕЧЕННОЕ НЕ ОТМЕЧАЕТСЯ ДВАЖДЫ: вызывающий, собравший блоки сам, знает про них больше. */
function withCachedOpening(messages) {
  if (!Array.isArray(messages) || !messages.length) return messages;
  const first = messages[0];
  if (!first || typeof first !== 'object') return messages;

  if (typeof first.content === 'string') {
    if (!first.content) return messages;
    return [
      { ...first, content: [{ type: 'text', text: first.content, cache_control: EPHEMERAL }] },
      ...messages.slice(1),
    ];
  }
  if (Array.isArray(first.content) && first.content.length) {
    const last = first.content[first.content.length - 1];
    if (!last || typeof last !== 'object' || last.cache_control) return messages;
    return [
      { ...first, content: [...first.content.slice(0, -1), { ...last, cache_control: EPHEMERAL }] },
      ...messages.slice(1),
    ];
  }
  return messages;
}
/* Rebuilt field by field rather than forwarded wholesale, so a caller cannot smuggle in options this is not
 * meant to pay for. */
export function payloadFor(body) {
  const payload = {
    model: body.model,
    max_tokens: Math.min(Number(body.max_tokens) || 4096, MAX_TOKENS_CAP),
    messages: withCachedOpening(body.messages),
  };
  if (typeof body.system === 'string' && body.system) {
    payload.system = [{ type: 'text', text: body.system, cache_control: EPHEMERAL }];
  } else if (Array.isArray(body.system)) {
    payload.system = body.system;
  }
  if (Array.isArray(body.tools)) {
    /* КОПИЕЙ, А НЕ НА МЕСТЕ: TOOLS - общий экспортированный массив (api/_brain.mjs), и дописать в него
     * cache_control значило бы дописать его во все будущие запросы и во всё, что этот массив читает. */
    payload.tools = body.tools.map((tool, i) => (i === body.tools.length - 1
      && tool && typeof tool === 'object'
      ? { ...tool, cache_control: EPHEMERAL }
      : tool));
  }
  if (body.tool_choice) payload.tool_choice = body.tool_choice;
  if (body.fallbacks) payload.fallbacks = body.fallbacks;
  return payload;
}

/**
 * One turn, upstream. Never throws: every way this can fail is a field, because both callers have to say
 * something specific about each and an exception says the same thing about all of them.
 *
 * @returns {Promise<{status:number, text:string, contentType:string, bytes:number,
 *                    tooLarge?:boolean, unreachable?:string}>}
 */
export async function callModel(body, key, signal) {
  const encoded = JSON.stringify(payloadFor(body));
  if (encoded.length > MAX_BODY_BYTES) {
    return { status: 413, text: '', contentType: 'application/json', bytes: encoded.length, tooLarge: true };
  }

  let upstream;
  try {
    upstream = await fetch(UPSTREAM, {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        /* Opus 5's safety classifiers can decline a request; this re-runs it on the recommended fallback
         * server-side instead of handing back a dead end. */
        'anthropic-beta': 'server-side-fallback-2026-07-01',
      },
      body: encoded,
    });
  } catch (err) {
    return {
      status: 502, text: '', contentType: 'application/json', bytes: encoded.length,
      unreachable: err && err.message ? err.message : 'the request failed',
    };
  }

  return {
    status: upstream.status,
    text: await upstream.text(),
    contentType: upstream.headers.get('content-type') || 'application/json',
    bytes: encoded.length,
  };
}
