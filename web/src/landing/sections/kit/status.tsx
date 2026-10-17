/* THE STATUS LANGUAGE - one meaning per colour, everywhere on the page, in the product's own words.
 *
 *   pass     PASS · passed · ok · held             green on green/12%
 *   fail     FAIL · failed a check · did not hold   red on red/14%
 *   cannot   CANNOT CHECK                           attention, dashed outline - never a verdict
 *   grey     no verdict · not made · refused        ink-secondary on ice/10%
 *   missed   missed                                 a hollow dashed ring, no dot added
 *   live     running · driven                       honey, the one warm light
 *
 * A section never colours a status itself: it renders one of these, so "red" can only ever mean a check
 * that really did not hold.
 */
import type { ReactNode } from 'react';
import { cn } from '@insightis/ui/cn';

export type Status = 'pass' | 'fail' | 'cannot' | 'grey' | 'missed' | 'live';
/** Chip kinds: the statuses, plus the two tags that are not statuses (steel for IT, accent for QA/ice). */
export type ChipKind = Status | 'steel' | 'accent' | 'neutral';

export interface StatusChipProps {
  kind?: ChipKind;
  size?: 'sm' | 'md' | 'lg';
  /** Let a long label wrap instead of staying on one line. */
  wrap?: boolean;
  className?: string;
  children: ReactNode;
}

export function StatusChip({ kind = 'neutral', size = 'md', wrap, className, children }: StatusChipProps) {
  return (
    <span className={cn('hl-chip', kind !== 'neutral' && `hl-chip--${kind}`, size !== 'md' && `hl-chip--${size}`, wrap && 'hl-chip--wrap', className)}>
      {kind === 'live' && <i className="hl-live" aria-hidden="true" />}
      {children}
    </span>
  );
}

/** The product's three verdicts, and the colour each one is. */
export type Verdict = 'passed' | 'failed a check' | 'no verdict';

const VERDICT_KIND: Record<Verdict, Status> = { passed: 'pass', 'failed a check': 'fail', 'no verdict': 'grey' };

/** The big verdict chip ("passed"), with a faint inner glow of its own colour. */
export function VerdictChip({ verdict, className }: { verdict: Verdict; className?: string }) {
  return (
    <StatusChip kind={VERDICT_KIND[verdict]} size="lg" className={className}>
      {verdict}
    </StatusChip>
  );
}

export type Tier = 'dom' | 'tree' | 'picture';

/** Where a check's evidence came from: dom (the page, in Chrome) · tree (the accessibility tree) ·
    picture (the model's look - a note, never a green). */
export function TierTag({ tier, className }: { tier: Tier; className?: string }) {
  return <span className={cn('hl-tier', `hl-tier--${tier}`, className)}>{tier}</span>;
}

export type HexKind =
  | 'pass'
  | 'fail'
  | 'cannot'
  | 'grey'
  | 'missed'
  | 'live'
  | 'online'
  | 'offline'
  | 'paused'
  | 'ice'
  | 'steel'
  | 'honey'
  | 'empty';

/** A pointy-top hexagon in its status colour: a status glyph, a night, a bullet. Decorative - the text
    beside it, or an sr-only summary, carries the meaning. */
export function HexDot({ kind = 'ice', size = 10, className }: { kind?: HexKind; size?: number; className?: string }) {
  return (
    <svg
      className={cn('hl-hexdot', `hl-hexdot--${kind}`, className)}
      width={size}
      height={Math.round(size * 1.1547 * 100) / 100}
      viewBox="0 0 10 11.55"
      aria-hidden="true"
      focusable="false"
    >
      <polygon points="5,0.6 9.4,3.14 9.4,8.41 5,10.95 0.6,8.41 0.6,3.14" />
    </svg>
  );
}

/** The honey live / now dot. It breathes only with motion allowed. */
export function LiveDot({ className }: { className?: string }) {
  return <i className={cn('hl-live', className)} aria-hidden="true" />;
}

export type Night = 'pass' | 'fail' | 'grey' | 'missed' | 'empty' | 'honey';

export interface NightDotsProps {
  /** Oldest first. */
  nights: Night[];
  /** What the row says, for screen readers: "Last 10 nights: 8 passed, 1 no verdict, then failed a check." */
  summary: string;
  /** A visible mono label under the row ("Last 10 nights · oldest on the left"). */
  label?: ReactNode;
  size?: number;
  className?: string;
}

/** A row of nights: one hex per run, oldest on the left - the deck, the Skills list and 01's last line all
    speak it. The row is decorative; `summary` is what it means. */
export function NightDots({ nights, summary, label, size = 10, className }: NightDotsProps) {
  return (
    <div className={cn('hl-nights', className)}>
      <span className="sr-only">{summary}</span>
      <span className="hl-nights-row" aria-hidden="true">
        {nights.map((n, i) => (
          <HexDot key={i} kind={n} size={size} />
        ))}
      </span>
      {label && (
        <span className="hl-nights-label" aria-hidden="true">
          {label}
        </span>
      )}
    </div>
  );
}
