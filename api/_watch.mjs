/* Сторож аккаунта: что сказать человеку о расписаниях, пока его машина молчит.
 *
 * ЗАЧЕМ (2026-10-01). Разовая задача на 04:30 не выполнилась, а узнал об этом владелец утром: часами
 * расписаний служит опрос агента (см. dueNow в api/_mcp-worker.mjs), и когда агент молчит, молчат и часы -
 * некому даже сказать «пропущено». Этот модуль - решение для часов, которые идут сами (api/watch.js по
 * крону): по расписаниям и по отметке «когда машина спрашивала работу» он говорит, что пора сказать.
 *
 * ДВА СЛУЧАЯ, И ОБА - ПРЕДУПРЕЖДЕНИЯ, А НЕ ДЕЙСТВИЯ. Ничего не помечается и не переносится: отметить
 * пропуск - дело такта расписаний, когда агент вернётся (там же, где решают «догнать или пропустить»).
 * Здесь только слова: «скоро, а машина молчит» и «прошло, а машина молчала».
 *
 * Чистая функция и без зависимостей, как _schedule.mjs: решение проверяется вычислением, а не чтением.
 */

/** Машина «молчит», если не спрашивала работу дольше этого. Агент спрашивает каждые три секунды. */
export const SILENT_MS = 10 * 60_000;
/** Насколько вперёд смотреть: за час до срока ещё можно открыть ноутбук. */
export const AHEAD_MS = 60 * 60_000;
/** Окно, в котором прогон ещё можно догнать - то же, что у такта расписаний (CATCH_UP_MS). */
export const CATCH_UP_MS = 30 * 60_000;
/** О пропуске старше суток уже не говорят: это не новость. */
export const MISSED_HORIZON_MS = 24 * 60 * 60_000;

/**
 * @param {{ schedules: { id: string, next_at: string|Date|null, paused?: boolean }[],
 *           seenMs: number|null, nowMs: number }} it
 * @returns {{ id: string, kind: 'silent'|'missed', dueMs: number }[]}
 */
export function watchVerdicts({ schedules, seenMs, nowMs }) {
  const out = [];
  const silentSince = (dueMs) => seenMs == null || seenMs < Math.min(nowMs, dueMs) - SILENT_MS;
  for (const one of Array.isArray(schedules) ? schedules : []) {
    if (!one || one.paused || !one.next_at) continue;
    const dueMs = new Date(one.next_at).getTime();
    if (!Number.isFinite(dueMs)) continue;
    /* СКОРО, А МАШИНА МОЛЧИТ. «Молчит» считается от сейчас: агент, спросивший минуту назад, жив. */
    if (dueMs >= nowMs && dueMs - nowMs <= AHEAD_MS) {
      if (seenMs == null || nowMs - seenMs > SILENT_MS) out.push({ id: one.id, kind: 'silent', dueMs });
      continue;
    }
    /* ПРОШЛО, ДОГОНЯТЬ ПОЗДНО, А МАШИНА МОЛЧАЛА В СРОК. Если бы агент спрашивал в окне догона, такт
     * расписаний запустил бы прогон и строка бы уже ушла дальше - так что «не ушла» плюс «молчал» и есть
     * пропуск. Спрашивал после срока - значит, такт уже сам всё решил и сказал. */
    const late = nowMs - dueMs;
    if (late > CATCH_UP_MS && late <= MISSED_HORIZON_MS && silentSince(dueMs + CATCH_UP_MS)) {
      out.push({ id: one.id, kind: 'missed', dueMs });
    }
  }
  return out;
}
