/* LINES - what a run says, as the server writes it: log lines with their times, steps, checks with their
 * evidence, and the verdict. Every demo on the page speaks through these, so a check reads the same in
 * 01's theater, 02's console and 06's deck.
 *
 * Each line can play: pass `at` (ms on the surrounding timeline) and the line arrives then; a check's
 * `resolveAt` is when its pending spinner turns into its outcome. Without them - and in every poster - the
 * line is simply there, finished. The words are real text; marks and spinners are aria-hidden.
 */
import type { ReactNode } from 'react';
import { cn } from '@insightis/ui/cn';
import { cue } from '../../motion';
import { StatusChip, TierTag, type Tier } from './status';

/** The hex spinner: a hexagon whose bright arc goes round. Shown only mid-demo (it is transient). */
export function HexSpinner({ className, at, out }: { className?: string; at?: number; out?: number }) {
  return (
    <svg
      className={cn('hl-spin', className)}
      viewBox="0 0 12 12"
      aria-hidden="true"
      focusable="false"
      {...(at !== undefined ? cue(at, 'none', out) : {})}
    >
      <polygon points="6,1 10.33,3.5 10.33,8.5 6,11 1.67,8.5 1.67,3.5" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.2" />
      <path d="M6 1 10.33 3.5 10.33 8.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A small tick (or a cross for a failure). */
export function Tick({ fail, className }: { fail?: boolean; className?: string }) {
  return (
    <svg className={cn('hl-mark-tick', className)} viewBox="0 0 10 10" aria-hidden="true" focusable="false">
      {fail ? (
        <path d="M2.5 2.5 7.5 7.5M7.5 2.5 2.5 7.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      ) : (
        <path d="m2 5.3 2 2 4-4.6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

export type LineMark = 'tick' | 'pass' | 'fail' | 'none';

export interface LogLineProps {
  /** "02:00:04" - mono, tabular, in its own 62px column. */
  time?: string;
  /** The finished mark. Default tick (ice). */
  mark?: LineMark;
  /** When the line arrives (ms). */
  at?: number;
  /** When its action completes: a spinner turns until then, then the mark crossfades in. */
  doneAt?: number;
  className?: string;
  children: ReactNode;
}

/** One line of a run's log: time · mark · what happened. Rendered as an <li> - put it in <Lines>. */
export function LogLine({ time, mark = 'tick', at, doneAt, className, children }: LogLineProps) {
  return (
    <li className={cn('hl-log', className)} {...(at !== undefined ? cue(at, 'rise') : {})}>
      <span className="hl-log-t">{time}</span>
      <span className={cn('hl-mark', `hl-mark--${mark}`)} aria-hidden="true">
        {doneAt !== undefined && <HexSpinner className="hl-transient" at={at ?? 0} out={doneAt} />}
        {mark !== 'none' && (doneAt !== undefined ? <span {...cue(doneAt, 'fade')}><Tick fail={mark === 'fail'} /></span> : <Tick fail={mark === 'fail'} />)}
      </span>
      <span className="hl-log-x">{children}</span>
    </li>
  );
}

/** The list a run's lines live in. */
export function Lines({ className, children, label }: { className?: string; children: ReactNode; label?: string }) {
  return (
    <ol className={cn('hl-lines', className)} aria-label={label}>
      {children}
    </ol>
  );
}

export interface StepLineProps {
  time?: string;
  /** The glyph before the step. Default "›". */
  mark?: ReactNode;
  tone?: 'ice' | 'fail' | 'muted';
  at?: number;
  className?: string;
  children: ReactNode;
}

/** A step in words, with an optional time on the right: "Click “Save”   02:00:26". An <li>. */
export function StepLine({ time, mark = '›', tone = 'ice', at, className, children }: StepLineProps) {
  return (
    <li className={cn('hl-step', tone !== 'ice' && `hl-step--${tone}`, className)} {...(at !== undefined ? cue(at, 'rise') : {})}>
      <span className="hl-step-mark" aria-hidden="true">
        {mark}
      </span>
      <span>{children}</span>
      {time && <span className="hl-step-t">{time}</span>}
    </li>
  );
}

export type Outcome = 'pass' | 'fail' | 'cannot' | 'notmade';

const OUTCOME_WORD: Record<Outcome, string> = { pass: 'PASS', fail: 'FAIL', cannot: 'CANNOT CHECK', notmade: 'not made' };
const OUTCOME_KIND = { pass: 'pass', fail: 'fail', cannot: 'cannot', notmade: 'grey' } as const;

export interface CheckLineProps {
  /** The check's number badge. */
  n: number;
  /** The statement: "“Total” holds 1,240.00". */
  statement: ReactNode;
  outcome: Outcome;
  tier?: Tier;
  /** A mono chip before the statement: "value is" · "present" · "absent". */
  kind?: string;
  /** What was actually there, mono under the statement: "Edit “Total” = “1,240.00”". Red for a FAIL. */
  evidence?: ReactNode;
  /** "What it proves" - the sentence the check stands for, in italics. */
  proves?: ReactNode;
  /** Anything else under it (a When? chip). */
  extra?: ReactNode;
  /** When the line arrives (ms). */
  at?: number;
  /** When the check resolves: a spinner until then, then the outcome pops and the status bar lights. */
  resolveAt?: number;
  className?: string;
}

/** A check: number + statement + outcome + tier, then evidence and what it proves, with a 2px status bar on
    the left. The outcome is the product's word: PASS, FAIL, CANNOT CHECK or not made. An <li>. */
export function CheckLine({ n, statement, outcome, tier, kind, evidence, proves, extra, at, resolveAt, className }: CheckLineProps) {
  const resolving = resolveAt !== undefined;
  return (
    <li className={cn('hl-check', `hl-check--${outcome}`, className)} {...(at !== undefined ? cue(at, 'rise') : {})}>
      <i className="hl-check-bar" aria-hidden="true" {...(resolving ? cue(resolveAt, 'fade') : {})} />
      <div className="hl-check-head">
        <span className="hl-check-n">
          <span className="sr-only">Check </span>
          {n}
        </span>
        <span className="hl-check-s">
          {kind && <span className="hl-check-kind">{kind}</span>}
          {statement}
        </span>
        <span className="hl-check-tags">
          <span className="hl-outcome">
            {resolving && (
              <span className="hl-outcome-wait hl-transient" aria-hidden="true" {...cue(at ?? 0, 'none', resolveAt)}>
                <HexSpinner />
              </span>
            )}
            <span {...(resolving ? cue(resolveAt, 'pop') : {})}>
              <StatusChip kind={OUTCOME_KIND[outcome]} size="sm">
                {OUTCOME_WORD[outcome]}
              </StatusChip>
            </span>
          </span>
          {tier && <TierTag tier={tier} />}
        </span>
      </div>
      {evidence && (
        <p className="hl-check-ev" {...(resolving ? cue(resolveAt, 'rise') : {})}>
          <span aria-hidden="true">↳ </span>
          {evidence}
        </p>
      )}
      {proves && <p className="hl-check-proves">{proves}</p>}
      {extra}
    </li>
  );
}

export interface VerdictBarProps {
  verdict: 'pass' | 'fail' | 'grey';
  /** The verdict in the product's words: "passed", "failed a check", "no verdict". */
  chip: ReactNode;
  at?: number;
  className?: string;
  /** The counts: "3 held · 0 did not · 0 could not be checked". */
  children?: ReactNode;
}

/** The verdict under a run: a 3px status edge, an 8% tint, the verdict chip and its counts. */
export function VerdictBar({ verdict, chip, at, className, children }: VerdictBarProps) {
  return (
    <div className={cn('hl-verdict', `hl-verdict--${verdict}`, className)} {...(at !== undefined ? cue(at, 'rise-lg') : {})}>
      <StatusChip kind={verdict} size="lg">
        {chip}
      </StatusChip>
      {children && <span className="hl-verdict-x">{children}</span>}
    </div>
  );
}
