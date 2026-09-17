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
