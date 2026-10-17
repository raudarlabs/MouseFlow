/* Лист ожидания - исполнением. Маршрут, которого зовёт кто угодно с чужого домена без входа, проверяется
 * не чтением: каждое решение (адрес, origin, IP, потолок, ловушка) гоняется здесь, а потом весь ответ
 * целиком - против базы-заглушки, которая помнит строки так же, как настоящая.
 *
 * Run: node api/_test-waitlist.mjs */
import { readFileSync } from 'node:fs';

import {
  EMAIL_MAX, MAX_BODY_BYTES, REF_MAX, TRIES, WAITLIST_GUESTS,
  clientIp, handleWaitlist, ipBucket, notifyTo, signupMail, ipHash, ipKey, isJson, normaliseEmail, originVerdict, readSignup,
  tryAllowed, validEmail,
} from './_waitlist.mjs';

let pass = 0;
let fail = 0;
const check = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  -> ' + String(detail).slice(0, 300) : '')); }
};
const group = (t) => console.log('\n' + t);
const show = (v) => JSON.stringify(v);

/* База-заглушка: понимает ровно те запросы, что шлёт _waitlist.mjs, и хранит строки в памяти. Запрос,
 * которого она не узнала, - падение теста, а не тихий пустой ответ: иначе новая ветка SQL прошла бы
 * проверку, ничего не проверив. */
const fakeNeon = ({ broken = false } = {}) => {
  const tries = []; // { ip_hash, at }
  const list = new Map(); // email -> { source, ref }
  const seen = [];
  const run = (text, values) => {
    if (broken) throw new Error('relation "waitlist_try" does not exist');
    if (/insert into waitlist_try/.test(text)) {
      const [hash, , since, max] = values;
      const n = tries.filter((t) => t.ip_hash === hash && t.at > since).length;
      if (n >= max) return [];
      const at = new Date().toISOString();
      tries.push({ ip_hash: hash, at });
      return [{ at }];
    }
    if (/select min\(at\) as at from waitlist_try/.test(text)) {
      const [hash, since] = values;
      const ats = tries.filter((t) => t.ip_hash === hash && t.at > since).map((t) => t.at).sort();
      return [{ at: ats[0] || null }];
    }
    if (/delete from waitlist_try/.test(text)) return [];
    if (/insert into waitlist \(email, source, ref\)/.test(text)) {
      if (!/on conflict \(email\) do nothing/.test(text)) throw new Error('duplicate key');
      const [email, source, ref] = values;
      if (list.has(email)) return [];
      list.set(email, { source, ref });
      return /returning/i.test(text) ? [{ email }] : [];
    }
    throw new Error('unexpected query: ' + text);
  };
  const sql = (strings, ...values) => {
    const text = strings.join('?');
    seen.push({ text, values });
    return { then: (ok, bad) => Promise.resolve().then(() => run(text, values)).then(ok, bad) };
  };
  return Object.assign(sql, { tries, list, seen });
};

/* Ответ так, как его видит лендинг: статус, заголовки, тело. */
const call = async ({ method = 'POST', origin = 'https://hivelink.si', body, headers = {}, ip = '203.0.113.7',
  sql, key = 'k', notify } = {}) => {
  const h = {};
  const out = { status: 0, headers: h, body: undefined };
  const res = {
    headersSent: false,
    setHeader: (k, v) => { h[k] = v; },
    status(code) { out.status = code; return this; },
    json(v) { out.body = v; return this; },
    end() { return this; },
  };
  const text = body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body));
  const req = {
    method,
    url: '/api/waitlist',
    headers: {
      ...(origin ? { origin } : {}),
      'content-type': 'application/json',
      ...(text !== undefined ? { 'content-length': String(Buffer.byteLength(text)) } : {}),
      'x-vercel-forwarded-for': ip,
      ...headers,
    },
    /* Как у Vercel: тело уже разобрано, и битый JSON бросает из геттера. */
    get body() {
      if (text === undefined) return undefined;
      return JSON.parse(text);
    },
  };
  await handleWaitlist(req, res, { sql: sql === undefined ? fakeNeon() : sql, key, notify });
  return out;
};
const good = (extra = {}) => ({ email: 'ann@example.si', website: '', source: 'landing', ref: 'utm_source=x', ...extra });

