/* Диктовка цели голосом — ДВА РАСПОЗНАВАТЕЛЯ, ОДИН ПЕРЕКЛЮЧАТЕЛЬ, ОДНА ФРАЗА (SPLIT-PLAN §7, шаг 13).
 *
 * ЧТО ЗДЕСЬ БЫЛО И ПОЧЕМУ ЭТО НЕ ВЫБРОШЕНО. Файл начинался с решения, которое его заголовок называл
 * главным: по умолчанию Chrome отправляет звук с микрофона на свои серверы, и для продукта, который
 * смотрит в чужой экран и обещает говорить, что именно с него уходит, тихо добавить такое было бы
 * повторением ошибки, которую мы уже один раз отзывали. Поэтому спрашивался `processLocally: true`, и
 * при наличии языкового пакета звук не покидал машину вовсе.
 *
 * ЧТО ИЗМЕНИЛОСЬ. Владелец выбрал распознавание у OpenAI - за качество, и довод настоящий: в
 * продиктованной цели имена приложений, подписи кнопок и русский, то есть ровно то, где браузерный
 * распознаватель слабее всего. Проверено на живом голосовом в телеграме в тот же день.
 *
 * ЦЕНА НАЗВАНА, А НЕ УМОЛЧАНА: в этом режиме звук уходит с машины КАЖДЫЙ РАЗ. Поэтому решение прежнего
 * заголовка не выброшено, а стало ВТОРЫМ РЕЖИМОМ - и переключателем, а не мёртвым кодом. Человек с
 * языковым пакетом, который предпочтёт не отправлять звук, по-прежнему может диктовать.
 *
 * `where` - это то, что читает человек, поэтому оно часть состояния, а не деталь реализации. И сами
 * фразы про то, куда уходит звук, живут в api/_transcribe.mjs, у маршрута: две редакции одного обещания -
 * это одно обещание и одна ложь.
 *
 * ДВА РЕЖИМА РАБОТАЮТ ПО-РАЗНОМУ, И ЭТО ВИДНО ГЛАЗОМ. Браузерный отдаёт слова по мере речи (`interim`);
 * серверный не отдаёт ничего, пока не остановишь запись, - сначала `listening`, потом `recognising`, и
 * только потом текст. Скрывать эту разницу нечем и незачем: кнопка говорит, что происходит.
 *
 * Типы объявлены здесь: lib.dom ещё не знает ни `processLocally`, ни статических available()/install(),
 * а `any` в этом месте спрятал бы ровно те поля, ради которых всё написано.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

/* Фразы и потолок - оттуда же, откуда их берёт маршрут. Одно обещание о том, куда уходит голос. */
import { refusedAudio } from '../../../../api/_transcribe.mjs';
/* И диктовка тоже: в панели куки нет, а речь узнаётся тем же маршрутом. */
import { asPanel, inPanel } from '@/lib/panel-auth';

interface RecognitionAlternative { transcript: string }
interface RecognitionResult { isFinal: boolean; 0: RecognitionAlternative; length: number }
interface RecognitionResultList { length: number; [i: number]: RecognitionResult }
interface RecognitionEvent { resultIndex: number; results: RecognitionResultList }
interface RecognitionErrorEvent { error: string }

interface Recognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  processLocally?: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

type Availability = 'available' | 'downloading' | 'downloadable' | 'unavailable';

interface RecognitionClass {
  new (): Recognition;
  available?(o: { langs: string[]; processLocally?: boolean; quality?: string }): Promise<Availability>;
  install?(o: { langs: string[]; processLocally?: boolean }): Promise<boolean>;
}

