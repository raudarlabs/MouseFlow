/* Лист ожидания: правила и сам ответ. Маршрут - api/waitlist.js, таблицы - db/026_waitlist.sql.
 *
 *   POST /api/waitlist   Content-Type: application/json
 *        { email, website: "" (ловушка), source: "landing", ref?: "≤200 символов" }
 *   200 {"ok":true}                                  новый адрес, повтор и ловушка - одинаково
 *   400 {"ok":false,"error":"invalid_email"}         адрес не похож на адрес
 *   400 {"ok":false,"error":"bad_request"}           всё остальное, что не по контракту (и чужой Origin)
 *   413 {"ok":false,"error":"too_large"}             тело больше MAX_BODY_BYTES
 *   429 {"ok":false,"error":"rate_limited"}          больше TRIES.max попыток с одного IP за TRIES.windowMs
 *   405 {"ok":false,"error":"method_not_allowed"}    не POST и не OPTIONS
 *   OPTIONS -> 204, preflight
 *
 * ПОЧЕМУ ОТДЕЛЬНЫЙ ФАЙЛ, А НЕ ВСЁ В МАРШРУТЕ. Это единственный маршрут, который зовёт никто - без сессии,
 * без токена, с чужого домена, - и значит единственный, где каждое решение (что считать адресом, чей это IP,
 * пускать ли origin, когда хватит) надо проверять исполнением, а не чтением. Решения здесь чистые, а
 * handleWaitlist принимает sql снаружи, так что api/_test-waitlist.mjs гоняет и их, и весь ответ целиком.
 *
 * ЧТО ОТВЕТ НАМЕРЕННО НЕ ГОВОРИТ. Был ли адрес в листе. Новый, повтор и ловушка отвечают одним и тем же
 * 200 одним и тем же телом, и потолок считает ПОПЫТКИ, а не строки листа (см. db/026 о waitlist_try):
 * иначе номер запроса, на котором пришёл 429, выдавал бы то же самое окольным путём. И адрес не
 * повторяется ни в одной ошибке и не уходит в отчёт об ошибках - report() берёт только метод и путь.
 */
import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';

import { report } from './_report.js';
import { allowOrigin, cors } from './_cors.mjs';

/* ГОСТИ ЭТОГО МАРШРУТА - и только его (см. allowOrigin в api/_cors.mjs, почему не в общий список).
 * Лендинг - отдельный статический проект; превью-развёртывания лендинга сюда не входят и получат 400:
 * список, который пускает «и любой *.vercel.app», пускает любого, у кого есть аккаунт Vercel. */
export const WAITLIST_GUESTS = new Set(['https://hivelink.si', 'https://www.hivelink.si']);

/* Тело - адрес до 254, ref до 200, пустая ловушка и обвязка JSON. Два килобайта - втрое больше честного
 * запроса. Платформа к этому моменту тело уже прочла (её собственный предел - 4.5 МБ), так что этот
 * потолок бережёт не память, а то, что дальше: разбор, проверки, базу. */
export const MAX_BODY_BYTES = 2048;
export const EMAIL_MAX = 254; // RFC 5321: путь целиком - 256 с угловыми скобками
export const REF_MAX = 200;

/* Пять за час с одного IP. Человек подписывается один раз, а опечатавшийся - два; пять - это запас на
 * семью или офис за одним NAT, а не на скрипт. Окно СЧИТАЕТСЯ В БАЗЕ, а не в Map процесса: у бессерверной
 * функции экземпляров столько, сколько решил трафик, и потолок в Map умножался бы на их число (см. шапку
 * api/_spend.mjs - там это уже случилось). */
export const TRIES = { max: 5, windowMs: 3_600_000 };

/* Сколько держать попытки: окно с запасом, и всё. */
const KEEP_MS = 2 * TRIES.windowMs;
let sweptAt = 0;
const SWEEP_EVERY_MS = 300_000;

/* ------------------------------------------------------------------------------------------- адрес */

/** Адрес так, как он хранится: обрезан и в нижнем регистре. Не строка - null. */
export function normaliseEmail(raw) {
  if (typeof raw !== 'string') return null;
  return raw.trim().toLowerCase();
}

/* Локальная часть - «atext» из RFC 5322 через точки, без кавычек и комментариев. Строгий синтаксис почты
 * шире, но адрес в кавычках или с IP вместо домена в листе ожидания - это либо ошибка, либо проверка
 * парсера на прочность, и ни того ни другого сюда не надо. Регулярки линейны: точки нет в классе символов,
 * так что `+` и `*` не могут спорить за один и тот же символ. */