group('адрес: нормализация и синтаксис');
{
  check('обрезан и в нижнем регистре', normaliseEmail('  Ann.Lee@Example.SI ') === 'ann.lee@example.si');
  check('не строка - null', normaliseEmail(42) === null && normaliseEmail(null) === null);
  for (const ok of ['a@b.si', 'ann.lee+wait@example.co.uk', "o'neil@example.com", 'x@xn--80ak6aa92e.com',
    'a_b-c@sub.domain-1.io']) {
    check('годится: ' + ok, validEmail(ok));
  }
  for (const bad of ['', 'ann', 'ann@', '@example.si', 'ann@example', 'ann@@example.si', 'a@b@c.si',
    'ann lee@example.si', '.ann@example.si', 'ann.@example.si', 'an..n@example.si', 'ann@-example.si',
    'ann@example-.si', 'ann@example..si', 'ann@example.s', 'ann@example.123', '"ann"@example.si',
    'ann@[127.0.0.1]', 'анна@example.si', 'ann@пример.рф', 'ann@example.si\n', '<ann@example.si>']) {
    check('не годится: ' + show(bad), !validEmail(bad));
  }
  const long = 'a'.repeat(64) + '@' + ('b'.repeat(60) + '.').repeat(3) + 'si';
  check(`до ${EMAIL_MAX} - годится (${long.length})`, long.length <= EMAIL_MAX && validEmail(long));
  const tooLong = 'a'.repeat(64) + '@' + ('b'.repeat(61) + '.').repeat(3) + 'info';
  check(`длиннее ${EMAIL_MAX} - нет (${tooLong.length})`, tooLong.length > EMAIL_MAX && !validEmail(tooLong));
  check('локальная часть длиннее 64 - нет', !validEmail('a'.repeat(65) + '@example.si'));
}

group('тело по контракту');
{
  check('честное - принято', show(readSignup(good())) === show({
    ok: true, email: 'ann@example.si', source: 'landing', ref: 'utm_source=x', honeypot: false }));
  check('адрес нормализуется до хранения', readSignup(good({ email: ' ANN@Example.si ' })).email === 'ann@example.si');
  check('без source - это лендинг', readSignup(good({ source: undefined })).source === 'landing');
  check('чужой source - bad_request', readSignup(good({ source: 'admin' })).error === 'bad_request');
  check('без адреса - invalid_email', readSignup(good({ email: undefined })).error === 'invalid_email');
  check('адрес не строкой - bad_request', readSignup(good({ email: ['a@b.si'] })).error === 'bad_request');
  check('кривой адрес - invalid_email', readSignup(good({ email: 'nope' })).error === 'invalid_email');
  check('массив вместо объекта - bad_request', readSignup([good()]).error === 'bad_request');
  check('null - bad_request', readSignup(null).error === 'bad_request');
  check('ref не строкой - bad_request', readSignup(good({ ref: { a: 1 } })).error === 'bad_request');
  check('без ref - null', readSignup(good({ ref: undefined })).ref === null);
  check(`длинный ref обрезан до ${REF_MAX}, а не отказан`,
    readSignup(good({ ref: 'x'.repeat(500) })).ref.length === REF_MAX);
  /* Срез по UTF-16 оставил бы половину суррогатной пары, и база отказала бы строке. */
  const emoji = readSignup(good({ ref: '😀'.repeat(300) })).ref;
  check('и обрезан по символам, а не посреди эмодзи',
    Array.from(emoji).length === REF_MAX && emoji.isWellFormed());
  check('одинокий суррогат - в U+FFFD', readSignup(good({ ref: 'a\uD800b' })).ref === 'a�b');
  check('управляющие символы из ref - вон', readSignup(good({ ref: 'a\nb\u0000c d' })).ref === 'a b c d');
}

group('ловушка для ботов');
{
  check('пустая - человек', readSignup(good({ website: '' })).honeypot === false);
  check('пробелы - человек (автозаполнение)', readSignup(good({ website: '   ' })).honeypot === false);
  check('нет поля - человек', readSignup(good({ website: undefined })).honeypot === false);
  check('заполнена - бот', readSignup(good({ website: 'https://spam.example' })).honeypot === true);
  check('не строкой - тоже бот', readSignup(good({ website: 1 })).honeypot === true
    && readSignup(good({ website: {} })).honeypot === true);
}

