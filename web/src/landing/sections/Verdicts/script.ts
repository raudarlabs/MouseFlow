/* 02's SCRIPT - the same test, "Invoice total is right" on qa-vm-1, on three nights, as the run view in Logs
 * writes them: its steps with their times, its three checks with their outcome and evidence, the verdict the
 * machine computed, the kept frame, and one sentence on what that colour means.
 *
 * TIME. One one-shot timeline plays the three nights in order and stops on Wednesday's red. Each night is two
 * acts: its PLAY (the sheet's lines tick in, the checks spin and resolve, the verdict lands) and its DWELL
 * (5s to read it, while a hairline under its tab fills; then the next night). Splitting them matters: a demo
 * that is interrupted resumes from the start of its current act, so a pause while somebody reads Monday
 * restarts only the hairline - it never replays Monday's lines under them. Wednesday has no dwell: the cycle
 * ends on it. Every time below is relative to its night's start; `at()` makes it absolute.
 *
 * The lines arrive in the run's real order - three steps, check 1, Save, checks 2 and 3 - so the two columns
 * tick against each other the way a run does. Steps are 140ms apart; a check's spinner turns for 700ms before
 * it resolves, and the next check starts 500ms after the one before.
 */
import { BILLING, type Rect } from '../kit';

export const DWELL = 5000;

export type NightKind = 'pass' | 'grey' | 'fail';

export interface StepDef {
  time: string;
  text: string;
  at: number;
  tone?: 'muted';
}

export interface CheckDef {
  n: number;
  statement: string;
  outcome: 'pass' | 'fail' | 'notmade';
  evidence?: string;
  proves?: string;
  /** Arrives (with its spinner, unless it was never made). */
  at: number;
  /** Resolves to its outcome. */
  resolveAt?: number;
}

export interface NightDef {
  i: number;
  day: string;
  dayLong: string;
  kind: NightKind;
  /** The verdict in the product's words. */
  verdict: 'passed' | 'no verdict' | 'failed a check';
  /** The night's first act starts here (absolute ms). */
  start: number;
  /** Length of its play act; its dwell (if any) follows. */
  play: number;
  steps: StepDef[];
  checks: CheckDef[];
  /** Wednesday's line between check 1 and the rest. */
  goesOn?: number;
  /** When "running" in the sheet's head turns into the Logs chips. */
  logsAt: number;
  logs: { kind: 'pass' | 'fail' | 'grey'; text: string }[];
  verdictAt: number;
  counts: string;
  frameAt: number;
  frame: { status: NightKind; label: string; lens: Rect; total?: string; signIn?: boolean; toast: boolean; says: string };
  meaningAt: number;
  meaning: [string, string];
}

/* The four steps every night starts with. */
const BASE_STEPS = (save: number): StepDef[] => [
  { time: '02:00:04', text: 'Switch to Billing', at: 240 },
  { time: '02:00:09', text: 'Click “New invoice”', at: 380 },
  { time: '02:00:15', text: 'Type ACME, 4, 310', at: 520 },
  { time: '02:00:26', text: 'Click “Save”', at: save },
];

/* A run that got to its end says so in its own words - Wednesday's too: the agent finished its job. */
const FINISH = { time: '02:00:34', text: 'Finish — “Created the ACME invoice and saved it.”' };

const TOTAL = '“Total” holds 1,240.00';
const SAVED = '“Invoice saved” is there';
const NO_ERROR = '“Error” is not there';

const MON_PLAY = 3700;
const TUE_PLAY = 3300;
const WED_PLAY = 3900;

const MON = 0;
const TUE = MON + MON_PLAY + DWELL;
const WED = TUE + TUE_PLAY + DWELL;

