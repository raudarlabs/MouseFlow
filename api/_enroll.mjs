/* Код подключения машины: привязать агента к аккаунту без браузера на этой машине (Hivelink H3).
 *
 * ЗАЧЕМ. До H3 машину привязывала страница: она выпускала токен и отдавала его агенту по loopback
 * (`POST /account` на 127.0.0.1). Значит, на каждой из десяти машин нужно было открыть приложение, войти и
 * нажать кнопку. Код делает обратное: его выпускают ОДИН раз в аккаунте, и установщик на каждой машине
 * меняет его на собственный токен - `--enroll HL-XXXXX-XXXXX --name "Office-3"`.
 *
 * ГДЕ ЛЕЖИТ - В user_pref, А НЕ В НОВОЙ ТАБЛИЦЕ, и это нарочно. Строка `enroll.<хэш>` с JSON-значением
 * `{ uses, expires, made }`. Таблица потребовала бы миграцию (а 025 ещё не применена), и стирание аккаунта
 * обязано было бы о ней знать; user_pref уже стирается целиком. Сам код НЕ хранится - только sha256, как у
 * токенов устройств: утёкшая таблица не даёт подключить чужую машину.
 *
 * СТОЙКОСТЬ. Десять знаков из 31 (без 0/O, 1/I/L) - около 50 бит; код живёт не больше недели и кончается
 * после стольких машин, на сколько выпущен. Перебрать 2^50 за неделю через серверную функцию нельзя.
 *
 * ОДНО ДЕЙСТВИЕ НА ОБМЕН. Уменьшение счётчика и проверка срока - одним UPDATE: два агента, пришедшие с
 * последним использованием одновременно, не получат два токена.
 */
import { createHash, randomBytes } from 'node:crypto';

export const ENROLL_PREFIX = 'enroll.';
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ENROLL_USES_MAX = 50;
export const ENROLL_HOURS_MAX = 168;

const sha = (value) => createHash('sha256').update(String(value)).digest('hex');

/** Новый код: `HL-XXXXX-XXXXX`. */
export function newCode() {
  const bytes = randomBytes(10);
  const chars = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
  return `HL-${chars.slice(0, 5)}-${chars.slice(5)}`;
}

/* Код, как его набрали: регистр, пробелы, дефисы и приставка HL- не важны. Человек, переписавший код с
 * экрана, не должен получить «неверный код» за дефис. */
export function normalCode(raw) {
  const flat = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const body = flat.startsWith('HL') ? flat.slice(2) : flat;
  return body.length === 10 && [...body].every((c) => ALPHABET.includes(c)) ? body : null;
}

/** Ключ строки в user_pref - по хэшу кода. */
export const enrollKey = (code) => ENROLL_PREFIX + sha(normalCode(code));

/** Выпустить код. `uses` - сколько машин им можно подключить, `hours` - сколько он живёт. */
export async function makeCode(sql, userId, { uses = 1, hours = 24 } = {}) {
  const n = Math.min(ENROLL_USES_MAX, Math.max(1, Math.round(Number(uses) || 1)));
  const h = Math.min(ENROLL_HOURS_MAX, Math.max(1, Math.round(Number(hours) || 24)));
  const code = newCode();
  const expires = new Date(Date.now() + h * 3_600_000).toISOString();
  const value = JSON.stringify({ uses: n, expires, made: new Date().toISOString() });
  await sql`
    insert into user_pref (user_id, key, value) values (${userId}, ${enrollKey(code)}, ${value})
  `;
  return { code, uses: n, expiresAt: expires };
}

/** Живые коды аккаунта - без самих кодов: их нет. `id` - начало хэша, им код отзывают. */
export async function listCodes(sql, userId) {
  const rows = await sql`
    select key, value from user_pref
    where user_id = ${userId} and key like ${ENROLL_PREFIX + '%'}
  `;
  const now = Date.now();
  return rows.map((r) => {
    let v = {};
    try { v = JSON.parse(r.value); } catch (_) { /* a damaged row reads as spent */ }
    return {
      id: String(r.key).slice(ENROLL_PREFIX.length, ENROLL_PREFIX.length + 12),
      uses: Number(v.uses) || 0,
      expiresAt: v.expires || null,
      madeAt: v.made || null,
    };
  }).filter((one) => one.uses > 0 && one.expiresAt && new Date(one.expiresAt).getTime() > now)
    .sort((a, b) => String(b.madeAt).localeCompare(String(a.madeAt)));
}

/** Отозвать код по началу его хэша. */
export async function dropCode(sql, userId, id) {
  if (!/^[0-9a-f]{12}$/.test(String(id || ''))) return 0;
  const rows = await sql`
    delete from user_pref where user_id = ${userId} and key like ${ENROLL_PREFIX + id + '%'} returning key
  `;
  return rows.length;
}

/* Потратить одно использование. Сравнить-и-заменить: строку читают, проверяют срок и остаток в коде, и
 * пишут новое значение, только если старое не изменилось. Два агента с последним использованием - один
 * получит строку, второй ноль строк и отказ. Без приведения типов в WHERE: по чужим строкам user_pref
 * (там не JSON) оно упало бы. Последнее использование удаляет строку - мёртвые коды не копятся. */
export async function spendCode(sql, code) {
  if (!normalCode(code)) return null;
  const key = enrollKey(code);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const found = await sql`select user_id, value from user_pref where key = ${key} limit 1`;
    if (!found.length) return null;
    let v = {};
    try { v = JSON.parse(found[0].value); } catch (_) { return null; }
    const uses = Number(v.uses) || 0;
    if (uses <= 0 || !v.expires || new Date(v.expires).getTime() <= Date.now()) return null;
    const left = uses - 1;
    const swapped = left > 0
      ? await sql`
        update user_pref set value = ${JSON.stringify({ ...v, uses: left })}, updated_at = now()
        where user_id = ${found[0].user_id} and key = ${key} and value = ${found[0].value}
        returning user_id
      `
      : await sql`
        delete from user_pref where user_id = ${found[0].user_id} and key = ${key} and value = ${found[0].value}
        returning user_id
      `;
    if (swapped.length) return { userId: found[0].user_id, left };
  }
  return null;
}