const LOCAL = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
/* Домен - ASCII. Кириллический или иной IDN-домен приходит сюда в punycode (xn--), как его и
 * отправляет почта; юникод в домене браузер в поле type=email всё равно не пропускает. */
const TLD = /^(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/;

/** Похоже ли (уже нормализованное) на адрес, на который можно написать. */
export function validEmail(email) {
  if (typeof email !== 'string' || email.length < 3 || email.length > EMAIL_MAX) return false;
  const at = email.lastIndexOf('@');
  if (at < 1 || email.indexOf('@') !== at) return false;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (local.length > 64 || !LOCAL.test(local)) return false;
  if (domain.length > 253) return false;
  const labels = domain.split('.');
  if (labels.length < 2 || !labels.every((l) => LABEL.test(l))) return false;
  return TLD.test(labels[labels.length - 1]);
}

/* ------------------------------------------------------------------------------------------- тело */

/* Управляющие символы из ref - вон: строка попадёт в таблицу, которую потом читают глазами и выгружают в
 * CSV, а перевод строки или ESC в ней - это чужое форматирование в нашем выводе. */
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g;
const LONE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/**
 * Разобрать тело по контракту.
 *
 * ДЛИНА ref ОБРЕЗАЕТСЯ, ТИП - НЕТ. Длина зависит от данных (чужая utm-метка бывает любой длины), и терять
 * из-за неё подпись было бы глупо; тип зависит только от кода лендинга, и число вместо строки - это ошибка,
 * которую лучше увидеть при первой же проверке, чем молча записать.
 *
 * ЛОВУШКА - ЛЮБОЕ НЕПУСТОЕ значение website, и не только строка: бот, заполняющий все поля, пришлёт что
 * угодно, а ответ ему всё равно будет обычный 200.
 *
 * @returns {{ok: true, email: string, source: string, ref: string | null, honeypot: boolean}
 *         | {ok: false, error: 'invalid_email' | 'bad_request'}}
 */
export function readSignup(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'bad_request' };

  const website = body.website;
  const honeypot = !(website == null || (typeof website === 'string' && website.trim() === ''));

  if (body.source != null && body.source !== 'landing') return { ok: false, error: 'bad_request' };
  const source = 'landing';

  let ref = null;
  if (body.ref != null) {
    if (typeof body.ref !== 'string') return { ok: false, error: 'bad_request' };
    /* По кодовым точкам, а не по UTF-16: срез посреди суррогатной пары оставил бы половину эмодзи, а
     * такую строку база не примет - и подпись упала бы в 500 из-за метки кампании. Одинокие суррогаты из
     * самого тела - туда же, в U+FFFD. */
    const clean = body.ref.replace(LONE, '\uFFFD').replace(CONTROL, ' ').trim();
    ref = Array.from(clean).slice(0, REF_MAX).join('').trim() || null;
  }

  if (body.email != null && typeof body.email !== 'string') return { ok: false, error: 'bad_request' };
  const email = normaliseEmail(body.email || '');
  if (!validEmail(email)) return { ok: false, error: 'invalid_email' };

  return { ok: true, email, source, ref, honeypot };
}

/** Тело запроса как объект, или null. Vercel разбирает JSON сам; строка/Buffer - это локальный сервер. */
function bodyOf(req) {
  let body;
  try {
    /* Геттер платформы бросает на битом JSON - это bad_request, а не 500. */
    body = req.body;
  } catch (_) {
    return { parsed: null };
  }
  if (typeof body === 'string' || Buffer.isBuffer(body)) {
    const text = String(body);
    if (Buffer.byteLength(text) > MAX_BODY_BYTES) return { parsed: null, tooLarge: true };
    try { return { parsed: JSON.parse(text) }; } catch (_) { return { parsed: null }; }
  }
  if (body && typeof body === 'object') {
    /* Без content-length (chunked) размер узнаётся только так. */
    let size = 0;
    try { size = Buffer.byteLength(JSON.stringify(body)); } catch (_) { return { parsed: null }; }
    if (size > MAX_BODY_BYTES) return { parsed: null, tooLarge: true };
    return { parsed: body };
  }
  return { parsed: null };
}

/* ----------------------------------------------------------------------------------------- origin */

