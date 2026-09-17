/* Types for the browser half. The module itself is dependency-free JavaScript owned by extension/, exactly
 * like _expect.mjs's checksOf and _memory.mjs's fitBlock; this file exists so the web build can type it. */

export const STEPS_MAX: number;

export interface ProcedureStep {
  n: number;
  said: string;
  selector?: string;
  param?: string;
}

export interface Procedure {
  whenToUse: string | null;
  steps: ProcedureStep[];
  /** Empty until the application memory fills it — MEMORY-PLAN §4. Never invented here. */
  pitfalls: { said: string }[];
  /** Empty until an author or a case fills it, in the `expects` shape from `api/_case.mjs`. */
  verification: Record<string, string>[];
}

export function procedureFrom(
  events: unknown[],
  meta?: { origins?: string[]; params?: { selector?: string; name?: string }[] },
): Procedure;

/** For a skill that was written rather than recorded: its own kept steps, mapped into the artifact's shape. */
export function procedureFromSteps(
  said: { name?: string; input?: string | null }[],
  meta?: { origins?: string[] },
): Procedure | null;

export function hasProcedure(procedure: unknown): boolean;
export function stepsSaid(procedure: unknown): string[];
