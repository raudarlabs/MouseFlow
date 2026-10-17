/* ONE RUN CARD - a pocket version of the Theater's run report, without the screen: what was asked, what the
 * agent did, the checks the machine decided, and the verdict. One recipe for all eight cards.
 *
 * The whole card is rendered finished (the poster: server, reduced motion, ?still, and every card that is
 * not the active one). Its lines carry cue times measured from the moment the card becomes active, so when
 * the deck's timeline replays from 0 the active card re-runs: steps tick in, each check's spinner resolves
 * into its PASS or FAIL, the verdict rises and the top edge draws from the centre. UseCases.css keeps the
 * cues of every other card on show, so a neighbour always reads as a finished report.
 */
import type { CSSProperties, ReactNode, Ref } from 'react';
import { CalendarClock, Globe, LayoutGrid, MessageSquare, Monitor, Send, Timer, type LucideIcon } from 'lucide-react';
import { cn } from '@insightis/ui/cn';
import { cue } from '../../motion';
import { CheckLine, HexDot, HexSpinner, Lines, Panel, StatusChip, Tick } from '../kit';
import type { Icon, Step, UseCase } from './cases';

/* The mini-run's clock (ms after the card becomes active). The deck slides for 560ms; the run starts 200ms
   after it settles. Steps tick in 120ms apart and resolve as they go; checks arrive 160ms apart, each with
   a spinner that turns into its outcome; then the verdict. RUN_END closes act 0 for every card, so a deck
   interrupted while a card is resting resumes resting instead of replaying it. */
const START = 760;
const STEP = 120;
const STEP_DONE = 360;
const CHECK = 160;
const RESOLVE = 480;
export const RUN_END = 3200;

export function timing(c: UseCase) {
  const steps = c.did.map((_, i) => ({ at: START + i * STEP, done: START + i * STEP + STEP_DONE }));
  const first = steps[steps.length - 1]!.done + STEP;
  const checks = c.checks.map((_, j) => ({ at: first + j * CHECK, resolve: first + j * CHECK + RESOLVE }));
  const verdict = checks[checks.length - 1]!.resolve + 240;
  return { steps, checks, verdict };
}

const ICONS: Record<Icon, LucideIcon> = {
  desktop: Monitor,
  chrome: Globe,
  fleet: LayoutGrid,
  claude: MessageSquare,
  telegram: Send,
  long: Timer,
  schedule: CalendarClock,
};

/** Quoted UI names (“Reply”, “Sent Items”) in the brighter ink, the way a run log shows them. */
function emph(text: string): ReactNode {
  const parts = text.split(/(“[^”]*”)/);
  return parts.map((p, i) => (i % 2 ? <b key={i}>{p}</b> : p));
}

/** A "·"-separated line (the meta, a list of machines) breaks between its parts, never inside a short one:
    "nightly 02:00" and "office-3" stay whole. */
function parts(text: string): ReactNode {
  return text.split(' · ').map((part, i) => (
    <span key={i}>
      {i > 0 && ' · '}
      <span className={part.length <= 24 ? 'uc-nb' : undefined}>{part}</span>
    </span>
  ));
}

function StepMark({ kind = 'done' }: { kind?: Step['kind'] }) {
  if (kind === 'refused') return <HexDot kind="paused" size={9} />;
  if (kind === 'wait') return <HexDot kind="empty" size={9} />;
  if (kind === 'note') return <HexDot kind="ice" size={8} />;
  return <Tick />;
}

export interface CaseCardProps {
  c: UseCase;
  /** Place in the shown subset, from 0, and the subset's size: "3 of 8". */
  index: number;
  total: number;
  /** Slots from the active card (see ring.ts). */
  offset: number;
  active: boolean;
  /** Filtered out: fades away and takes no room in the reading order. */
  out: boolean;
  /** The deck layout is on (the script ran): off-centre cards are hidden from assistive tech and inert. */
  enhanced: boolean;
  ref?: Ref<HTMLDivElement>;
}

