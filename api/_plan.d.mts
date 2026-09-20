/* Types for the browser half: web/src/lib/plan.ts keeps the fetch and imports the request and the parse
 * from here, the way web/src/features/create/attach.ts imports GOAL_MAX from _brain.mjs. */

export const CHECKPOINTS_MAX: number;
export const PLAN_MAX_TOKENS: number;
export const PLAN_SYSTEM: string;
export const OUTLINE_TOOL: Record<string, unknown>;

export interface Checkpoint {
  title: string;
  detail: string;
}

export interface Plan {
  /** Короткое имя того, что будет сделано. Не цель дословно: цель - предложение, это - заголовок. */
  title: string;
  checkpoints: Checkpoint[];
}

export function planRequest(ask: {
  goal: string;
  where: 'desktop' | 'browser' | 'messenger';
  screen?: { png: string; format: string } | null;
}): {
  max_tokens: number;
  system: string;
  tools: Record<string, unknown>[];
  tool_choice: { type: 'tool'; name: string };
  messages: { role: string; content: unknown[] }[];
};

export function planFrom(body: { content?: unknown } | null, goal?: string): { plan?: Plan; error?: string };
