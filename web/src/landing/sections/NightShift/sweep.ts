/* WHEN THE MARKER PASSES - the night panel's one piece of arithmetic.
 *
 * The honey marker crosses the night in one move: a wrapper translated −100% → 0 over SWEEP_MS on the page's
 * --m-inout curve (cubic-bezier(.65, 0, .35, 1)). A block has to arrive exactly as the line reaches it, so
 * its cue time is the moment that curve passes the block's place - solved here rather than guessed, so a
 * block moved in the copy (or a row made taller on the phone) stays in step with the line by itself. The
 * same curve places the line itself (sweepAt), so the two can never drift apart.
 *
 * Pure arithmetic on constants: the server and the browser compute the same numbers, so the cue attributes
 * the server writes are the ones hydration expects.
 */

/** When the sweep starts on the section's timeline (after the panels have revealed) and how long it takes. */
export const SWEEP_AT = 600;
export const SWEEP_MS = 4200;

/* --m-inout, the curve motion.css gives every move between two places. */
const X1 = 0.65;
const Y1 = 0;
const X2 = 0.35;
const Y2 = 1;

const bez = (t: number, a: number, b: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;

/** The curve's progress at time fraction x (both 0-1). */
function progressAt(x: number): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (bez(m, X1, X2) < x) lo = m;
    else hi = m;
  }
  return bez((lo + hi) / 2, Y1, Y2);
}

/** The time fraction at which the curve has covered `progress` of the way. */
function timeFor(progress: number): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (progressAt(m) < progress) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}

/** Where the marker is at time `t` on the section's timeline: 0 where the night starts, 1 at 09:00. The
    night panel writes this into the sweep's transform on every frame of the shared clock, so the line is
    always where the cues think it is - through a pause, a resume from the start of the act, or a catch-up
    at RUSH speed - which a free-running CSS animation could not promise. */
export function sweepAt(t: number): number {
  if (t <= SWEEP_AT) return 0;
  if (t >= SWEEP_AT + SWEEP_MS) return 1;
  return progressAt((t - SWEEP_AT) / SWEEP_MS);
}

/** The ms on the section's timeline at which the marker reaches `f` (0 = where it starts, 1 = 09:00). */
export function passAt(f: number): number {
  return Math.round(SWEEP_AT + timeFor(Math.min(Math.max(f, 0), 1)) * SWEEP_MS);
}

/* The horizontal night (768 and up) runs 01:30 → 09:00 on a linear scale. */
const NIGHT_FROM = 90; // 01:30, in minutes after midnight
const NIGHT_SPAN = 450; // → 09:00

/** "02:04" → its place on the horizontal night, 0-1. */
export function nightX(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return ((h ?? 0) * 60 + (m ?? 0) - NIGHT_FROM) / NIGHT_SPAN;
}