const Speech = (): RecognitionClass | null => {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionClass;
    webkitSpeechRecognition?: RecognitionClass;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

/** Where the audio goes. `unknown` until asked - never assumed, because the answer decides what we say. */
export type Where = 'unknown' | 'on-this-computer' | 'a-server' | 'downloadable' | 'no' | 'openai';

/** Какой распознаватель выбран. `openai` - по умолчанию с 2026-09-21; `browser` - прежний путь. */
export type Via = 'openai' | 'browser';

const VIA_KEY = 'mouseflow.dictation.via';

export function dictationVia(): Via {
  try {
    return localStorage.getItem(VIA_KEY) === 'browser' ? 'browser' : 'openai';
  } catch (_) {
    /* Приватное окно, запрещённые куки: умолчание - это ответ, а не поломка. */
    return 'openai';
  }
}

export function rememberDictationVia(via: Via) {
  try { localStorage.setItem(VIA_KEY, via); } catch (_) { /* см. выше */ }
}

/* Язык, на котором человек говорит. ВЫБОР, А НЕ ДОГАДКА.
 *
 * Сначала здесь стоял просто `navigator.language`, и это оказалось неверно на первой же живой машине:
 * интерфейс Chrome по-русски, а `navigator.language` вернул английский - он отражает список
 * предпочитаемых языков, а не язык, на котором человек говорит вслух. Результат - русская речь,
 * распознанная как английская, что выглядит как сломанное распознавание, а не как неверная настройка.
 *
 * Поэтому браузер даёт лишь НАЧАЛЬНОЕ значение, а выбранное запоминается. Ключ локальный: язык диктовки -
 * свойство этого человека за этой машиной, а не аккаунта, и синхронизировать его между машинами значило бы
 * менять язык на чужой из-за того, что кто-то один переключил. */
const LANG_KEY = 'mf.dictation.lang';

/* И «АВТО» - У СЕРВЕРНОГО РАСПОЗНАВАТЕЛЯ, КОТОРЫЙ ОПРЕДЕЛЯЕТ ЯЗЫК САМ.
 *
 * Язык там - ПОДСКАЗКА, а не требование, и подсказка неверная хуже её отсутствия: распознаватель,
 * которому сказали «en» на русскую фразу, выдаёт уверенную чушь. У того, кто диктует то по-русски, то
 * по-английски, выбор из списка - это переключатель, который он обязан не забыть, а «авто» - отсутствие
 * такой обязанности.
 *
 * Браузерному распознавателю язык НУЖЕН: Web Speech без него не работает вовсе. Поэтому «авто» есть
 * только у серверного пути, и при переключении на браузерный подставляется язык браузера - см. setVia. */
export const AUTO = 'auto';

export function dictationLang(): string {
  try {
    const kept = localStorage.getItem(LANG_KEY);
    if (kept) return kept;
  } catch (_) {
    /* Приватный режим или отключённое хранилище - не повод не диктовать. */
  }
  /* Умолчание - «авто»: оно верно чаще, чем любая догадка о том, на каком языке заговорят. Тот, кому
   * нужен точный язык, выберет его один раз, и выбор запомнится. */
  return AUTO;
}

export function rememberDictationLang(tag: string) {
  try { localStorage.setItem(LANG_KEY, tag); } catch (_) { /* см. выше */ }
}

/* Что предложить в списке.
 *
 * Сначала то, что человек НАСТРОИЛ в браузере - если русский есть в его списке, он будет наверху, - потом
 * несколько распространённых. Порядок не алфавитный: первым идёт то, что вероятнее всего верно. */
const COMMON = ['en-US', 'ru-RU', 'uk-UA', 'de-DE', 'fr-FR', 'es-ES', 'pl-PL'];

export function dictationChoices(current: string, via: Via = 'openai'): string[] {
  const out: string[] = [];
  /* «Авто» первым и только у серверного пути - список начинается с того, что вероятнее всего верно. */
  for (const tag of [...(via === 'openai' ? [AUTO] : []), current, ...(navigator.languages ?? []), ...COMMON]) {
    if (!tag) continue;
    /* По базовому языку, а не по полному тегу: "ru" из настроек и "ru-RU" из списка - один и тот же выбор,
     * и две строки «русский» подряд читаются как ошибка. */
    if (tag === AUTO) { out.push(tag); continue; }
    const base = tag.split('-')[0];
    if (out.some((have) => have.split('-')[0] === base)) continue;
    out.push(tag);
  }
  return out;
}

/* Название языка словами, для строки, которую читают. Intl уже умеет это на языке самого интерфейса. */
export function langName(tag: string): string {
  if (tag === AUTO) return 'Auto';
  try {
    return new Intl.DisplayNames([tag], { type: 'language' }).of(tag) ?? tag;
  } catch (_) {
    return tag;
  }
}

/* ЧТО ЗАПИСЫВАТЬ. Chrome и Firefox умеют webm/opus, Safari - mp4; спрашивается у браузера, а не
 * утверждается, потому что запись в формате, который он не поддерживает, падает в момент нажатия. */
const RECORD_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

function recordType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const type of RECORD_TYPES) {
    try { if (MediaRecorder.isTypeSupported(type)) return type; } catch (_) { /* пробуем следующий */ }
  }
  return null;
}

