/* Время шага - одним правилом на все виды: живую ленту, прогон «by itself» и открытый прошлый прогон.
 *
 * Владелец, 2026-10-01: «время начала каждого шага и время его выполнения». Раньше рядом с шагом стояло
 * одно число - сколько модель решала, - и оно читалось как «сколько шаг занял», хотя действие на машине в
 * него не входило. Теперь: когда начался, сколько занял целиком, а разбивка - в подсказке.
 */
export interface StepClock {
  at?: number;
  ms?: { shot?: number; model?: number; act?: number } | null;
}

const secs = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

/** «09:12:03» - местное время начала, или null, если шаг его не записал (старые прогоны). */
export const startedAt = (step: StepClock): string | null => (Number.isFinite(step.at)
  ? new Date(step.at as number).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  : null);

/** Сколько шаг занял целиком - решение плюс действие; без действия - только решение. */
export const tookFor = (step: StepClock): string | null => {
  const model = Number(step.ms?.model) || 0;
  const act = Number(step.ms?.act) || 0;
  return model + act > 0 ? secs(model + act) : null;
};

/** Разбивка для подсказки: «decided in 1.9s · done in 0.8s · picture 0.3s». */
export const tookDetail = (step: StepClock): string => [
  step.ms?.model ? `decided in ${secs(step.ms.model)}` : null,
  step.ms?.act ? `done in ${secs(step.ms.act)}` : null,
  step.ms?.shot && step.ms.shot >= 100 ? `picture ${secs(step.ms.shot)}` : null,
].filter(Boolean).join(' · ');
