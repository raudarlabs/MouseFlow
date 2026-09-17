/* Тир 1 артефакта `mouseflow.skill/2` — процедура словами, и её вывод для обоих родов скилла.
 *
 * ЗДЕСЬ ТОЛЬКО РЕЭКСПОРТ. Сам вывод живёт в extension/procedure.js, потому что расширение загружается из
 * своей папки и импортировать что-либо выше неё не может ни в каком виде, - ровно тот же выбор и та же
 * причина, что у `checksOf` (api/_expect.mjs → extension/checks.js) и у `fitBlock` (api/_memory.mjs →
 * extension/memory.js). Одна реализация, много читателей.
 *
 * ЗАЧЕМ ТОГДА ЭТОТ ФАЙЛ. Чтобы веб-приложение могло читать ту же функцию, не импортируя extension/
 * напрямую: рядом лежит _procedure.d.mts, и только через него у сборки веба появляются типы. Веб →
 * api/_*.mjs (типизировано .d.mts) → extension/*.js - это цепочка, по которой сюда уже ходят flow-role и
 * skill-schema, и заводить для процедуры вторую значило бы иметь два способа добраться до одного файла.
 */

export { procedureFrom, procedureFromSteps, hasProcedure, stepsSaid, STEPS_MAX } from '../extension/procedure.js';

import { hasProcedure } from '../extension/procedure.js';

/* ------------------------------------------------- ЧЕКИ, КОТОРЫЕ ЖИВУТ НА СКИЛЛЕ (SPLIT-PLAN §4.1, шаг 1b)
 *
 * `procedure.verification` до сих пор было полем, которое никто не читает и никто не пишет. Шаг 1a дал
 * скиллу-цели процедуру - то есть месту наконец появилось где быть; здесь закрывается вторая половина:
 * кейс, построенный на скилле, БЕРЁТ его чеки, когда своих не передали, и ОТДАЁТ свои обратно.
 *
 * Круг, а не односторонняя труба: иначе первый автор кейса пишет чеки в пустоту, а второй начинает с
 * нуля - и человек, поставивший навык из галереи, получает документ, который говорит, что он делает, и
 * молчит о том, что считается сделанным.
 */

/** Чеки, записанные на скилле, или пустой список. Только чтение - судит их readExpects, как и всегда. */
export const checksOnSkill = (skill) => {
  const payload = skill && skill.payload && typeof skill.payload === 'object' ? skill.payload : {};
  const procedure = payload.procedure;
  const said = procedure && typeof procedure === 'object' ? procedure.verification : null;
  return Array.isArray(said) ? said : [];
};

/* ЧЬИ ЧЕКИ БЕРЁМ - решение, вынесенное из хендлера, чтобы его можно было ВЫПОЛНИТЬ.
 *
 * Пустой список считается «не дали» так же, как отсутствие поля: передать `[]` и получить отказ, когда на
 * скилле чеки лежат, - это два разных ответа на один вопрос. И семя возвращается СПИСКОМ, а не уже
 * разобранным: судит его тот же readExpects, что и написанное руками, - скилл с испорченным чеком
 * отвергается теми же словами. Один судья.
 */
export function seedFrom(given, skill) {
  const own = Array.isArray(given) ? given : [];
  if (own.length) return { list: given, seeded: false };
  const said = checksOnSkill(skill);
  return said.length ? { list: said, seeded: true } : { list: given, seeded: false };
}

/* Каким станет payload скилла, когда на нём сохранят эти чеки, - или null, если сохранять некуда.
 *
 * ТОЛЬКО КОГДА ПРОЦЕДУРА УЖЕ ЕСТЬ. Скилл, сохранённый до шага 1a, её не несёт, и завести её здесь значило
 * бы сочинить `steps` и `whenToUse`, которых никто не писал, - ровно то «второе мнение», от которого
 * extension/procedure.js отказывается вслух. Отсутствие - не ложь.
 */
export function procedureWith(payload, expects) {
  const had = payload && typeof payload === 'object' ? payload : null;
  if (!had || !hasProcedure(had.procedure)) return null;
  return { ...had, procedure: { ...had.procedure, verification: expects } };
}

