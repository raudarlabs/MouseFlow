/* The small Logs card over the hive - shown only while somebody points at a machine cell.
 *
 * At rest the hive is a picture; pointing at one of its machines (hover, or a tap on a touch screen) opens
 * this card with THAT machine's last job, the way the product's Logs show it: the goal in plain words and
 * who asked, what it did on its own screen, and the check that decided the colour. It is the page's promise
 * told by example, one machine at a time - and it stays out of the way otherwise, because a card that is
 * always there is a card nobody reads.
 *
 * No made-up command line: Hivelink takes goals in words, from the app, Claude or Telegram, so the first
 * line is the goal itself - ‹› "goal" · on <machine> · by you› (or ‹by itself, from a schedule›).
 *
 * The last machine stays rendered while the card fades out, so it never empties before it is gone. The
 * content is supplementary - the copy beside it says the same in prose - so the card is a polite live
 * region rather than something a keyboard has to travel through.
 *
 * The machines and their runs are hive-machines.ts; the card only lays them out.
 */
import { forwardRef, useRef, type CSSProperties } from 'react';
import { cn } from '@insightis/ui/cn';
import type { HiveMachine } from './hive-machines';

const OUTCOME_TONE: Record<HiveMachine['outcome'], string> = {
  ok: 'text-fb-green',
  running: 'text-brand-primary',
  'could not finish': 'text-fb-red-text',
};

const BY: Record<HiveMachine['by'], string> = { you: 'by you', schedule: 'by itself, from a schedule' };

export interface HiveTerminalProps {
  machine: HiveMachine | null;
  className?: string;
  /** Where the page places it, e.g. beside the pointed cell. */
  style?: CSSProperties;
}

export const HiveTerminal = forwardRef<HTMLDivElement, HiveTerminalProps>(function HiveTerminal({ machine, className, style }, ref) {
  const last = useRef<HiveMachine | null>(machine);
  if (machine) last.current = machine;
  const m = machine ?? last.current;

  return (
    <div ref={ref} style={style} className={cn('hive-term', machine && 'hive-term-on', className)} aria-live="polite" aria-hidden={!machine}>
      <div className="flex items-center gap-[7px] border-b border-[hsl(var(--hive-ice)/0.1)] px-3.5 py-[11px]" aria-hidden="true">
        <i className="size-[9px] rounded-full bg-[hsl(var(--hive-frost)/0.16)]" />
        <i className="size-[9px] rounded-full bg-[hsl(var(--hive-frost)/0.16)]" />
        <i className="size-[9px] rounded-full bg-[hsl(var(--hive-frost)/0.16)]" />
        <span className="ml-2 font-mono text-[11.5px] tracking-[0.04em] text-ink-inactive">Logs — {m ? m.name : 'my hive'}</span>
      </div>
      {m && (
        <div className="px-4 pb-4 pt-3.5 font-mono text-[12.5px] leading-[1.75] text-ink-body">
          <p className="truncate">
            <span className="text-[hsl(var(--hive-ice-2))]">›</span> <span className="text-ink-primary">“{m.job}”</span>
          </p>
          <p className="truncate pl-[2ch] text-ink-inactive">
            on <span className="text-[hsl(var(--hive-ice-hi))]">{m.name}</span> · {BY[m.by]}
          </p>
          <p className="mt-1 flex justify-between gap-3">
            <span>
              <span className="text-[hsl(var(--hive-ice-2))]" aria-hidden="true">◆</span> {m.name}
            </span>
            <span className="text-ink-inactive">{m.os}</span>
          </p>
          {m.steps.map((s) => (
            <p key={s} className="truncate pl-[2ch]">
              <span className={m.outcome === 'could not finish' && s === m.steps[1] ? 'text-fb-red-text' : 'text-ink-inactive'}>›</span> {s}
            </p>
          ))}
          <p className="truncate pl-[2ch] text-ink-secondary">{m.verdict}</p>
          <p className="mt-1 truncate">
            <span className={OUTCOME_TONE[m.outcome]}>{m.outcome}</span>
            <span className="text-ink-primary"> · {m.took}</span>{' '}
            <span className="hive-breathe text-[hsl(var(--hive-ice-2))]" aria-hidden="true">▍</span>
          </p>
        </div>
      )}
    </div>
  );
});