group('origin: hivelink.si - только сюда, и ровно эти два');
{
  check('гостей ровно два', show([...WAITLIST_GUESTS].sort()) === show(['https://hivelink.si', 'https://www.hivelink.si']));
  for (const o of ['https://hivelink.si', 'https://www.hivelink.si', 'https://mouseflowapp.vercel.app',
    'https://mouse-agent.vercel.app']) {
    check('пускается: ' + o, originVerdict(o) === 'allowed');
  }
  for (const o of ['https://evil.example', 'http://hivelink.si', 'https://hivelink.si.evil.example',
    'https://evilhivelink.si', 'https://hivelink.si:8443', 'https://x.hivelink.si', 'null',
    'chrome-extension://abcdefghijklmnopabcdefghijklmnop', 'https://hivelink-git-main.vercel.app']) {
    check('отказ: ' + o, originVerdict(o) === 'foreign');
  }
  check('без Origin - не браузер, его держит потолок', originVerdict(undefined) === 'none' && originVerdict('') === 'none');

  /* Главное, ради чего гостей не кладут в общий список: остальные маршруты их не знают. */
  const { cors } = await import('./_cors.mjs');
  const allowFor = (origin, guests) => {
    const h = {};
    cors({ headers: { origin } }, { setHeader: (k, v) => { h[k] = v; } }, 'GET, OPTIONS', guests);
    return h;
  };
  check('любой другой маршрут hivelink.si НЕ отражает',
    allowFor('https://hivelink.si')['Access-Control-Allow-Origin'] === 'https://mouseflowapp.vercel.app');
  check('маршрут с гостями не отражает расширения',
    allowFor('chrome-extension://abc', WAITLIST_GUESTS)['Access-Control-Allow-Origin'] === 'https://mouseflowapp.vercel.app');
  check('а без гостей расширение отражается, как прежде',
    allowFor('chrome-extension://abc')['Access-Control-Allow-Origin'] === 'chrome-extension://abc');
  check('credentials не выдаются и гостям', !('Access-Control-Allow-Credentials' in allowFor('https://hivelink.si', WAITLIST_GUESTS)));
}

group('content-type');
{
  check('application/json', isJson('application/json') && isJson('Application/JSON; charset=utf-8'));
  check('не json - нет', !isJson('text/plain') && !isJson('application/x-www-form-urlencoded')
    && !isJson('multipart/form-data') && !isJson('application/jsonp') && !isJson(undefined));
}

group('IP: которому верить, и какое ведро');
{
  check('x-vercel-forwarded-for первым', clientIp({ 'x-vercel-forwarded-for': '1.1.1.1', 'x-real-ip': '2.2.2.2',
    'x-forwarded-for': '3.3.3.3' }) === '1.1.1.1');
  check('потом x-real-ip', clientIp({ 'x-real-ip': '2.2.2.2', 'x-forwarded-for': '3.3.3.3' }) === '2.2.2.2');
  /* Левее - то, что клиент сказал о себе сам. */
  check('из списка - последний, дописанный ближайшим узлом',
    clientIp({ 'x-forwarded-for': '6.6.6.6, 7.7.7.7, 8.8.8.8' }) === '8.8.8.8');
  check('без заголовков - сокет', clientIp({}, '9.9.9.9') === '9.9.9.9');
  check('IPv4 - сам адрес', ipBucket('203.0.113.7') === '203.0.113.7');
  check('с портом - без порта', ipBucket('203.0.113.7:5555') === '203.0.113.7');
  check('IPv4 в IPv6 - тот же IPv4', ipBucket('::ffff:203.0.113.7') === '203.0.113.7');
  check('IPv6 - его /64', ipBucket('2001:db8:1:2:aaaa:bbbb:cccc:dddd') === '2001:0db8:0001:0002::/64');
  check('и /64 одинаков, как его ни запиши',
    ipBucket('2001:db8:1:2::1') === ipBucket('2001:0DB8:0001:0002:ffff:0:0:9')
    && ipBucket('[2001:db8:1:2::1]:443') === '2001:0db8:0001:0002::/64');
  check('сокращение в начале', ipBucket('::1') === '0000:0000:0000:0000::/64');
  check('мусор - одно общее ведро, а не новое на каждый запрос',
    ipBucket('not-an-ip') === 'unknown' && ipBucket('also; junk') === 'unknown' && ipBucket('') === 'unknown');
  check('хэш - с ключом: другой ключ, другой хэш', ipHash('1.2.3.4', 'a') !== ipHash('1.2.3.4', 'b'));
  check('и не голый sha256 адреса', ipHash('1.2.3.4', 'a').length === 64 && !ipHash('1.2.3.4', 'a').includes('1.2.3.4'));
  check('ключ - свой секрет, если задан', ipKey({ WAITLIST_IP_KEY: 's', DATABASE_URL: 'd' }) === 'own:s');
  check('иначе строка базы', ipKey({ DATABASE_URL: 'd' }) === 'db:d');
  check('и нет ни того ни другого - нет ключа', ipKey({}) === null);
}