export const NIGHTS: NightDef[] = [
  {
    i: 0,
    day: 'Mon',
    dayLong: 'Monday',
    kind: 'pass',
    verdict: 'passed',
    start: MON,
    play: MON_PLAY,
    steps: [...BASE_STEPS(1560), { ...FINISH, at: 2960 }],
    checks: [
      { n: 1, statement: TOTAL, outcome: 'pass', evidence: 'Edit “Total” = “1,240.00”', at: 700, resolveAt: 1400 },
      { n: 2, statement: SAVED, outcome: 'pass', evidence: 'caught at its moment', at: 1720, resolveAt: 2420 },
      { n: 3, statement: NO_ERROR, outcome: 'pass', at: 2220, resolveAt: 2920 },
    ],
    logsAt: 3000,
    logs: [{ kind: 'pass', text: 'ok' }],
    verdictAt: 3060,
    counts: '3 held · 0 did not · 0 could not be checked',
    frameAt: 3260,
    frame: { status: 'pass', label: 'what it proved', lens: BILLING.total, toast: true, says: '“Total” read as 1,240.00' },
    meaningAt: 3460,
    meaning: ['The only green.', 'Every check held, with evidence.'],
  },
  {
    i: 1,
    day: 'Tue',
    dayLong: 'Tuesday',
    kind: 'grey',
    verdict: 'no verdict',
    start: TUE,
    play: TUE_PLAY,
    steps: [
      ...BASE_STEPS(1560),
      { time: '02:00:29', text: 'Billing asks to sign in. It never types a password, so it hands that part back', at: 1900, tone: 'muted' },
      { time: '02:00:30', text: 'Finish — could not finish: “Billing asks to sign in before it can save.”', at: 2240, tone: 'muted' },
    ],
    checks: [
      { n: 1, statement: TOTAL, outcome: 'pass', evidence: 'Edit “Total” = “1,240.00”', at: 700, resolveAt: 1400 },
      { n: 2, statement: SAVED, outcome: 'notmade', at: 2380 },
      { n: 3, statement: NO_ERROR, outcome: 'notmade', at: 2450 },
    ],
    logsAt: 2380,
    logs: [{ kind: 'grey', text: 'could not finish' }],
    verdictAt: 2660,
    counts: 'could not finish · 1 held · 2 not made',
    frameAt: 2860,
    frame: { status: 'grey', label: 'where it failed', lens: BILLING.signIn, signIn: true, toast: false, says: 'Billing’s sign-in, password left empty' },
    meaningAt: 3060,
    meaning: ['Grey: nothing proven either way.', 'It isn’t painted red, so the real reds stay visible.'],
  },
  {
    i: 2,
    day: 'Wed',
    dayLong: 'Wednesday',
    kind: 'fail',
    verdict: 'failed a check',
    start: WED,
    play: WED_PLAY,
    steps: [...BASE_STEPS(1780), { ...FINISH, at: 3180 }],
    checks: [
      {
        n: 1,
        statement: TOTAL,
        outcome: 'fail',
        evidence: '“Total” holds “1,204.00”, which is not “1,240.00”',
        proves: 'the total is hours × rate',
        at: 700,
        resolveAt: 1400,
      },
      { n: 2, statement: SAVED, outcome: 'pass', evidence: 'caught at its moment', at: 1940, resolveAt: 2640 },
      { n: 3, statement: NO_ERROR, outcome: 'pass', at: 2440, resolveAt: 3140 },
    ],
    goesOn: 1640,
    logsAt: 3220,
    logs: [
      { kind: 'pass', text: 'ok' },
      { kind: 'fail', text: '1 check failed' },
    ],
    verdictAt: 3280,
    counts: '2 held · 1 did not',
    frameAt: 3480,
    frame: { status: 'fail', label: 'where it failed', lens: BILLING.total, total: '1,204.00', toast: true, says: '“Total” read as 1,204.00' },
    meaningAt: 3680,
    meaning: ['Red: your product broke, not the bot.', 'The agent finished its job and found a defect.'],
  },
];

/** Monday play · Monday dwell · Tuesday play · Tuesday dwell · Wednesday play. Night n is act 2n. */
export const ACTS = [MON, MON + MON_PLAY, TUE, TUE + TUE_PLAY, WED];

/** The cycle: Wednesday's play and a short rest, then it ends on the red. */
export const DURATION = WED + WED_PLAY + 400;

/** The night an act belongs to. */
export const nightOf = (act: number) => Math.min(NIGHTS.length - 1, act >> 1);

/** A night-relative time, made absolute. */
export const at = (night: NightDef, ms: number) => night.start + ms;

/** Ten nights, oldest first: seven green, then the three this section plays. */
export const OLDER = 7;