/**
 * Пускать ли запрос с этим Origin. Нет заголовка - не браузер (curl, сервер), и ему CORS ничего не
 * запрещал бы всё равно; его держит потолок. Есть и не наш - отказ, а не только запрет прочитать ответ.
 *
 * ЗАЧЕМ ОТКАЗ, ЕСЛИ БРАУЗЕР И ТАК НЕ ПРОПУСТИТ. Не пропустит он fetch с application/json - тот идёт через
 * preflight, и preflight получит чужой Allow-Origin. Но страница может послать и простой запрос (форма,
 * no-cors), который preflight не проходит вовсе и доезжает сюда с её Origin. Content-Type такой запрос
 * уже отсекает; Origin - второй замок на ту же дверь, и решение за ним то же, что у cors(), а не своя
 * копия.
 *
 * @returns {'none' | 'allowed' | 'foreign'}
 */
export function originVerdict(origin) {
  if (origin == null || origin === '') return 'none';
  const said = String(origin);
  return allowOrigin(said, WAITLIST_GUESTS) === said ? 'allowed' : 'foreign';
}

/** JSON и только JSON: простой кросс-доменный запрос (text/plain, форма) так не назовётся. */
export const isJson = (contentType) => /^application\/json\s*(;|$)/i.test(String(contentType || '').trim());

/* --------------------------------------------------------------------------------------------- IP */

/**
 * Чей это запрос - по IP, которому можно верить.
 *
 * НА VERCEL ВЕРИТЬ МОЖНО ПЛАТФОРМЕ, А НЕ КЛИЕНТУ. Документация Vercel («Request headers»): x-forwarded-for
 * платформа перезаписывает и внешних адресов не пропускает - «to prevent IP spoofing»; x-vercel-forwarded-for
 * и x-real-ip ему идентичны, причём первый остаётся верным, даже если перед Vercel стоит ещё прокси.
 * Отсюда порядок. Из списка через запятую берётся ПОСЛЕДНИЙ адрес: его дописал ближайший к нам узел, а
 * всё левее - то, что клиент сказал о себе сам. Если платформа список перезаписала, адрес в нём один, и
 * правило ничего не меняет; если где-то когда-то допишет - оно не даст клиенту выбрать себе ведро.
 *
 * ВНЕ VERCEL (vite, свой сервер) эти заголовки присылает кто угодно, и потолок держится ровно настолько,
 * насколько держится платформа перед ним. Это сказано и в docs/product/17-privacy-security.md.
 */
export function clientIp(headers, remoteAddress) {
  const h = headers || {};
  for (const name of ['x-vercel-forwarded-for', 'x-real-ip', 'x-forwarded-for']) {
    const value = Array.isArray(h[name]) ? h[name].join(',') : h[name];
    if (!value) continue;
    const parts = String(value).split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return String(remoteAddress || '');
}

/* IPv6 целиком: восемь групп по четыре цифры. Нужно только для того, чтобы взять первые четыре. */
function expandV6(ip) {
  let text = ip;
  /* Хвост в виде IPv4 (::ffff:1.2.3.4, 64:ff9b::1.2.3.4) - две последние группы. */
  const v4 = /(\d+\.\d+\.\d+\.\d+)$/.exec(text);
  if (v4) {
    const o = v4[1].split('.').map(Number);
    text = text.slice(0, -v4[1].length)
      + ((o[0] << 8) | o[1]).toString(16) + ':' + ((o[2] << 8) | o[3]).toString(16);
  }
  const [head, tail] = text.includes('::') ? text.split('::') : [text, null];
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const fill = tail === null ? [] : new Array(8 - left.length - right.length).fill('0');
  return [...left, ...fill, ...right].map((g) => g.padStart(4, '0'));
}

/**
 * Ведро для потолка. IPv4 - сам адрес. IPv6 - его /64: столько получает ОДНА точка подключения, и
 * потолок на полный адрес обходился бы сменой последних 64 бит, которые у человека свои и бесплатны.
 * IPv4, завёрнутый в IPv6 (::ffff:1.2.3.4), - тот же IPv4, иначе один человек был бы двумя.
 */
export function ipBucket(raw) {
  let ip = String(raw || '').trim();
  /* [::1]:443 и 1.2.3.4:5678 - адрес с портом, порт к человеку отношения не имеет. */
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(ip);
  if (bracketed) ip = bracketed[1];
  else if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(ip)) ip = ip.slice(0, ip.lastIndexOf(':'));
  ip = ip.replace(/%.*$/, '').toLowerCase(); // зона (fe80::1%en0) - свойство нашей стороны, не клиента

  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(ip);
  if (mapped) ip = mapped[1];

  const kind = isIP(ip);
  if (kind === 4) return ip;
  if (kind === 6) return expandV6(ip).slice(0, 4).join(':') + '::/64';
  /* Не адрес - всё равно ведро, но одно на всех таких: иначе мусор в заголовке давал бы новое ведро на
   * каждый запрос. Вне Vercel это и есть «прислали что хотели». */
  return 'unknown';
}

