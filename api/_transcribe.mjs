/* Речь в текст - решения, у которых есть правильный ответ. SPLIT-PLAN §7, шаг 13.
 *
 * ЧТО ЭТО МЕНЯЕТ И ПОЧЕМУ ЭТО СКАЗАНО ПЕРВЫМ. До сегодня диктовка работала В БРАУЗЕРЕ и по возможности НЕ
 * ПОКИДАЛА МАШИНУ: web/src/features/create/dictation.ts спрашивает `processLocally: true` и включает его,
 * когда языковой пакет есть на устройстве. Его заголовок называет это «главным решением в файле» - потому
 * что продукт, который смотрит в чужой экран, обязан говорить, что именно с него уходит.
 *
 * Владелец выбрал распознавание у OpenAI (2026-09-17): качество, и довод настоящий - в продиктованной цели
 * имена приложений, подписи кнопок и русский, то есть ровно то, где браузерный распознаватель слабее всего.
 * Но цена у выбора тоже настоящая: ЗВУК УХОДИТ С МАШИНЫ КАЖДЫЙ РАЗ, третьей стороне. Это не побочный
 * эффект, это и есть выбор, и он переворачивает решение того файла.
 *
 * Поэтому здесь лежит WHERE_AUDIO_GOES - одна фраза на всех, кто просит микрофон, и показывать её надо ДО
 * того, как микрофон включён, а не после. Одна, потому что две редакции этой фразы - это два разных
 * обещания о том, куда уходит голос человека.
 *
 * ПОЧЕМУ САМ ВЫЗОВ ТОЖЕ ЗДЕСЬ, а не в маршруте. Тот же довод, что у api/_vision.mjs, и он там написан:
 * просить у своего же HTTP-маршрута - это второй вызов функции, вторая проверка прав и второй набор
 * потолков, который однажды разойдётся с первым. Просителей двое - страница и дверь мессенджера
 * (голосовое сообщение это та же диктовка, только приехавшая файлом), - и то, что ОДИН раз ограничено,
 * ограничено здесь: размер, тип, имя модели.
 *
 * ИМЯ МОДЕЛИ БЕРЁТСЯ ИЗ ОКРУЖЕНИЯ И НЕ ЗАШИВАЕТСЯ - §7 требует этого прямо, а api/models.js существует,
 * чтобы у развёртывания можно было СПРОСИТЬ, а не вспомнить.
 */

/** Одна фраза на всех. Показывается ДО того, как микрофон включён. */
export const WHERE_AUDIO_GOES = 'Dictation is sent to OpenAI to be recognised. The recording leaves this '
  + 'computer; the text comes back.';

/** И вторая, для того, кто выбрал не отправлять. Пара, потому что выбор должен читаться с обеих сторон. */
export const STAYS_HERE = 'Dictation stays on this computer - this browser recognises it, and no audio is '
  + 'sent anywhere.';

/* СКОЛЬКО ЗВУКА ЗА РАЗ. Три мегабайта, и число взято не у OpenAI (у него 25) - у платформы: тело функции
 * ограничено примерно четырьмя с половиной, а base64 раздувает на треть, так что три декодированных - это
 * впритык то, что вообще способно доехать. Называть 25 значило бы обещать то, что отвалится по дороге с
 * ошибкой, в которой не будет слова «звук».
 *
 * И это не мало для того, ради чего всё: продиктованная цель - это секунды, а не лекция. */
export const AUDIO_MAX_BYTES = 3_000_000;

/* ЧТО ПРИНИМАЕМ. Список - тот, который принимает сам эндпоинт транскрипции; проверяется он у нас затем,
 * чтобы отказ звучал словами про звук, а не «400 Bad Request» с чужой стороны, за который уже заплачено
 * временем загрузки. */
export const AUDIO_TYPES = new Set([
  'audio/flac', 'audio/m4a', 'audio/x-m4a', 'audio/mp3', 'audio/mpeg', 'audio/mp4', 'audio/mpga',
  'audio/oga', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/webm', 'video/mp4', 'video/webm',
]);

/** Расширение, которое эндпоинт узнает. Он смотрит на ИМЯ файла, а не только на тип. */
export function extensionFor(type) {
  const said = String(type || '').toLowerCase().split(';')[0].trim();
  if (said === 'audio/ogg' || said === 'audio/oga') return 'ogg';
  if (said === 'audio/webm' || said === 'video/webm') return 'webm';
  if (said === 'audio/mpeg' || said === 'audio/mp3' || said === 'audio/mpga') return 'mp3';
  if (said === 'audio/mp4' || said === 'video/mp4' || said === 'audio/m4a' || said === 'audio/x-m4a') return 'm4a';
  if (said === 'audio/wav' || said === 'audio/x-wav') return 'wav';
  if (said === 'audio/flac') return 'flac';
  return null;
}

/**
 * Почему этот звук не отправляем, или null. Отказ - готовая фраза: у обоих отказов ровно один способ быть
 * полезным, и оба называют число, а не «слишком большой».
 */
export function refusedAudio({ bytes, type }) {
  const said = String(type || '').toLowerCase().split(';')[0].trim();
  if (!said) return 'That upload did not say what kind of audio it is, so it was not sent anywhere.';
  if (!AUDIO_TYPES.has(said)) {
    return `${said} is not a kind of audio this can recognise. Send one of: wav, mp3, m4a, ogg, webm, flac.`;
  }
  if (!Number.isFinite(bytes) || bytes <= 0) return 'That upload had no audio in it.';
  if (bytes > AUDIO_MAX_BYTES) {
    return `That recording is ${Math.round(bytes / 1024)} kB and the limit is `
      + `${Math.round(AUDIO_MAX_BYTES / 1024)} kB. A dictated goal is seconds long; say it in one breath.`;
  }
  return null;
}

