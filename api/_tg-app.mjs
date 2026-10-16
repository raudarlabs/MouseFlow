/* Мини-приложение Hivelink в Telegram: машины, команда машине, что идёт сейчас (2026-10-16).
 *
 * ЗАЧЕМ. Бот достался от другого проекта: под полем ввода висела его клавиатура, а кнопка меню открывала
 * несуществующий деплой. Владелец: «переделаем под наш продукт». Чат хорош для одной задачи словами;
 * список машин и выбор, какой из них что поручить, - это экран, и у телеграма для экрана есть Mini App.
 *
 * КАК ОНО ЗНАЕТ, ЧЕЙ ЭТО АККАУНТ - без входа. Внутри телеграма куки сайта нет, а вход через Google в его
 * окне часто запрещён. Зато телеграм подписывает `initData` (кто открыл, когда) ключом, выведенным из
 * токена бота, и подделать подпись без токена нельзя. Проверка - по документации Telegram: секрет =
 * HMAC_SHA256("WebAppData", токен бота), подпись = HMAC_SHA256(секрет, строки «ключ=значение» по алфавиту
 * через перевод строки). Дальше - ТА ЖЕ привязка, что у чата: `chat_sender` в состоянии `allowed`.
 * Неспаренный человек получает «сначала /pair», а не чужие машины.
 *
 * СВЕЖЕСТЬ. initData живёт, пока открыто окно; принимается не старше суток - как советует телеграм, чтобы
 * однажды перехваченная строка не оставалась ключом навсегда.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export const INIT_DATA_MAX_AGE_S = 24 * 3600;

/**
 * Проверить initData мини-приложения. Чистая функция: токен и время передаются, чтобы её можно было
 * выполнить в тесте.
 * @returns {{ user: { id: number, first_name?: string, username?: string }, authDate: number } | { why: string }}
 */
export function checkInitData(initData, botToken, nowS = Math.floor(Date.now() / 1000)) {
  if (!botToken) return { why: 'this deployment has no bot token' };
  const raw = String(initData || '');
  if (!raw) return { why: 'open this from the Hivelink bot in Telegram' };
  const params = new URLSearchParams(raw);
  const hash = params.get('hash') || '';
  params.delete('hash');
  const lines = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort();
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const want = createHmac('sha256', secret).update(lines.join('\n')).digest('hex');
  const a = Buffer.from(want, 'hex');
  const b = Buffer.from(/^[0-9a-f]{64}$/.test(hash) ? hash : '', 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { why: 'this was not opened from the Hivelink bot' };
  const authDate = Number(params.get('auth_date')) || 0;
  if (!authDate || nowS - authDate > INIT_DATA_MAX_AGE_S) return { why: 'this window is too old - close it and open it again' };
  let user = null;
  try { user = JSON.parse(params.get('user') || 'null'); } catch (_) { user = null; }
  if (!user || !user.id) return { why: 'Telegram did not say who opened this' };
  return { user, authDate };
}

/** Подписать initData так, как это делает телеграм, - для теста и для превью. */
export function signInitData(fields, botToken) {
  const params = new URLSearchParams(fields);
  const lines = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort();
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  params.set('hash', createHmac('sha256', secret).update(lines.join('\n')).digest('hex'));
  return params.toString();
}