/* Base64 КУСКАМИ. `String.fromCharCode(...bytes)` на трёх мегабайтах переполняет стек аргументов - и
 * падает не всегда, а начиная с какого-то размера записи, то есть у одного человека из десяти. */
function toBase64(bytes: Uint8Array): string {
  let said = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    said += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(said);
}

export interface Dictation {
  supported: boolean;
  listening: boolean;
  /** Запись кончилась, ответа ещё нет. Только у серверного распознавателя - у браузерного такой паузы нет. */
  recognising: boolean;
  via: Via;
  setVia: (via: Via) => void;
  where: Where;
  lang: string;
  problem: string | null;
  /** Пока говорят: то, что уже распознано, но ещё может измениться. Не дописывается в цель. */
  interim: string;
  start: () => void;
  stop: () => void;
  /** Сменить язык. Пересчитывает и то, где распознавание может произойти. */
  setLang: (tag: string) => void;
  choices: string[];
  /** Скачать языковой пакет, чтобы уйти с сервера на устройство. */
  install: () => Promise<void>;
}

/* Что сказать про ошибку.
 *
 * `not-allowed` - самая частая и самая тупиковая: разрешение на микрофон отклонено, и повторное нажатие
 * не покажет запрос снова, потому что браузер его запомнил. Строка обязана назвать выход, а не событие. */
function inWords(code: string): string {
  if (code === 'not-allowed' || code === 'service-not-allowed') {
    return 'The microphone was refused. Allow it for this site in the address bar, then try again.';
  }
  if (code === 'no-speech') return 'Nothing was heard.';
  if (code === 'audio-capture') return 'No microphone was found.';
  if (code === 'network') return 'Recognition needs the network and could not reach it.';
  if (code === 'aborted') return '';
  return `Dictation stopped: ${code}.`;
}

/**
 * @param onText  Called with each FINAL piece. Interim text never arrives here - a goal that rewrote
 *                itself while somebody was still speaking would be unreadable to edit.
 */
