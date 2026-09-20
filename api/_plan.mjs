/* Что модель СОБИРАЕТСЯ сделать - один вызов до цикла, и теперь его читают двое.
 *
 * ПОЧЕМУ ЭТОТ ФАЙЛ ПОЯВИЛСЯ. Всё это жило в web/src/lib/plan.ts, где у плана был ровно один зритель -
 * страница Create. У мессенджера (SPLIT-PLAN §7.2, шаг 14a) план строится на СЕРВЕРЕ: вебхук получает
 * сообщение, показывает план кнопками и ставит работу в очередь только после «Approve». Серверная функция
 * не может импортировать веб-приложение, и написать там второй промпт значило бы иметь два «плана»: тот,
 * что видит страница, и тот, что видит телефон, - разошлись бы они молча и в ту сторону, куда никто не
 * смотрит. QA-ROADMAP §0, принцип 3.
 *
 * ЧТО ОСТАЛОСЬ В plan.ts: fetch и слова его отказов. Страница ходит на /api/claude с кукой, вебхук зовёт
 * callModel ключом сервера - это разные двери, и общее у них не дверь, а СОДЕРЖИМОЕ запроса и разбор
 * ответа. Ровно это здесь и лежит.
 *
 * ЧЕМ ЭТО НЕ ЯВЛЯЕТСЯ - тем же, чем и раньше: цикл реактивный, плана он не получает и о нём не узнаёт.
 * Это заявление о намерении, чтобы человек поймал непонимание ДО того, как что-то нажато на его машине.
 */
import { mediaType } from './_brain.mjs';

/** Немного. План - это то, что читают за пять секунд перед нажатием, а не документ. */
export const CHECKPOINTS_MAX = 6;

/** Хватает на шесть чекпоинтов с описаниями и не хватает на сочинение. */
export const PLAN_MAX_TOKENS = 900;

export const OUTLINE_TOOL = {
  name: 'outline',
  description: 'Say what you intend to do, before doing any of it.',
  input_schema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Four to eight words naming the task, as a person would refer to it later.',
      },
      checkpoints: {
        type: 'array',
        description: `Three to ${CHECKPOINTS_MAX} checkpoints, in order.`,
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Two to five words. What this stage achieves.' },
            detail: { type: 'string', description: 'One sentence on how, and what you will check.' },
          },
          required: ['title', 'detail'],
        },
      },
    },
    required: ['title', 'checkpoints'],
  },
};

export const PLAN_SYSTEM = `You are about to operate a real computer for someone, and you are showing them your intention first so they can correct you before anything happens.

Write the checkpoints you expect to pass through. Rules:
- Three to ${CHECKPOINTS_MAX}. Fewer than three is not a plan; more than six is a script, and you cannot know the screen that far ahead.
- Each one is a state you will have REACHED, not a keystroke. "The reply is drafted", not "click the reply button".
- Say what you will check before a one-way action - sending, submitting, deleting - because that is the checkpoint somebody wants to see.
- If the goal is ambiguous, do not resolve the ambiguity silently. Make the reading you intend explicit in a checkpoint, so it can be corrected.
- If the goal asks for something you must refuse - typing a password, an irreversible action it did not ask for - say so in a checkpoint instead of planning around it.
- You have not looked at the screen yet unless a picture is attached. Do not claim to know what is on it.`;

const clip = (value, max) => String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);

/* ГДЕ ЭТО ПОБЕЖИТ - фраза, а не флаг, потому что она едет модели и читается ею как условие.
 *
 * У мессенджера она своя и говорит то, чего не говорят две первые: ПИШУЩИЙ НЕ ВИДИТ ЭКРАНА. Модель,
 * думающая, что за ней смотрят, планирует «нажму, если выглядит правильно»; здесь смотреть некому, и это
 * меняет не вежливость плана, а его содержание - что именно вынести в чекпоинт до необратимого шага. */
const WHERE_SAID = {
  desktop: 'on the whole desktop of this machine',
  browser: 'in one tab of this browser',
  messenger: 'on the desktop of a machine the person asking is NOT looking at - they asked from a phone, '
    + 'and they will see only what you write down',
};

/**
 * Тело запроса за планом - всё, кроме `model`: его выбирает вызывающий, потому что у страницы он из
 * настроек аккаунта, а у вебхука из умолчания сервера.
 *
 * @param {{ goal: string, where: 'desktop'|'browser'|'messenger',
 *           screen?: { png: string, format: string } | null }} ask
 */
export function planRequest({ goal, where, screen = null }) {
  /* Картинка приезжает первой, потому что и в цикле она приезжает первой: модель, которой сначала дали
   * текст, отвечает на текст и смотрит на картинку как на подтверждение. */
  const content = [];
  if (screen && screen.png) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: mediaType(screen.format), data: screen.png },
    });
  }
  content.push({
    type: 'text',
    text: `${goal}\n\nThis will run ${WHERE_SAID[where] || WHERE_SAID.desktop}.${
      screen && screen.png ? ' The picture above is what is on screen right now.' : ''}`,
  });
  return {
    max_tokens: PLAN_MAX_TOKENS,
    system: PLAN_SYSTEM,
    tools: [OUTLINE_TOOL],
    /* Заставленный вызов. Без него модель иногда отвечает прозой, и разбирать прозу обратно в чекпоинты
     * значит угадывать - а угаданный план хуже отсутствующего. */
    tool_choice: { type: 'tool', name: 'outline' },
    messages: [{ role: 'user', content }],
  };
}


/**
 * План из ответа модели - или причина, по которой его нет.
 *
 * «Нет плана» никогда не должно молча превращаться в «запускаем без предупреждения»: решает вызывающий, а
 * не этот файл. Поэтому здесь возвращается `error` словами, и ни одна ветка не отдаёт пустой план.
 *
 * @param {{ content?: unknown } | null} body ответ модели, уже разобранный из JSON
 * @param {string} goal чтобы у плана был заголовок, даже если модель его не назвала
 */
export function planFrom(body, goal = '') {
  const blocks = body && Array.isArray(body.content) ? body.content : [];
  const call = blocks.find((b) => !!b && typeof b === 'object' && b.type === 'tool_use');
  const input = call && call.input && typeof call.input === 'object' ? call.input : null;
  if (!input) return { error: 'the model did not answer with a plan' };

  const checkpoints = (Array.isArray(input.checkpoints) ? input.checkpoints : [])
    .map((row) => ({
      title: clip(row && row.title, 60),
      detail: clip(row && row.detail, 220),
    }))
    /* Пустой чекпоинт - это строка, которую человек прочтёт как «шаг, о котором ничего не сказали».
     * Выбрасывается, а не показывается заглушкой. */
    .filter((row) => row.title || row.detail)
    .slice(0, CHECKPOINTS_MAX);

  if (!checkpoints.length) return { error: 'the plan came back empty' };
  return { plan: { title: clip(input.title, 80) || clip(goal, 80), checkpoints } };
}