/**
 * Ключ для хэша IP. Свой секрет, если он задан; иначе DATABASE_URL.
 *
 * ПОЧЕМУ ЗАПАСНОЙ КЛЮЧ - DATABASE_URL. Без ключа хэш IPv4 обращается перебором всех четырёх миллиардов
 * адресов за минуты, то есть «хэш» был бы тем же IP, записанным длиннее. Отдельного общего секрета у
 * проекта нет (CRON_SECRET и TELEGRAM_WEBHOOK_SECRET принадлежат своим маршрутам, и сменить один ради
 * другого было бы сюрпризом), а строка базы есть везде, где маршрут вообще может работать: без неё он
 * отвечает 503 раньше, чем дойдёт до хэша. Чем это хуже своего секрета - и это надо сказать прямо: у кого
 * есть строка базы, у того и ключ, и таблица, то есть он может обратить хэши за последний час. Но у него
 * уже есть и сами адреса листа, так что нового он не узнаёт. WAITLIST_IP_KEY разделяет эти два секрета.
 * Смена ключа сбрасывает окна - на час, и это безвредно.
 */
export function ipKey(env) {
  const own = env && env.WAITLIST_IP_KEY;
  if (own) return 'own:' + own;
  return env && env.DATABASE_URL ? 'db:' + env.DATABASE_URL : null;
}

/** HMAC-SHA256 ведра. Префикс - чтобы этот же ключ, если его когда-нибудь возьмут для другого, дал другое. */
export function ipHash(bucket, key) {
  return createHmac('sha256', String(key)).update('hivelink-waitlist-ip\n' + bucket).digest('hex');
}

/* -------------------------------------------------------------------------------------- потолок */

/**
 * Записать попытку, если она ещё помещается в окно. Один запрос: вставка случается только тогда, когда
 * счёт под потолком, - значит отказанные не копятся в таблице, и тот, кто бьёт в 429 тысячу раз в секунду,
 * её не раздувает. Гонка двух одновременных запросов может пропустить шестой - это потолок, а не замок.
 *
 * ОТКРЫТО ПРИ СБОЕ, как overSpend в api/_spend.mjs: сосчитать не смогли - пропускаем. Если базы нет
 * совсем, следующая вставка упадёт сама и ответит 500; а если моргнула только эта - человек не получит
 * «вы превысили лимит», которого не превышал.
 *
 * @returns {Promise<{ok: true} | {ok: false, retryInMs: number}>}
 */
export async function tryAllowed(sql, hash, nowMs = Date.now()) {
  const since = new Date(nowMs - TRIES.windowMs).toISOString();
  try {
    const rows = await sql`
      insert into waitlist_try (ip_hash)
      select ${hash}::text
      where (select count(*) from waitlist_try where ip_hash = ${hash} and at > ${since}) < ${TRIES.max}
      returning at
    `;
    if (!rows.length) {
      /* Когда освободится место: самая старая попытка окна плюс окно. «Попробуйте позже» без числа - это
       * приглашение попробовать сразу же. */
      let freeAt = nowMs + TRIES.windowMs;
      try {
        const [oldest] = await sql`
          select min(at) as at from waitlist_try where ip_hash = ${hash} and at > ${since}
        `;
        if (oldest && oldest.at) freeAt = new Date(oldest.at).getTime() + TRIES.windowMs;
      } catch (_) { /* без числа - значит окно целиком */ }
      /* Часы базы и функции - разные часы; больше окна ответ не бывает, как бы они ни расходились. */
      return { ok: false, retryInMs: Math.min(TRIES.windowMs, Math.max(1000, freeAt - nowMs)) };
    }
    if (nowMs - sweptAt > SWEEP_EVERY_MS) {
      sweptAt = nowMs;
      /* Не ждём: подметание никого не задерживает, и его неудача ничего не значит. */
      void Promise.resolve(sql`delete from waitlist_try where at < ${new Date(nowMs - KEEP_MS).toISOString()}`)
        .catch(() => {});
    }
    return { ok: true };
  } catch (_) {
    return { ok: true };
  }
}

/* --------------------------------------------------------------------------------------- ответ */

const say = (res, status, body) => {
  /* Ответ о человеке - ни в чей кэш. */
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(body);
};
const OK = { ok: true };