group('потолок попыток');
{
  const sql = fakeNeon();
  const now = Date.now();
  const verdicts = [];
  for (let i = 0; i < TRIES.max + 2; i++) verdicts.push((await tryAllowed(sql, 'h1', now)).ok);
  check(`первые ${TRIES.max} - можно, дальше - нет`,
    show(verdicts) === show([...new Array(TRIES.max).fill(true), false, false]), show(verdicts));
  check('отказанные не копятся в таблице', sql.tries.filter((t) => t.ip_hash === 'h1').length === TRIES.max);
  check('у другого ведра свой счёт', (await tryAllowed(sql, 'h2', now)).ok);
  const refused = await tryAllowed(sql, 'h1', now);
  check('отказ говорит, когда освободится', !refused.ok && refused.retryInMs > 0 && refused.retryInMs <= TRIES.windowMs,
    show(refused));
  check('сбой подсчёта - пропуск, а не «вы превысили»', (await tryAllowed(fakeNeon({ broken: true }), 'h', now)).ok);
}

group('ответ целиком: что видит лендинг');
{
  const sql = fakeNeon();
  const first = await call({ body: good(), sql });
  check('новый адрес - 200 {"ok":true}', first.status === 200 && show(first.body) === '{"ok":true}', show(first));
  check('и он записан нормализованным', sql.list.has('ann@example.si') && sql.list.get('ann@example.si').ref === 'utm_source=x');
  check('Allow-Origin - лендинг', first.headers['Access-Control-Allow-Origin'] === 'https://hivelink.si');
  check('Vary: Origin', first.headers.Vary === 'Origin');
  check('без Allow-Credentials', !('Access-Control-Allow-Credentials' in first.headers));
  check('и не в кэш', first.headers['Cache-Control'] === 'no-store');

  const again = await call({ body: good({ email: 'ANN@example.si ', ref: 'другой' }), sql });
  check('повтор - тот же 200 тем же телом', again.status === 200 && show(again.body) === show(first.body));
  check('и первая запись не перезаписана', sql.list.size === 1 && sql.list.get('ann@example.si').ref === 'utm_source=x');

  const bot = await call({ body: good({ email: 'bot@example.si', website: 'x' }), sql, ip: '198.51.100.1' });
  check('ловушка - тот же 200', bot.status === 200 && show(bot.body) === show(first.body));
  check('и ничего не записано', !sql.list.has('bot@example.si'));
  check('но попытка посчитана, как у человека', sql.tries.length === 3);

  const www = await call({ origin: 'https://www.hivelink.si', body: good({ email: 'b@example.si' }), sql });
  check('www тоже', www.status === 200 && www.headers['Access-Control-Allow-Origin'] === 'https://www.hivelink.si');
  const curl = await call({ origin: null, body: good({ email: 'c@example.si' }), sql, ip: '192.0.2.50' });
  check('без Origin (не браузер) - принято', curl.status === 200 && sql.list.has('c@example.si'));
}

