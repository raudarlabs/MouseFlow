/* Голос в текст: третий транспорт, а не новый аргумент к ask(). SPLIT-PLAN §7, шаг 13.
 *
 *   POST /api/transcribe   { audio: "<base64>", type: "audio/webm", language?: "ru" }
 *        -> { ok: true, text: "..." }
 *
 * ПОЧЕМУ НЕ ЧЕРЕЗ api/_provider.js. Его заголовок говорит прямо: это Responses API и «не универсальный
 * SDK - ни потоков, ни картинок». Транскрипция живёт на другом эндпоинте и говорит multipart, а не JSON.
 * Пришить её к ask() значило бы сделать из провайдера то, чем он отказался быть.
 *
 * ФОРМА СКОПИРОВАНА С api/claude.js, и это осознанно: ключ остаётся на сервере, загрузка ограничена, и
 * маршрут считается через api/_spend.mjs под своим ключом `transcribe`. Всё три - про одно и то же: этот
 * маршрут тратит деньги развёртывания за любого, кто до него дотянулся.
 *
 * ЧТО ЭТОТ ФАЙЛ ГОВОРИТ ВСЛУХ. Звук уходит с машины. Фраза об этом - одна на всех (WHERE_AUDIO_GOES в
 * api/_transcribe.mjs), и показывать её обязан КАЖДЫЙ, кто просит микрофон, до того как включит его.
 * Здесь она отдаётся GET-ом, чтобы у страницы не было своей редакции этого обещания.
 *
 * САМ ВЫЗОВ - НЕ ЗДЕСЬ, а в api/_transcribe.mjs, рядом с потолками: просителей двое, и второй - дверь
 * мессенджера, где голосовое сообщение это та же диктовка, приехавшая файлом.
 *
 * BASE64, А НЕ MULTIPART НА ВХОДЕ. Платформа разбирает JSON сама, а разбор multipart пришлось бы писать
 * руками - ради того, чтобы принять то, что мы всё равно тут же переупаковываем. Цена названа честно:
 * base64 раздувает треть, и потолок в api/_transcribe.mjs посчитан от предела тела функции, а не от
 * предела OpenAI.
 */
import { neon } from '@neondatabase/serverless';

import { whoIsCalling } from './_session.js';
import { report, wrap } from './_report.js';
import { cors } from './_cors.mjs';
import { overSpend, spentWhy } from './_spend.mjs';
import { AUDIO_MAX_BYTES, STAYS_HERE, WHERE_AUDIO_GOES, modelFrom, recognise, refusedAudio } from './_transcribe.mjs';

const fail = (res, status, message) =>
  res.status(status).json({ ok: false, error: { type: 'transcribe_error', message } });

async function handler(req, res) {
  cors(req, res, 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  /* ЧТО СКАЗАТЬ ЧЕЛОВЕКУ ДО МИКРОФОНА - отдельным, дешёвым вопросом, который ничего не тратит и никого не
   * спрашивает. Страница обязана показать эту фразу прежде, чем включит запись, и брать её здесь, а не
   * хранить свою: два обещания о том, куда уходит голос, - это одно обещание и одна ложь. */
  if (req.method === 'GET') {
    const model = modelFrom(process.env);
    return res.status(200).json({
      ok: true,
      configured: !!process.env.OPENAI_API_KEY && !!model,
      where: WHERE_AUDIO_GOES,
      staysHere: STAYS_HERE,
      maxBytes: AUDIO_MAX_BYTES,
    });
  }
  if (req.method !== 'POST') return fail(res, 405, 'GET or POST');

  const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
  if (!sql) return fail(res, 503, 'This deployment has no database configured.');

  let who;
  try {
    who = await whoIsCalling(req, sql);
  } catch (err) {
    await report(err, req, { route: 'transcribe' });
    return fail(res, 500, `could not check who is calling: ${err.message}`);
  }
  if (!who) return fail(res, 401, 'sign in first');

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const encoded = String(body.audio || '');
  if (!encoded) return fail(res, 400, 'No audio. Send it as base64 in `audio`, with its `type`.');

  let bytes;
  try {
    bytes = Buffer.from(encoded, 'base64');
  } catch (_) {
    return fail(res, 400, 'That audio is not base64.');
  }
  const type = String(body.type || '').toLowerCase().split(';')[0].trim();
  /* ФОРМА - ДО ПОТОЛКА, а потолок - до отправки. Отказанный звук ничего не стоил, и считать его значило
   * бы наказывать за то, что уже отказано; отправленный стоит денег, и считать его надо до, а не после. */
  const refused = refusedAudio({ bytes: bytes.length, type });
  if (refused) return fail(res, 413, refused);

  const budget = await overSpend(sql, who.id, 'transcribe');
  if (!budget.ok) return fail(res, 429, spentWhy(budget, 'dictations'));

  const heard = await recognise(bytes, type, { language: body.language || null });
  if (heard.why) return fail(res, heard.status || 503, heard.why);
  /* ПУСТО - ЭТО ОТВЕТ, А НЕ ОШИБКА, и он говорит человеку то, что с ним произошло: микрофон писал тишину.
   * Вернуть пустую строку успехом значило бы, что поле цели просто не заполнилось, и виноват как будто бы
   * интерфейс. */
  if (!heard.text) {
    return res.status(200).json({ ok: true, text: '', said: 'Nothing was said, or the microphone recorded silence.' });
  }

  return res.status(200).json({ ok: true, text: heard.text });
}

export default wrap(handler, 'transcribe');