/**
 * Весь маршрут. sql и ключ приходят снаружи - из api/waitlist.js в работе, из теста в проверке.
 *
 * ПОРЯДОК ВАЖЕН. Всё, что решается без базы (метод, Origin, размер, тип, форма тела, адрес), решается до
 * неё: такие отказы бесплатны и потолок не тратят - решение там детерминированное и публичное, так что
 * оракула из него не сделать. Ловушка - ПОСЛЕ потолка: бот, заполнивший её, должен видеть ровно то, что
 * видит человек, вплоть до 429 на шестой попытке.
 *
 * @param {{ sql: Function | null, key: string | null, nowMs?: number,
 *   notify?: (signup: {email: string, source: string, ref: string | null}) => Promise<unknown> }} deps
 */
export async function handleWaitlist(req, res, { sql, key, nowMs, notify } = {}) {
  cors(req, res, 'POST, OPTIONS', WAITLIST_GUESTS);
  /* Только content-type: этот маршрут не принимает Authorization и не должен обещать, что принимает. */
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return say(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  const headers = req.headers || {};
  if (originVerdict(headers.origin) === 'foreign') return say(res, 400, { ok: false, error: 'bad_request' });

  const declared = Number(headers['content-length']);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return say(res, 413, { ok: false, error: 'too_large' });
  if (!isJson(headers['content-type'])) return say(res, 400, { ok: false, error: 'bad_request' });

  const { parsed, tooLarge } = bodyOf(req);
  if (tooLarge) return say(res, 413, { ok: false, error: 'too_large' });
  const signup = readSignup(parsed);
  if (!signup.ok) return say(res, 400, { ok: false, error: signup.error });

  if (!sql || !key) return say(res, 503, { ok: false, error: 'unavailable' });

  const hash = ipHash(ipBucket(clientIp(headers, req.socket && req.socket.remoteAddress)), key);
  const verdict = await tryAllowed(sql, hash, nowMs);
  if (!verdict.ok) {
    res.setHeader('Retry-After', String(Math.ceil(verdict.retryInMs / 1000)));
    return say(res, 429, { ok: false, error: 'rate_limited' });
  }

  /* Ловушка: тот же 200, ничего не записано. */
  if (signup.honeypot) return say(res, 200, OK);

  let fresh = false;
  try {
    const rows = await sql`
      insert into waitlist (email, source, ref)
      values (${signup.email}, ${signup.source}, ${signup.ref})
      on conflict (email) do nothing
      returning email
    `;
    fresh = Array.isArray(rows) && rows.length > 0;
  } catch (err) {
    /* В отчёт - сообщение базы и маршрут, НЕ адрес: report() не читает тело, а сообщение Postgres о
     * нарушенном ограничении называет ограничение, а не значение (значение он кладёт в detail, которого
     * здесь никто не передаёт). */
    await report(err, req, { route: 'waitlist' });
    return say(res, 500, { ok: false, error: 'server_error' });
  }
  /* ПИСЬМО ВЛАДЕЛЬЦУ о каждой НОВОЙ записи (владелец, 2026-10-16: «все запросы на вайтлист должны
   * отправляться vicgorlenko@gmail.com»). Только о новой: повтор и ловушка не пишут ничего, иначе один
   * человек, нажавший кнопку пять раз, - это пять писем, а бот - сотня.
   *
   * Строка в базе - и есть запись; письмо - уведомление о ней, и его неудача запись не отменяет:
   * sendMail никогда не бросает, а ответ посетителю тот же 200. Ждём его, а не бросаем в фон: функция
   * Vercel замораживается сразу после ответа, и письмо «в фоне» - это письмо, которое иногда не уходит.
   * Цена - новая запись отвечает на время отправки дольше повтора; по этой разнице можно было бы
   * угадывать, есть ли адрес в списке, но потолок в пять попыток в час с сети делает такой перебор
   * бессмысленным, а знание «этот адрес ждёт запуска» - не тайна аккаунта. */
  if (fresh && notify) await notify(signup);
  return say(res, 200, OK);
}

/** Кому уходит письмо о новой записи. WAITLIST_NOTIFY_TO переопределяет; по умолчанию - владелец. */
export const notifyTo = (env) => String((env && env.WAITLIST_NOTIFY_TO) || 'vicgorlenko@gmail.com').trim();

/** Письмо о новой записи: адрес, откуда пришёл, метки. Текстом - читать его будет один человек. */
export function signupMail(signup, at = new Date()) {
  return {
    subject: `Hivelink waitlist: ${signup.email}`,
    text: [
      `New waitlist sign-up on hivelink.si`,
      ``,
      `Email:  ${signup.email}`,
      `Source: ${signup.source}`,
      `Ref:    ${signup.ref || '—'}`,
      `When:   ${at.toISOString()}`,
    ].join('\n'),
    replyTo: signup.email,
  };
}