group('ответ целиком: отказы');
{
  const sql = fakeNeon();
  const bad = await call({ body: good({ email: 'secret-person@nowhere' }), sql });
  check('кривой адрес - 400 invalid_email', bad.status === 400 && show(bad.body) === '{"ok":false,"error":"invalid_email"}');
  check('и адрес не повторён в ответе', !show(bad).includes('secret-person'));
  const foreign = await call({ origin: 'https://evil.example', body: good(), sql });
  check('чужой Origin - 400 bad_request, и ничего не записано',
    foreign.status === 400 && foreign.body.error === 'bad_request' && sql.list.size === 0);
  check('и прочитать этот ответ чужому нельзя', foreign.headers['Access-Control-Allow-Origin'] === 'https://mouseflowapp.vercel.app');
  const plain = await call({ body: good(), sql, headers: { 'content-type': 'text/plain' } });
  check('простой запрос text/plain (без preflight) - 400', plain.status === 400 && sql.list.size === 0);
  const broken = await call({ body: '{"email":', sql });
  check('битый JSON - 400 bad_request, а не 500', broken.status === 400 && broken.body.error === 'bad_request');
  const empty = await call({ body: undefined, sql });
  check('пустое тело - 400 bad_request', empty.status === 400 && empty.body.error === 'bad_request');
  const big = await call({ body: good({ ref: 'x'.repeat(MAX_BODY_BYTES) }), sql });
  check('большое тело - 413', big.status === 413 && big.body.error === 'too_large');
  const lied = await call({ body: good(), sql, headers: { 'content-length': String(MAX_BODY_BYTES + 1) } });
  check('и по заявленной длине, не читая', lied.status === 413);
  check('отказы до базы потолок не тратят', sql.tries.length === 0, sql.tries.length);

  const get = await call({ method: 'GET', sql });
  check('GET - 405', get.status === 405 && get.body.error === 'method_not_allowed' && get.headers.Allow === 'POST, OPTIONS');
  const pre = await call({ method: 'OPTIONS', sql, body: undefined, headers: { 'access-control-request-method': 'POST',
    'access-control-request-headers': 'content-type' } });
  check('preflight - 204', pre.status === 204);
  check('и разрешает ровно POST с content-type',
    pre.headers['Access-Control-Allow-Methods'] === 'POST, OPTIONS' && pre.headers['Access-Control-Allow-Headers'] === 'content-type'
    && pre.headers['Access-Control-Allow-Origin'] === 'https://hivelink.si');
  const evilPre = await call({ method: 'OPTIONS', origin: 'https://evil.example', sql });
  check('чужому preflight - наш адрес, а не его', evilPre.headers['Access-Control-Allow-Origin'] === 'https://mouseflowapp.vercel.app');

  const nodb = await call({ body: good(), sql: null });
  check('нет базы - 503, а не притворный 200', nodb.status === 503 && nodb.body.ok === false);
  const down = await call({ body: good(), sql: fakeNeon({ broken: true }) });
  check('база упала на вставке - 500, адреса в ответе нет', down.status === 500 && !show(down).includes('ann@'));
}

group('ответ целиком: потолок');
{
  const sql = fakeNeon();
  const seen = [];
  for (let i = 0; i < TRIES.max; i++) seen.push((await call({ body: good({ email: `p${i}@example.si` }), sql })).status);
  const over = await call({ body: good({ email: 'late@example.si' }), sql });
  check(`${TRIES.max} подряд - 200`, seen.every((s) => s === 200), show(seen));
  check('следующий - 429 rate_limited', over.status === 429 && show(over.body) === '{"ok":false,"error":"rate_limited"}');
  check('с Retry-After в секундах', Number(over.headers['Retry-After']) > 0 && Number(over.headers['Retry-After']) <= 3600);
  check('и не записан', !sql.list.has('late@example.si'));
  const other = await call({ body: good({ email: 'late@example.si' }), sql, ip: '2001:db8:9::1' });
  check('с другого IP - можно', other.status === 200);
  /* /64 - одна точка подключения: смена хвоста адреса нового ведра не даёт. */
  for (let i = 0; i < TRIES.max - 1; i++) await call({ body: good({ email: `v${i}@example.si` }), sql, ip: `2001:db8:9::${i + 2}` });
  const tail = await call({ body: good({ email: 'v9@example.si' }), sql, ip: '2001:db8:9::ffff' });
  check('другой хвост того же /64 - тот же потолок', tail.status === 429);
  const spoof = await call({ body: good({ email: 'spoof@example.si' }), sql,
    headers: { 'x-vercel-forwarded-for': '6.6.6.6, 203.0.113.7' } });
  check('приписанный слева адрес ведро не меняет', spoof.status === 429);

  /* ОРАКУЛ, РАДИ КОТОРОГО СЧИТАЮТСЯ ПОПЫТКИ: повтор тратит попытку так же, как новый адрес, - иначе номер
   * запроса, на котором приходит 429, говорил бы, был ли адрес в листе. */
  const a = fakeNeon();
  a.list.set('known@example.si', { source: 'landing', ref: null });
  const b = fakeNeon();
  const until429 = async (db) => {
    await call({ body: good({ email: 'known@example.si' }), sql: db });
    for (let i = 1; ; i++) {
      if ((await call({ body: good({ email: `j${i}@example.si` }), sql: db })).status === 429) return i;
    }
  };
  check('известный и неизвестный адрес доводят до 429 за одно и то же число запросов',
    (await until429(a)) === (await until429(b)));
}

