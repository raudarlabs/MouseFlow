/* Types for the browser half: web/src/features/create/attach.ts keeps the File reading and re-exports the
 * rest from here, so the string a goal is assembled into has one definition. */

export const GOAL_MAX: number;

export interface Attached {
  /** Собственный идентификатор: два файла могут называться одинаково. */
  id: string;
  name: string;
  /** Прочитанный текст, уже обрезанный по потолку. */
  text: string;
  /** Байты НА ДИСКЕ, до обрезки: человек должен видеть, что файл был больше. */
  bytes: number;
  /** Обрезали ли при чтении. */
  clipped: boolean;
}

/** Похоже ли это на текст. Смотрит на содержимое, а не на имя. */
export function looksLikeText(text: string): boolean;

export function blockOf(one: { name: string; text: string }): string;

export function goalWith(typed: string, files: Attached[]): string;

export function splitGoal(said: string): { typed: string; files: Attached[] };
