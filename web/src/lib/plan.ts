/* Что модель СОБИРАЕТСЯ сделать — до того, как она начнёт делать это на настоящей машине.
 *
 * ЧТО ЭТО НЕ ТАКОЕ, и это важнее всего остального в файле. Цикл в desktop-engine.ts реактивный: он смотрит
 * на скриншот, выбирает одно действие, делает его и смотрит снова. Плана у него нет и он его не получает -
 * этот вызов происходит ДО цикла, отдельно, и цикл о нём никогда не узнаёт.
 *
 * Поэтому то, что здесь возвращается, - заявление о намерении, а не сценарий. Прогон может пойти иначе, и
 * интерфейс обязан говорить это теми же словами: чекпоинты с номерами, притворяющиеся программой, - худший
 * вид полировки, потому что выглядят как гарантия и ею не являются.
 *
 * Зачем тогда вообще. Он ловит самый дорогой класс ошибок - непонимание. Вы читаете «открыть Chrome и войти»
 * и понимаете, что вас поняли не так, ДО того как что-то нажато на вашей машине. Ровно это и стоит одного
 * лишнего вызова модели.
 *
 * ЧТО ОТСЮДА УЕХАЛО И ПОЧЕМУ. Промпт, схема инструмента `outline` и разбор ответа лежат в api/_plan.mjs:
 * у плана появился второй зритель - мессенджер строит его на сервере, до постановки в очередь
 * (SPLIT-PLAN §7.2, шаг 14a), а серверная функция не может импортировать веб-приложение. Здесь остались
 * fetch и слова отказов: у страницы своя дверь (кука на /api/claude) и свой способ объяснить её ошибку.
 *
 * СТРУКТУРА через инструмент, а не через «ответь JSON». Прокси уже пробрасывает `tools` и `tool_choice`
 * (api/claude.js), а модель, которой велено вызвать инструмент, отдаёт валидный объект по схеме - в отличие
 * от модели, которую попросили «вернуть JSON» и которая обернёт его в три абзаца вежливости.
 */
import { planFrom, planRequest } from '../../../api/_plan.mjs';
import { planModel } from './model-config';
/* Панель предъявляет аккаунт токеном устройства, а не кукой: у WKWebView своё хранилище кук. Пусто во
 * всякой обычной вкладке - см. web/src/lib/panel-auth.ts. */
import { asPanel } from './panel-auth';

/* Тип плана - оттуда же, откуда промпт: страница и вебхук обязаны показывать одну и ту же форму.
 * Реэкспортом, потому что его импортируют из этого файла с тех пор, как он здесь появился. */
import type { Plan } from '../../../api/_plan.mjs';

export type { Checkpoint, Plan } from '../../../api/_plan.mjs';

const MODEL = 'claude-opus-5'; // the fallback; the configured choice comes from model-config
const TIMEOUT_MS = 45_000;

const clip = (value: unknown, max: number) =>
  String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);

export async function askForPlan(
  goal: string,
  where: 'desktop' | 'browser',
  /** Скриншот, если он есть и человек попросил учитывать текущий экран. base64 без префикса. */
  screen?: { png: string; format: string } | null,
): Promise<{ plan?: Plan; error?: string }> {
  const cutoff = new AbortController();
  const timer = setTimeout(() => cutoff.abort(), TIMEOUT_MS);

  const ask = planRequest({ goal, where, screen });

  let res: Response;
  let text: string;
  try {
    res = await fetch('/api/claude', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', ...asPanel() },
      signal: cutoff.signal,
      body: JSON.stringify({
        model: await planModel().catch(() => MODEL),
        ...ask,
      }),
    });
    text = await res.text();
  } catch (err) {
    clearTimeout(timer);
    return {
      error: (err as { name?: string } | null)?.name === 'AbortError'
        ? 'the plan took too long to come back'
        : 'the plan could not reach the server',
    };
  }
  clearTimeout(timer);

  if (!res.ok) {
    /* Своими словами прокси, если он их сказал: он знает, почему отказал (нет ключа, слишком большой
     * запрос), а эта страница - нет. */
    let said = '';
    try {
      said = clip(JSON.parse(text)?.error?.message, 200);
    } catch (_) {
      said = clip(text, 200);
    }
    return { error: said || `the model refused with HTTP ${res.status}` };
  }

  let body: { content?: unknown } | null = null;
  try {
    body = JSON.parse(text);
  } catch (_) {
    return { error: 'the model answered with something that is not JSON' };
  }

  return planFrom(body, goal);
}
