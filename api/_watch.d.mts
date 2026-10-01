/* Types for api/_watch.mjs. Change together. */
export const SILENT_MS: number;
export const AHEAD_MS: number;
export const CATCH_UP_MS: number;
export const MISSED_HORIZON_MS: number;
export function watchVerdicts(it: {
  schedules: { id: string; next_at: string | Date | null; paused?: boolean }[];
  seenMs: number | null;
  nowMs: number;
}): { id: string; kind: 'silent' | 'missed'; dueMs: number }[];
