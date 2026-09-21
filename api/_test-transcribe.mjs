/* Речь в текст, проверенная исполнением — SPLIT-PLAN §7, шаг 13.
 *
 * ЧТО ЗДЕСЬ СТОРОЖИТСЯ, И ПОЧЕМУ ИМЕННО ЭТО. Диктовка переехала с браузера на OpenAI, и это ПЕРЕВОРАЧИВАЕТ
 * центральное решение файла, который она заменяет: раньше звук по возможности не покидал машину, теперь
 * он уходит всегда. Продукт, который смотрит в чужой экран, обязан сказать об этом до микрофона, а не
 * после, - значит фраза об этом должна БЫТЬ, быть одна и быть доступной раньше записи. Это проверяется.
 *
 * Второе - имя модели. §7 требует брать его из окружения и не зашивать «из памяти о том, что OpenAI
 * сейчас отдаёт». Умолчание здесь было бы ровно такой памятью, поэтому проверяется его ОТСУТСТВИЕ.
 *
 * Run: node api/_test-transcribe.mjs
 */
import { readFileSync } from 'node:fs';

import {
  AUDIO_MAX_BYTES, NO_MODEL, RESULT_MAX, STAYS_HERE, TRANSCRIBE_MODEL_VAR, WHERE_AUDIO_GOES,
  cleanTranscript, extensionFor, modelFrom, refusedAudio,
} from './_transcribe.mjs';

let pass = 0;
let fail = 0;
const check = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  -> ' + detail : '')); }
};
const group = (t) => console.log('\n' + t);

group('куда уходит звук - сказано, и сказано одним местом');
{
  check('фраза существует и называет получателя', /OpenAI/.test(WHERE_AUDIO_GOES));
  check('и говорит, что запись покидает компьютер', /leaves this computer/.test(WHERE_AUDIO_GOES));
  /* ПАРА, А НЕ ОДНА ФРАЗА. Выбор читается с обеих сторон: тот, кто предпочёл не отправлять, должен
   * видеть утверждение о своём случае, а не отсутствие утверждения о чужом. */
  check('и у второй половины выбора есть своя фраза', /stays on this computer/.test(STAYS_HERE));
  check('и она обещает обратное прямо', /no audio is sent anywhere/.test(STAYS_HERE));

  /* ДО МИКРОФОНА, А НЕ ПОСЛЕ - то есть спрашивается дешёвым GET-ом, который ничего не тратит. */
  const route = readFileSync(new URL('./transcribe.js', import.meta.url), 'utf8');
  check('маршрут отдаёт её GET-ом, без траты и без звука',
    /if \(req\.method === 'GET'\)/.test(route) && /where: WHERE_AUDIO_GOES/.test(route));
  check('и GET стоит раньше проверки POST - иначе за фразой пришлось бы слать звук',
    route.indexOf("req.method === 'GET'") < route.indexOf("req.method !== 'POST'"));
}