export function CaseCard({ c, index, total, offset, active, out, enhanced, ref }: CaseCardProps) {
  const t = timing(c);
  const Glyph = ICONS[c.icon];
  const slot = Math.max(-3, Math.min(3, offset));
  const deal = (2 - Math.min(Math.abs(offset), 2)) * 2 + (offset < 0 ? 1 : 0);
  const hidden = enhanced && (!active || out);
  return (
    <Panel
      ref={ref}
      card
      className="uc-card"
      role="group"
      aria-roledescription="slide"
      aria-label={`${index + 1} of ${total}: ${c.title}`}
      aria-hidden={hidden || undefined}
      inert={hidden || undefined}
      data-tone={c.tone}
      data-checks={c.checks.length}
      data-area={c.area}
      data-pos={slot}
      data-active={active && !out ? '' : undefined}
      data-out={out ? '' : undefined}
      data-reveal-item="up"
      style={{ '--o': offset, '--deal': deal } as CSSProperties}
    >
      {/* The verdict's colour along the top edge; it draws from the centre when the run ends. */}
      <i className="uc-edge" aria-hidden="true" {...cue(t.verdict, 'none')} />

      <header className="uc-top">
        <StatusChip kind={c.area === 'qa' ? 'accent' : 'steel'} size="sm" className="uc-tag">
          <Glyph aria-hidden strokeWidth={2} />
          {c.tag}
        </StatusChip>
        <span className="uc-meta">{parts(c.meta)}</span>
      </header>
      <h3 className="hl-h3 uc-title">{c.title}</h3>

      <div className="uc-body">
        <div className="uc-col">
          <div className="uc-block">
            <p className="uc-label">Goal</p>
            <p className="uc-goal">
              <span className="uc-prompt" aria-hidden="true">
                ›
              </span>
              <span>“{c.goal}”</span>
            </p>
          </div>
          <div className="uc-block">
            <p className="uc-label">What it did</p>
            <ol className="uc-steps">
              {c.did.map((s, i) => (
                <li key={i} className={cn('uc-step', s.kind && s.kind !== 'done' && `uc-step--${s.kind}`)} {...cue(t.steps[i]!.at, 'rise')}>
                  <span className="hl-mark" aria-hidden="true">
                    <HexSpinner className="hl-transient" at={t.steps[i]!.at} out={t.steps[i]!.done} />
                    <span {...cue(t.steps[i]!.done, 'fade')}>
                      <StepMark kind={s.kind} />
                    </span>
                  </span>
                  <span className="uc-step-x">{emph(s.text)}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="uc-col">
          <div className="uc-block">
            <p className="uc-label">Checks</p>
            <Lines className="uc-checks">
              {c.checks.map((k, j) => (
                <CheckLine
                  key={j}
                  n={c.checks.length > 1 && c.checks.every((x) => x.statement === k.statement) ? 1 : j + 1}
                  kind={k.kind}
                  statement={k.statement}
                  outcome={k.outcome}
                  tier={k.tier}
                  evidence={k.evidence?.includes(' · ') ? parts(k.evidence) : k.evidence}
                  extra={
                    k.when ? (
                      <p className="uc-when">
                        <span aria-hidden="true">◷ </span>
                        <span className="sr-only">Checked </span>when {k.when}
                      </p>
                    ) : undefined
                  }
                  at={t.checks[j]!.at}
                  resolveAt={t.checks[j]!.resolve}
                />
              ))}
            </Lines>
          </div>
        </div>
      </div>

      <footer className="uc-foot">
        <p className="uc-label uc-label--inline">Verdict</p>
        <div className="uc-verdict" {...cue(t.verdict, 'rise-lg')}>
          {c.verdict.map((v) => (
            <StatusChip key={v.text} kind={v.kind} size={c.verdict.length > 1 ? 'md' : 'lg'} className="uc-vchip">
              {v.text}
            </StatusChip>
          ))}
        </div>
        <p className="uc-says" {...cue(t.verdict + 140, 'fade')}>
          {c.says}
        </p>
        {c.nights && (
          <span className="uc-nights" aria-hidden="true" {...cue(t.verdict + 140, 'fade')}>
            {Array.from({ length: 9 }, (_, i) => (
              <HexDot key={i} kind="pass" size={8} />
            ))}
            <span className="uc-night-new" {...cue(t.verdict + 520, 'pop')}>
              <HexDot kind="pass" size={8} />
            </span>
            <span className="uc-nights-label">last 10 nights</span>
          </span>
        )}
      </footer>

      {/* Layers, not property changes: the dim over a neighbour and the hover ring both fade by opacity. */}
      <i className="uc-shade" aria-hidden="true" />
      <i className="uc-ring" aria-hidden="true" />
    </Panel>
  );
}
