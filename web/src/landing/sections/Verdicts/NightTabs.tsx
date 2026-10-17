/* THE THREE NIGHTS AS TABS - Mon · passed, Tue · no verdict, Wed · failed a check: a WAI-ARIA tablist over
 * the console's sheets, rendered only once the console is enhanced (without a script the three sheets are
 * simply one under another, each with its own heading).
 *
 * A glass segmented control like 01's steps: a pill that travels to the night on show (--m-inout, as
 * everything moving between two places), tinted by that night's verdict - its tint layers crossfade, so the
 * pill turns from green to grey to red as it goes. Under the selected tab a 1px hairline fills while the
 * console waits to move on to the next night; it is only there while the console is advancing by itself.
 *
 * Activation is automatic, as the spec asks for a three-night switch: Left/Right (and Home/End) move focus
 * and select. Selecting is manual navigation - the engine jumps to that night, plays it once at double
 * speed and holds; auto-advance stays off until Play.
 */
import { useRef, type KeyboardEvent } from 'react';
import { Button } from '@insightis/ui/Button';
import { cn } from '@insightis/ui/cn';
import { useTimelineFrame, type Timeline } from '../../motion';
import { HexDot } from '../kit';
import { ACTS, DWELL, NIGHTS } from './script';

export interface NightTabsProps {
  tl: Timeline;
  current: number;
  /** The console is moving on by itself: show the hairline. */
  advancing: boolean;
  onSelect(i: number): void;
  tabId(i: number): string;
  panelId(i: number): string;
}

export function NightTabs({ tl, current, advancing, onSelect, tabId, panelId }: NightTabsProps) {
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const fills = useRef<(HTMLElement | null)[]>([]);
  const shown = useRef<number[]>([]);

  /* The hairline follows the shared clock by a transform written on each frame - no React render per frame.
     It fills over a night's dwell act (1, 3), and is empty during plays. */
  useTimelineFrame((t) => {
    for (let i = 0; i < NIGHTS.length; i++) {
      const el = fills.current[i];
      if (!el) continue;
      const from = ACTS[i * 2 + 1];
      const p = from === undefined || i === NIGHTS.length - 1 ? 0 : Math.round(Math.min(1, Math.max(0, (t - from) / DWELL)) * 1000) / 1000;
      if (shown.current[i] === p) continue;
      shown.current[i] = p;
      el.style.transform = `scaleX(${p})`;
    }
  }, tl);

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const last = NIGHTS.length - 1;
    const next =
      e.key === 'ArrowRight' ? (i === last ? 0 : i + 1) : e.key === 'ArrowLeft' ? (i === 0 ? last : i - 1) : e.key === 'Home' ? 0 : e.key === 'End' ? last : null;
    if (next === null) return;
    e.preventDefault();
    onSelect(next);
    tabs.current[next]?.focus();
  };

  return (
    <div
      className="vd-tabs"
      role="tablist"
      aria-label="Three nights of Invoice total is right"
      data-sel={current}
      data-advancing={advancing ? '' : undefined}
    >
      <span className="vd-tabs-pill" aria-hidden="true">
        <i className="vd-tint vd-tint--pass" />
        <i className="vd-tint vd-tint--grey" />
        <i className="vd-tint vd-tint--fail" />
      </span>
      {NIGHTS.map((n) => (
        <Button
          key={n.day}
          ref={(el) => {
            tabs.current[n.i] = el;
          }}
          type="button"
          variant="ghost"
          role="tab"
          id={tabId(n.i)}
          aria-selected={current === n.i}
          aria-controls={panelId(n.i)}
          tabIndex={current === n.i ? 0 : -1}
          className={cn('vd-tab', `vd-tab--${n.kind}`)}
          onClick={() => onSelect(n.i)}
          onKeyDown={(e) => onKey(e, n.i)}
        >
          <span className="vd-tab-in">
            <span className="vd-tab-day">
              <HexDot kind={n.kind} size={8} />
              {n.day}
            </span>
            <span className="vd-tab-v">{n.verdict}</span>
          </span>
          <span className="vd-tab-track" aria-hidden="true">
            <i
              ref={(el) => {
                fills.current[n.i] = el;
              }}
            />
          </span>
        </Button>
      ))}
    </div>
  );
}