group('имя модели - из окружения, и отсутствие это отказ, а не умолчание');
{
  check('переменная названа', TRANSCRIBE_MODEL_VAR === 'OPENAI_TRANSCRIBE_MODEL');
  check('пусто - null', modelFrom({}) === null && modelFrom(null) === null);
  check('пробелы - тоже null', modelFrom({ OPENAI_TRANSCRIBE_MODEL: '   ' }) === null);
  check('названное - берётся как есть', modelFrom({ OPENAI_TRANSCRIBE_MODEL: 'whisper-1' }) === 'whisper-1');
  /* НИКАКОГО УМОЛЧАНИЯ В ИСХОДНИКЕ. Зашитое имя работало бы до дня, когда оно меняется, а потом маршрут
   * отвечал бы чужим «model not found», за которым никто не догадается искать эту строку. */
  const mod = readFileSync(new URL('./_transcribe.mjs', import.meta.url), 'utf8');
  check('и в модуле нет зашитого имени распознавателя',
    !/whisper-\d|gpt-4o-transcribe|['"]\w+-transcribe['"]/.test(mod.replace(/\/\*[\s\S]*?\*\//g, '')));
  /* И ОТКАЗ ГОВОРИТ, ГДЕ ВЗЯТЬ ИМЯ. Ответ «не настроено» без адреса - это тупик с вежливой формулировкой. */
  check('отказ называет и переменную, и где посмотреть живые имена',
    NO_MODEL.includes(TRANSCRIBE_MODEL_VAR) && /\/api\/models/.test(NO_MODEL));
}

group('что не отправляем, и отказ называет число');
{
  check('обычное голосовое проходит', refusedAudio({ bytes: 40_000, type: 'audio/ogg' }) === null);
  check('запись браузера проходит', refusedAudio({ bytes: 120_000, type: 'audio/webm;codecs=opus' }) === null);
  const big = refusedAudio({ bytes: AUDIO_MAX_BYTES + 1, type: 'audio/ogg' });
  check('слишком большое - отказ', !!big);
  /* Число, а не «слишком большой»: человек, которому не сказали предела, пробует ещё раз наугад. */
  check('и в отказе оба числа', /\d+ kB and the limit is \d+ kB/.test(big), big);
  check('не звук вовсе - отказ, и он перечисляет годное',
    /wav, mp3, m4a, ogg, webm, flac/.test(refusedAudio({ bytes: 100, type: 'application/pdf' }) || ''));
  /* ТИП НЕ НАЗВАН - ЭТО НЕ «НАВЕРНОЕ, WEBM». Отправить наугад значит заплатить за отказ чужой стороны. */
  check('без типа - отказ, и ничего не отправлено',
    /did not say what kind of audio/.test(refusedAudio({ bytes: 100, type: '' }) || ''));
  check('нулевой размер - отказ', !!refusedAudio({ bytes: 0, type: 'audio/ogg' }));
}

group('расширение в имени файла - потому что эндпоинт смотрит на него');
{
  check('ogg', extensionFor('audio/ogg') === 'ogg');
  check('и с параметрами кодека', extensionFor('audio/webm;codecs=opus') === 'webm');
  check('mpeg - это mp3', extensionFor('audio/mpeg') === 'mp3');
  check('m4a в обоих написаниях', extensionFor('audio/m4a') === 'm4a' && extensionFor('audio/x-m4a') === 'm4a');
  check('незнакомое - null, а не догадка', extensionFor('audio/unknown') === null);
}

group('что вернулось: проза, которая поедет в цель');
{
  check('пробелы нормализуются', cleanTranscript('  открой   почту \n и напиши  ') === 'открой почту и напиши');
  /* Перевод строки посреди продиктованной фразы ничего не значит, а в цели читается как два указания. */
  check('перенос строки не остаётся', !/\n/.test(cleanTranscript('одно\nдва')));
  check('пусто - пустая строка, а не null', cleanTranscript(null) === '' && cleanTranscript(undefined) === '');
  check('длинное режется по потолку', cleanTranscript('a'.repeat(RESULT_MAX + 500)).length === RESULT_MAX);
}

group('маршрут: ключ на сервере, счёт до отправки, слова верха не выброшены');
{
  const route = readFileSync(new URL('./transcribe.js', import.meta.url), 'utf8');
  const mod = readFileSync(new URL('./_transcribe.mjs', import.meta.url), 'utf8');

  check('без входа не распознаём', /if \(!who\) return fail\(res, 401/.test(route));
  /* ПОТОЛОК ДО ОТПРАВКИ, а форма - до потолка: отказанный звук ничего не стоил, и считать его значило бы
   * наказывать за то, что уже отказано. */
  check('форма проверяется раньше потолка, потолок - раньше отправки',
    route.indexOf('refusedAudio(') < route.indexOf("overSpend(sql, who.id, 'transcribe')")
      && route.indexOf("overSpend(sql, who.id, 'transcribe')") < route.indexOf('await recognise('));
  /* САМ ВЫЗОВ - В МОДУЛЕ. Просителей двое, и второй - дверь мессенджера; просить у своего же HTTP-маршрута
   * значило бы вторую проверку прав и второй набор потолков, который однажды разойдётся с первым. */
  check('вызов наверх живёт в модуле, а не в маршруте',
    /api\.openai\.com\/v1\/audio\/transcriptions/.test(mod)
      && !/api\.openai\.com/.test(route));
  check('и мессенджер зовёт ту же функцию, а не наш же HTTP',
    /recognise\(bytes, update\.voice\.mime\)/.test(readFileSync(new URL('./telegram.js', import.meta.url), 'utf8')));
  /* СЛОВА ВЕРХА НЕ ВЫБРАСЫВАЮТСЯ - тот же урок, что был оплачен «HTTP 401» на плане из телеграма. */
  check('отказ распознавателя пересказывает его собственную причину',
    /the recogniser refused \(HTTP \$\{upstream\.status\}\): \$\{why\}/.test(mod));
  /* ТИШИНА - ЭТО ОТВЕТ. Пустая строка успехом выглядела бы как «поле почему-то не заполнилось». */
  check('тишина названа словами, а не пустым успехом',
    /Nothing was said, or the microphone recorded silence/.test(route));
}

group('голосовое в мессенджере - та же диктовка, приехавшая файлом');
{
  const tg = readFileSync(new URL('./_telegram.mjs', import.meta.url), 'utf8');
  const route = readFileSync(new URL('./telegram.js', import.meta.url), 'utf8');

  check('и voice, и audio читаются как звук', /m\.voice[\s\S]{0,120}m\.audio/.test(tg));
  /* Телеграм почти всегда присылает ogg/opus у голосовых, но «почти» - не «всегда», а пустой тип у нас
   * означал бы отказ «не сказано, какой это звук» на совершенно обычном сообщении. */
  check('и у голосового есть умолчание типа', /'audio\/ogg'/.test(tg));
  check('голосовое считается просьбой, а не пустым сообщением',
    /!update\.text && !update\.document && !update\.voice/.test(tg));

  /* УСЛЫШАННОЕ ПОКАЗЫВАЕТСЯ ДОСЛОВНО И ВЫШЕ ПЛАНА. План по неверно услышанной фразе выглядит совершенно
   * связным - он и есть связный, просто не про то, - и поймать это можно только до нажатия Approve. */
  check('услышанное показывается дословно', /Heard: "\$\{heard\}"/.test(tg));
  check('и выше плана, а не под ним',
    tg.indexOf('Heard: "${heard}"') < tg.indexOf("plan && plan.title ? String(plan.title)"));
  check('и доезжает до сообщения с кнопками', /planMessage\(\{ plan, files, heard, id \}\)/.test(route));
  check('нераспознанное голосовое отвечает словами, а не тишиной',
    /heardNothing/.test(tg) && /SAY\.heardNothing/.test(route));
  /* И ПОМОЩЬ ГОВОРИТ, КУДА УХОДИТ ГОЛОС - до того, как человек первый раз зажмёт микрофон. */
  check('и /help называет получателя звука', /sent to OpenAI to be recognised/.test(tg));
}


/* ---------------------------------------------------------------- язык: подсказка, а не требование
 *
 * ЖИВОЙ ВОПРОС ВЛАДЕЛЬЦА: «мы что, только русский поддерживаем на диктовку?» В панели язык был написан
 * СЛОВОМ и не выбирался - то есть строка называла настройку, тронуть которую было нечем. Хуже, чем её
 * отсутствие: человек видит «Русский» и делает вывод о продукте.
 *
 * И ответ оказался не «добавить список», а «убрать обязанность»: у серверного распознавателя язык - это
 * ПОДСКАЗКА, он определяет сам, а неверная подсказка хуже её отсутствия. Тому, кто диктует то по-русски,
 * то по-английски, список - это переключатель, который он обязан не забыть. */
group('язык диктовки: «авто» у сервера, настоящий - у браузера');
{
  const speech = readFileSync(new URL('../web/src/features/create/dictation.ts', import.meta.url), 'utf8');
  check('«авто» объявлено', /export const AUTO = 'auto';/.test(speech));
  check('и оно умолчание - не догадка о том, на каком языке заговорят',
    /return AUTO;\n\}/.test(speech));
  /* ОТПРАВЛЯЕТСЯ ПУСТО, А НЕ СЛОВО 'auto': языка с таким кодом не существует, и распознаватель ответил бы
   * отказом про неизвестный язык - там, где мы просили его решить самому. */
  check('и в запрос уходит пусто, а не строка auto',
    /lang === AUTO \? \{\} : \{ language: lang\.split\('-'\)\[0\] \}/.test(speech));
  /* У БРАУЗЕРНОГО ПУТИ «АВТО» НЕВОЗМОЖНО: Web Speech без языка не работает вовсе. Поправляется в двух
   * местах, и оба нужны - переключиться можно было и в прошлой сессии. */
  check('браузерному распознавателю «авто» не предлагается',
    /via === 'openai' \? \[AUTO\] : \[\]/.test(speech));
  check('и подменяется языком браузера - при переключении и при первом рендере',
    /next === 'browser' && dictationLang\(\) === AUTO/.test(speech)
      && /dictationVia\(\) === 'browser' && kept === AUTO/.test(speech));
  /* И ВЫБОР ЕСТЬ ТАМ, ГДЕ НАПИСАН ЯЗЫК. Надпись без способа её изменить - это то, с чего начался вопрос. */
  const panel = readFileSync(new URL('../web/src/features/panel/PanelView.tsx', import.meta.url), 'utf8');
  check('и в панели язык выбирается, а не только называется',
    /dictation\.setLang\(ev\.target\.value\)/.test(panel) && /dictation\.choices\.map/.test(panel));

  /* ОБЕЩАНИЕ ОСТАЁТСЯ, ХОТЯ СТРОКА УШЛА. Владелец попросил убрать её ради места, и это верно для того,
   * кто уже диктовал: правило §7 про МОМЕНТ - «до того, как включат микрофон», - а не про постоянную
   * строку. Поэтому она показывается до первой состоявшейся диктовки и исчезает после, и остаётся
   * вторым способом - подписью на самой кнопке, которая никуда не девается. */
  check('и обещание о звуке стоит до первой диктовки, а не после',
    /!told &&/.test(panel) && /WHERE_AUDIO_GOES/.test(panel));
  /* ВНУТРИ КОЛБЭКА, а не где-нибудь в файле: «прочитано» ставится, когда текст ВЕРНУЛСЯ, а не когда
   * нажали кнопку - нажать и передумать это не «я понял, куда уходит звук».
   *
   * Границы среза здесь были посчитаны через indexOf('useEffect'), и он нашёл слово в строке импорта -
   * то есть срез вышел пустым, а пин зелёным ни на чём. Поймано первым же запуском. */
  check('и «прочитано» доказывается состоявшейся диктовкой, а не нажатием',
    /useDictation\(\(text\)[\s\S]{0,500}?setTold\(true\)/.test(panel));
  check('и кнопка микрофона несёт то же обещание подписью',
    /title=\{dictation\.via === 'openai' \? WHERE_AUDIO_GOES : STAYS_HERE\}/.test(panel));
  /* И ТЕКСТ НЕ ПЕРЕПИСАН РУКАМИ: он из того же модуля, что у маршрута. */
  check('и берётся из общего модуля, а не написан в панели заново',
    /from '\.\.\/\.\.\/\.\.\/\.\.\/api\/_transcribe\.mjs'/.test(panel)
      && !/Dictation goes to OpenAI/.test(panel));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
