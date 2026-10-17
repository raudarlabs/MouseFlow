/* Лист ожидания лендинга hivelink.si (2026-10-16).
 *
 *   POST /api/waitlist   { email, website: "", source: "landing", ref? }  ->  200 {"ok":true}
 *
 * Полный контракт, порядок проверок и почему они такие - в api/_waitlist.mjs; таблицы - db/026_waitlist.sql.
 * Здесь только то, что нельзя подменить в тесте: настоящая база и настоящее окружение.
 *
 * ЕДИНСТВЕННЫЙ МАРШРУТ С ЧУЖИМ ORIGIN. Лендинг - отдельный статический проект на своём домене, и его форма
 * шлёт адрес сюда кросс-доменно. Пускается он только сюда (WAITLIST_GUESTS через cors(), см. api/_cors.mjs);
 * Allow-Credentials не ставится, как и везде: сессии у того, кто подписывается, нет и быть не должно.
 *
 * БЕЗ СЕССИИ И БЕЗ ТОКЕНА - намеренно: подписывается тот, у кого аккаунта ещё нет. То, что держит маршрут
 * вместо входа, - проверка формы, ловушка для ботов и потолок попыток на IP, и всё это - в _waitlist.mjs.
 */
import { neon } from '@neondatabase/serverless';

import { wrap } from './_report.js';
import { sendMail } from './_mail.js';
import { handleWaitlist, ipKey, notifyTo, signupMail } from './_waitlist.mjs';

async function handler(req, res) {
  const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
  /* Без RESEND_API_KEY и MAIL_FROM sendMail честно не отправляет ничего и не бросает - запись в базе всё
   * равно сделана, письма просто нет. */
  const notify = (signup) => sendMail({ to: notifyTo(process.env), ...signupMail(signup) });
  return handleWaitlist(req, res, { sql, key: ipKey(process.env), notify });
}

export default wrap(handler, 'waitlist');