group('маршрут и миграция');
{
  const route = readFileSync(new URL('./waitlist.js', import.meta.url), 'utf8');
  check('маршрут в обёртке отчёта', /export default wrap\(handler, 'waitlist'\)/.test(route));
  check('и ключ берёт из окружения через ipKey', /ipKey\(process\.env\)/.test(route));
  const lib = readFileSync(new URL('./_waitlist.mjs', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  check('нигде не ставит Allow-Credentials',
    !/Allow-Credentials/.test(lib + route.replace(/\/\*[\s\S]*?\*\//g, '')));
  check('повтор - on conflict do nothing', /on conflict \(email\) do nothing/.test(lib));
  check('в отчёт об ошибке - только маршрут', /report\(err, req, \{ route: 'waitlist' \}\)/.test(lib));
  const mig = readFileSync(new URL('../db/026_waitlist.sql', import.meta.url), 'utf8');
  const code = mig.replace(/--[^\n]*/g, '');
  check('миграция: email - первичный ключ', /email\s+text\s+primary key/.test(code));
  check('ref ограничен и в базе', /length\(ref\) <= 200/.test(code));
  check('хэш IP только в таблице попыток, не рядом с адресом',
    /create table if not exists waitlist_try \(\s*ip_hash/.test(code)
    && !/ip_hash/.test(/create table if not exists waitlist \(([\s\S]*?)\n\);/.exec(code)[1]));
  check('и у листа нет user_id - стирание аккаунта его не ищет', !/user_id/.test(code));
}

{
  /* Письмо владельцу: только о новой записи, ровно одно, и неудача письма не меняет ответа. */
  const sql = fakeNeon();
  const sent = [];
  const notify = async (signup) => { sent.push(signup.email); };
  const a = await call({ sql, notify, body: { email: 'New@Example.com', website: '', source: 'landing' } });
  const b = await call({ sql, notify, body: { email: 'new@example.com', website: '', source: 'landing' } });
  const c = await call({ sql, notify, body: { email: 'bot@example.com', website: 'spam', source: 'landing' } });
  check('письмо - о новой записи, одно, с нормализованным адресом',
    a.status === 200 && b.status === 200 && c.status === 200 && sent.length === 1 && sent[0] === 'new@example.com',
    JSON.stringify(sent));
  const failing = async () => ({ sent: false, why: 'RESEND_API_KEY is not set' });
  const d = await call({ sql, notify: failing, body: { email: 'other@example.com', website: '', source: 'landing' } });
  check('неотправленное письмо не отменяет запись', d.status === 200 && d.body.ok === true && sql.list.has('other@example.com'));
  check('по умолчанию письмо идёт владельцу', notifyTo({}) === 'vicgorlenko@gmail.com');
  check('WAITLIST_NOTIFY_TO переопределяет', notifyTo({ WAITLIST_NOTIFY_TO: ' a@b.co ' }) === 'a@b.co');
  const m = signupMail({ email: 'x@y.co', source: 'landing', ref: 'utm_source=hn' }, new Date('2026-10-16T10:00:00Z'));
  check('в письме адрес, источник, метки и время; ответ - подписавшемуся',
    /x@y\.co/.test(m.subject) && /utm_source=hn/.test(m.text) && /2026-10-16T10:00:00/.test(m.text) && m.replyTo === 'x@y.co');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