export function useDictation(onText: (text: string) => void): Dictation {
  const Klass = Speech();
  /* «Авто» у браузерного распознавателя невозможно, и поправляется это ОДИН РАЗ при первом рендере, а не
   * при переключении: переключиться можно было и в прошлой сессии, а прочитано это будет в этой. */
  const [lang, setLangState] = useState(() => {
    const kept = dictationLang();
    return dictationVia() === 'browser' && kept === AUTO ? (navigator.language || 'en-US') : kept;
  });
  const [via, setViaState] = useState<Via>(dictationVia);
  const [listening, setListening] = useState(false);
  const [recognising, setRecognising] = useState(false);
  const [where, setWhere] = useState<Where>('unknown');
  const [problem, setProblem] = useState<string | null>(null);
  const [interim, setInterim] = useState('');
  const live = useRef<Recognition | null>(null);
  const tape = useRef<{ rec: MediaRecorder; stream: MediaStream } | null>(null);
  /* Колбэк в ref: распознавание живёт дольше рендера, и пересоздавать его из-за нового замыкания значило бы
   * обрывать человека на полуслове. */
  const sink = useRef(onText);
  sink.current = onText;

  /* Спрашивается один раз, до первого нажатия: строка про то, куда уйдёт звук, должна стоять на экране
   * ДО того, как микрофон включат, а не появляться задним числом. */
  useEffect(() => {
    /* Серверный путь ничего не спрашивает у браузера: он не зависит ни от языкового пакета, ни от
     * Web Speech вовсе. Известен сразу, и фраза про него стоит на экране до первого нажатия. */
    if (via === 'openai') { setWhere(recordType() ? 'openai' : 'no'); return; }
    if (!Klass) { setWhere('no'); return; }
    let gone = false;
    void (async () => {
      try {
        if (!Klass.available) { setWhere('a-server'); return; }
        const local = await Klass.available({ langs: [lang], processLocally: true, quality: 'dictation' });
        if (gone) return;
        if (local === 'available') { setWhere('on-this-computer'); return; }
        if (local === 'downloadable' || local === 'downloading') { setWhere('downloadable'); return; }
        const remote = await Klass.available({ langs: [lang], processLocally: false, quality: 'dictation' });
        if (gone) return;
        setWhere(remote === 'available' ? 'a-server' : 'no');
      } catch (_) {
        /* Спросить не вышло - значит и утверждать, что звук останется на машине, нельзя. */
        if (!gone) setWhere('a-server');
      }
    })();
    return () => { gone = true; };
  }, [Klass, lang, via]);

  const stop = useCallback(() => {
    if (tape.current) { tape.current.rec.stop(); return; }
    live.current?.stop();
  }, []);

  /* ЗАПИСАТЬ И ОТПРАВИТЬ. Ничего не возвращается, пока человек не остановит запись: у эндпоинта
   * транскрипции нет потока, и притворяться, что он есть, было бы интерфейсом, который врёт про паузу. */
  const startRecording = useCallback(async () => {
    const type = recordType();
    if (!type) { setProblem('This browser cannot record audio.'); return; }
    setProblem(null);
    setInterim('');

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (_) {
      /* Та же тупиковая ошибка, что у Web Speech, и тот же выход: повторное нажатие запроса не покажет.
       *
       * НО ВЫХОД РАЗНЫЙ, И ЭТО НАШЛОСЬ ЖИВЫМ ЗАПУСКОМ. В панели агента нет адресной строки, и совет
       * «разрешите для этого сайта в адресной строке» отправлял человека искать то, чего перед ним нет.
       * Там разрешение живёт в System Settings и принадлежит приложению, а не сайту. */
      setProblem(inPanel()
        ? 'The microphone was refused. Open System Settings → Privacy & Security → Microphone and switch '
          + 'on MouseFlow Agent, then try again.'
        : 'The microphone was refused. Allow it for this site in the address bar, then try again.');
      return;
    }

    const rec = new MediaRecorder(stream, { mimeType: type });
    const parts: Blob[] = [];
    rec.ondataavailable = (ev) => { if (ev.data && ev.data.size) parts.push(ev.data); };
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      tape.current = null;
      setListening(false);
      void (async () => {
        const blob = new Blob(parts, { type });
        /* Потолок проверяется ЗДЕСЬ ТОЖЕ, хотя маршрут проверит его снова: отправить три мегабайта, чтобы
         * узнать, что их не берут, - это ожидание, оплаченное каналом человека. Число одно, из
         * api/_transcribe.mjs. */
        const refused = refusedAudio({ bytes: blob.size, type });
        if (refused) { setProblem(refused); return; }
        if (!blob.size) { setProblem('Nothing was recorded.'); return; }
        setRecognising(true);
        try {
          const res = await fetch('/api/transcribe', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json', ...asPanel() },
            body: JSON.stringify({
              audio: toBase64(new Uint8Array(await blob.arrayBuffer())),
              type,
              /* Пусто - значит «определи сам». Отправить 'auto' строкой значило бы отправить язык с
               * таким кодом, которого нет. */
              ...(lang === AUTO ? {} : { language: lang.split('-')[0] }),
            }),
          });
          const body = await res.json().catch(() => null);
          if (!res.ok) {
            /* Своими словами маршрута: он знает, почему отказал - нет ключа, не названа модель, потолок, -
             * а эта страница не знает ничего. */
            setProblem(String(body?.error?.message || `Recognition failed (HTTP ${res.status}).`));
            return;
          }
          const text = String(body?.text || '');
          if (!text) { setProblem(String(body?.said || 'Nothing was heard.')); return; }
          sink.current(text);
        } catch (err) {
          setProblem(`Recognition could not reach the server: ${err instanceof Error ? err.message : 'unknown'}`);
        } finally {
          setRecognising(false);
        }
      })();
    };

    try {
      rec.start();
      tape.current = { rec, stream };
      setListening(true);
    } catch (_) {
      stream.getTracks().forEach((t) => t.stop());
      setProblem('The recording could not be started.');
    }
  }, [lang]);

  const start = useCallback(() => {
    if (via === 'openai') { void startRecording(); return; }
    if (!Klass || live.current) return;
    setProblem(null);
    setInterim('');

    const rec = new Klass();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    /* Только когда мы ПРОВЕРИЛИ, что язык есть на устройстве. Ставить это вслепую - значит получить отказ
     * там, где сервер сработал бы, и человек услышит «не работает» вместо текста. */
    if (where === 'on-this-computer') rec.processLocally = true;

    rec.onresult = (event) => {
      let pending = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? '';
        if (result.isFinal) sink.current(text);
        else pending += text;
      }
      setInterim(pending);
    };
    rec.onerror = (event) => {
      const said = inWords(event.error);
      if (said) setProblem(said);
    };
    rec.onend = () => {
      live.current = null;
      setListening(false);
      setInterim('');
    };

    try {
      rec.start();
      live.current = rec;
      setListening(true);
    } catch (_) {
      /* start() на уже запущенном экземпляре бросает; состояние тогда врёт, если его не сбросить. */
      live.current = null;
      setListening(false);
    }
  }, [Klass, lang, where, via, startRecording]);

  /* Смена языка ОСТАНАВЛИВАЕТ диктовку: распознавание уже запущено с прежним языком, и молча оставить его
   * работать значило бы, что переключатель показывает одно, а слушает другое. */
  const setLang = useCallback((tag: string) => {
    live.current?.abort();
    live.current = null;
    setListening(false);
    setInterim('');
    setProblem(null);
    setWhere('unknown');
    rememberDictationLang(tag);
    setLangState(tag);
  }, []);

  /* Переключатель ОСТАНАВЛИВАЕТ то, что идёт: распознаватель уже запущен, и оставить его работать значило
   * бы, что надпись показывает одно, а слушает другое, - ровно тот же довод, что у смены языка. */
  const setVia = useCallback((next: Via) => {
    /* Браузерному распознавателю «авто» не годится - Web Speech без языка не работает. Подставляется
     * язык браузера, а не молчаливый английский: молчаливый английский - это та самая ошибка, из-за
     * которой язык вообще стал выбором (см. dictationLang). */
    if (next === 'browser' && dictationLang() === AUTO) {
      const fallback = navigator.language || 'en-US';
      rememberDictationLang(fallback);
      setLangState(fallback);
    }
    live.current?.abort();
    live.current = null;
    if (tape.current) {
      tape.current.stream.getTracks().forEach((t) => t.stop());
      try { tape.current.rec.stop(); } catch (_) { /* уже остановлен */ }
      tape.current = null;
    }
    setListening(false);
    setRecognising(false);
    setInterim('');
    setProblem(null);
    setWhere('unknown');
    rememberDictationVia(next);
    setViaState(next);
  }, []);

  const install = useCallback(async () => {
    if (!Klass?.install) return;
    setProblem(null);
    try {
      const ok = await Klass.install({ langs: [lang], processLocally: true });
      setWhere(ok ? 'on-this-computer' : 'a-server');
    } catch (_) {
      setProblem('The language pack could not be downloaded.');
    }
  }, [Klass, lang]);

  /* Микрофон не должен пережить экран, с которого его включили - ни один из двух. Работающий MediaRecorder
   * держит красную точку в заголовке вкладки и живой поток с устройства; уйти со страницы и оставить его
   * было бы худшим, что этот файл может сделать. */
  useEffect(() => () => {
    live.current?.abort();
    live.current = null;
    if (tape.current) {
      tape.current.stream.getTracks().forEach((t) => t.stop());
      try { tape.current.rec.stop(); } catch (_) { /* уже остановлен */ }
      tape.current = null;
    }
  }, []);

  return {
    supported: via === 'openai' ? where !== 'no' : (!!Klass && where !== 'no'),
    listening, recognising, via, setVia, where, lang, problem, interim, start, stop, install,
    setLang, choices: dictationChoices(lang, via),
  };
}
