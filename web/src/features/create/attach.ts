/* Текстовые файлы, приложенные к цели — браузерная половина.
 *
 * ЧТО ЗДЕСЬ ОСТАЛОСЬ: чтение объекта File, счёт оставшихся знаков и размер словами. То есть то, у чего
 * есть браузер и нет сервера.
 *
 * ЧТО УЕХАЛО В api/_attach.mjs И ПОЧЕМУ: сборка цели (`goalWith`), её разбор обратно (`splitGoal`) и
 * проверка «похоже ли на текст». У приложенного появился второй источник - документ, присланный в чат
 * (SPLIT-PLAN §7.2, шаг 14a), - и цель с ним собирается на сервере. Две сборки одной строки разъехались
 * бы молча, а строка эта разбирается ОБРАТНО, когда прошлую задачу открывают заново: чип с именем файла
 * превратился бы в три экрана csv в композере. Одна реализация, много читателей.
 *
 * ЧТО ЭТО ТАКОЕ, ОДНОЙ ФРАЗОЙ: содержимое файла становится ЧАСТЬЮ ТОГО, О ЧЁМ ПОПРОСИЛИ, - ровно как если
 * бы человек вставил его в поле руками. Не отдельное поле, не вложение, которое куда-то «прилагается».
 *
 * ЧТО ЭТО СТОИТ, названо здесь, а не умолчано: цель с приложенным файлом уходит модели НА КАЖДОМ ШАГЕ,
 * потому что цель - это то, что модель читает каждый раз. Отсюда потолок, и он же - тот предел, который
 * путь очереди СОХРАНЯЕТ. Одно число на все места, которые его знают, и живёт оно в мозге
 * (api/_brain.mjs): раньше их было три, они совпадали, и совпадение держалось на комментарии.
 */
export { GOAL_MAX, goalWith, looksLikeText, splitGoal } from '../../../../api/_attach.mjs';
export type { Attached } from '../../../../api/_attach.mjs';

import { GOAL_MAX, goalWith, looksLikeText } from '../../../../api/_attach.mjs';
import type { Attached } from '../../../../api/_attach.mjs';

/** Один файл не читается дальше этого - смысла нет, в цель он всё равно не поместится. */
const READ_MAX = GOAL_MAX;

/** Столько файлов за раз. Больше - это уже не «приложить контекст», а «загрузить папку». */
export const FILES_MAX = 5;

/** Прочитать один файл. Отказ - строка с причиной, которую можно показать: молчаливый пропуск файла хуже. */
export async function readTextFile(file: File): Promise<{ one: Attached } | { error: string }> {
  let raw: string;
  try {
    raw = await file.text();
  } catch (e) {
    return { error: `${file.name} could not be read: ${e instanceof Error ? e.message : 'unknown error'}` };
  }
  if (!looksLikeText(raw)) {
    return {
      error: `${file.name} is not a text file — it looks binary. A .docx or a .pdf is a container, not text; `
        + 'export it as .txt or .md first.',
    };
  }
  const text = raw.slice(0, READ_MAX);
  return {
    one: {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name,
      text,
      bytes: file.size,
      clipped: raw.length > text.length,
    },
  };
}

/** Сколько знаков осталось до потолка. Отрицательное - перебор, и запускать нельзя. */
export const roomLeft = (typed: string, files: Attached[]): number =>
  GOAL_MAX - goalWith(typed, files).length;

/** Байты словами, для чипа рядом с именем файла. */
export const sizeSaid = (bytes: number): string =>
  (bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} kB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`);