/* КАКАЯ МОДЕЛЬ - ИЗ ОКРУЖЕНИЯ, И ОТСУТСТВИЕ ЭТО ОТКАЗ, А НЕ УМОЛЧАНИЕ.
 *
 * §7: «идентификатор модели идёт в окружение со списком разрешённых, как уже сделано у OPENAI_MODEL, - НЕ
 * зашитый из чьей-то памяти о том, что OpenAI сейчас отдаёт». Умолчание здесь было бы ровно такой памятью:
 * оно работало бы до дня, когда имя меняется, а потом маршрут отвечал бы чужим «model not found», за
 * которым никто не догадается искать эту строку.
 *
 * Спросить, какие имена живые, можно у /api/models - он для этого и написан, и с 2026-09-21 показывает
 * распознаватели отдельным списком. */
export const TRANSCRIBE_MODEL_VAR = 'OPENAI_TRANSCRIBE_MODEL';

export const modelFrom = (env) => {
  const said = String((env && env[TRANSCRIBE_MODEL_VAR]) || '').trim();
  return said || null;
};

export const NO_MODEL = 'This deployment has not said which recogniser to use. Set '
  + `${TRANSCRIBE_MODEL_VAR} to one of the ids /api/models lists under "audio".`;

/* ЧТО ВЕРНУЛОСЬ. Распознаватель отдаёт прозу, а она едет в ЦЕЛЬ - то есть в то, что потом выполняется на
 * настоящей машине. Поэтому здесь обрезка и нормализация пробелов, а не «как пришло»: перевод строки
 * посреди продиктованной фразы ничего не значит, а в цели он выглядит как два указания. */
export const RESULT_MAX = 4000;

export function cleanTranscript(said) {
  return String(said == null ? '' : said).replace(/\s+/g, ' ').trim().slice(0, RESULT_MAX);
}

/* ------------------------------------------------------------------------------------ сам вызов */

const UPSTREAM = 'https://api.openai.com/v1/audio/transcriptions';

/* Один вызов может висеть, пока платформа не убьёт функцию. Речь на несколько секунд узнаётся за пару;
 * тридцать - это «что-то не так», а не «ещё немного». */
export const TIMEOUT_MS = 30_000;

/**
 * Узнать речь. Никогда не бросает: каждый способ не получиться - это поле, потому что оба вызывающих
 * обязаны сказать про каждый что-то своё, а исключение говорит про все одно и то же.
 *
 * @returns {Promise<{ text?: string, why?: string, status?: number }>}
 *   `text` - уже вычищенный (см. cleanTranscript), возможно пустой: тишина это ответ, а не ошибка.
 *   `why` - готовая фраза для человека.
 */
export async function recognise(bytes, type, { language = null, key = null } = {}) {
  const useKey = key || process.env.OPENAI_API_KEY;
  if (!useKey) return { why: 'This deployment has no OpenAI key configured, so it cannot recognise speech.' };
  const model = modelFrom(process.env);
  if (!model) return { why: NO_MODEL };

  const refused = refusedAudio({ bytes: bytes ? bytes.length : 0, type });
  if (refused) return { why: refused };

  const form = new FormData();
  /* ИМЯ ФАЙЛА ЗНАЧИМО: эндпоинт смотрит на расширение, а не только на content-type, и «blob» без него
   * отвергается сообщением про формат, в котором не сказано, что дело в имени. */
  form.append('file', new Blob([bytes], { type }), `dictation.${extensionFor(type) || 'webm'}`);
  form.append('model', model);
  /* Язык - подсказка, а не требование, и передаётся только если его назвали. Угаданный язык хуже
   * неназванного: распознаватель, которому сказали «en» на русскую фразу, выдаёт уверенную чушь. */
  if (language) form.append('language', String(language).slice(0, 8));
  form.append('response_format', 'json');

  const cutoff = new AbortController();
  const timer = setTimeout(() => cutoff.abort(), TIMEOUT_MS);
  let upstream;
  let said;
  try {
    upstream = await fetch(UPSTREAM, {
      method: 'POST', headers: { authorization: `Bearer ${useKey}` }, signal: cutoff.signal, body: form,
    });
    said = await upstream.text();
  } catch (err) {
    clearTimeout(timer);
    return {
      why: err && err.name === 'AbortError'
        ? 'the recogniser took too long to answer'
        : `the recogniser could not be reached: ${err && err.message}`,
    };
  }
  clearTimeout(timer);

  if (!upstream.ok) {
    /* СВОИМИ СЛОВАМИ ВЕРХА. Тот же урок, что на плане из телеграма в тот же день: «HTTP 401» не говорит
     * ничего ни человеку, ни тому, кто это чинит, а причина лежит в теле ответа и её надо только не
     * выбросить. Чаще всего здесь будет именно имя модели. */
    let why = said.slice(0, 300);
    try { why = JSON.parse(said).error?.message || why; } catch (_) { /* raw it is */ }
    return { status: upstream.status, why: `the recogniser refused (HTTP ${upstream.status}): ${why}` };
  }

  try {
    return { text: cleanTranscript(JSON.parse(said).text) };
  } catch (_) {
    return { status: 502, why: 'the recogniser answered with something that is not JSON' };
  }
}
