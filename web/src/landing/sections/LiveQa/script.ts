/* 01's SCRIPT - when everything in the demo happens, in ms on its one 13.2s loop. The words live in
 * LiveQa.tsx; this file is only the clock, so the screen (Desk.tsx), the side pane and the bar can never
 * disagree about the moment the bee clicks "Save" or the check that reads it resolves.
 *
 * Three acts, the spec's: WRITE 0-4.0s (the test is written at 17:40), RUN 4.0-9.6s (02:00, the agent drives
 * the Billing app on qa-vm-1 by itself), JUDGE 9.6-13.2s (the machine's verdict, then a rest). The cursor
 * glides for 560ms (--m-slow), so every click below lands 560ms after the cursor sets off; a log line
 * arrives when its step starts and its spinner turns into a tick when the next one starts.
 */
import { typeDuration } from '../kit';

export const DURATION = 13200;
export const ACTS = [0, 4000, 9600];
export const GLIDE = 560;

export const GOAL = 'In Billing, create an invoice for ACME — 4 hours at 310 — and save it.';

/** Act 1 · Write */
export const W = {
  goal: 200,
  /** Each input chip pops 60ms after the one before. */
  inputs: 200 + typeDuration(GOAL, 'person') + 40,
  /** Check rows rise; "What it proves" +120ms, the When? chip +240ms. */
  checks: [2000, 2500, 3000],
  nightly: 3500,
  nextRun: 3620,
  /** The clock rolls to 02:00:00 and night falls on the screen. */
  night: 3800,
};

/** Act 2 · Run */
export const R = {
  start: 4000,
  /** The cursor appears where the mouse was left, then sets off for "New invoice". */
  cursorIn: 4450,
  toNew: 4600,
  form: 4600 + GLIDE + 90,
  toCustomer: 5500,
  /** Focus moves field to field with Tab: one aimed click, then typing - one turn, as the agent does it. */
  customer: { focus: 5500 + GLIDE, type: 5500 + GLIDE + 40, blur: 6480 },
  hours: { focus: 6480, type: 6520, blur: 6880 },
  rate: { focus: 6880, type: 6920, blur: 7300 },
  total: 7300,
  check1: { at: 7400, resolve: 7900, out: 8250 },
  toSave: 7950,
  toast: { at: 7950 + GLIDE + 50, out: 9150 },
  check2: { at: 7950 + GLIDE + 50, lens: 8600, resolve: 8900, out: 9150 },
  check3: { at: 9150, resolve: 9400 },
  finish: 9400,
  cursorAway: 9000,
  cursorOut: 9500,
  ok: 9450,
};

/** Act 3 · Judge */
export const J = {
  start: 9600,
  shutter: 9650,
  /** The kept frame leaves the screen for the chip (520ms), and the chip's thumbnail takes over as it lands. */
  flight: 9700,
  flightMs: 520,
  verdict: 9760,
  evidence: [9960, 10080, 10200],
  kept: 10200,
  night: 11000,
  line: 11240,
};

/** The bar's clock: 17:40 while the test is written, then the time of each log line as it arrives. Padded
    on the left so the columns line up with 02:00:00 and only the digits that change roll. */
export const CLOCK = [
  { at: 0, v: '   17:40' },
  { at: W.night, v: '02:00:00' },
  { at: 4350, v: '02:00:04' },
  { at: R.toNew, v: '02:00:09' },
  { at: R.toCustomer, v: '02:00:15' },
  { at: R.check1.at, v: '02:00:21' },
  { at: R.toSave, v: '02:00:26' },
  { at: R.check2.at, v: '02:00:27' },
  { at: R.check3.at, v: '02:00:31' },
  { at: R.finish, v: '02:00:34' },
];
