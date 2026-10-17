/* The shapes of 03's copy. The words themselves live in NightShift.tsx, as the section's typed constants;
 * the parts in this folder only draw them. */

/** A machine with its own lane on the night panel. */
export interface NightLane {
  name: string;
  platform: string;
  /** Whether it was taking work that night: online, or not listening at all. */
  status: 'online' | 'offline';
}

/** What happened to one scheduled run - a check's red, the only green, or a slot nobody was there for. */
export type NightResult = 'pass' | 'fail' | 'missed';

/** One run on the night panel. */
export interface NightBlock {
  id: string;
  /** Index into the lanes. */
  lane: number;
  /** When it was due, "02:00". */
  time: string;
  /** A missed run's window: due → the moment the machine was next heard from and it was recorded as missed. */
  until?: string;
  name: string;
  result: NightResult;
  /** The words on its chip: "failed a check" · "passed" · "missed". */
  tag: string;
  /** What the chip's word means, after a dash where there is room for it: "nothing was listening". */
  note?: string;
}

/** One night in a row of nights. A missed night adds no dot - see SkillRow.missed. */
export type NightDot = 'pass' | 'fail' | 'grey';

/** One row of the Skills list. */
export interface SkillRow {
  id: string;
  name: string;
  /** "test · qa-vm-1" - mono, under the name. */
  sub: string;
  /** Oldest first. */
  nights: NightDot[];
  /** Last night was missed: a dashed hex and a "missed" tag after the dots, and no dot added. */
  missed?: boolean;
  /** The opened detail line: its status chip and the rest of the sentence. */
  outcome: { kind: 'pass' | 'fail' | 'missed'; word: string };
  detail: string;
  /** What the dots say, for a screen reader. */
  summary: string;
}
