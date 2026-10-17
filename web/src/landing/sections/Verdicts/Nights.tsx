/* THE ROW OF NIGHTS - the test's last ten runs as hexes, oldest on the left, the way the Skills list shows
 * them: seven green, then the three nights the console plays. It is the console's record: while a night
 * plays its hex glows honey (running), and when its verdict lands the hex takes that colour with one ring
 * pulse - so by the end the row reads green, grey, red, exactly as the tabs under it do.
 *
 * The three newest are buttons once the console is enhanced ("Monday: passed" …) and select their night;
 * the one on show carries a ring, its twin of the selected tab. The older seven are pictures. Without a
 * script every hex is simply its final colour, and the sr-only summary says what the row means.
 */
import type { CSSProperties } from 'react';
import { Button } from '@insightis/ui/Button';
import { cn } from '@insightis/ui/cn';
import { cue } from '../../motion';
import { HexDot } from '../kit';
import { NIGHTS, OLDER, at, type NightDef } from './script';

const SUMMARY = 'Last 10 nights: 8 passed, 1 no verdict, then failed a check on Wednesday.';

/** A night whose verdict this console plays: an empty cell, the honey "running" glow while it plays, its
    status hex popping in at the verdict, a single pulse, and the selection ring. */
function NightLayers({ night }: { night: NightDef }) {
  const v = at(night, night.verdictAt);
  return (
    <>
      <span className="vd-dot-l vd-dot-empty">
        <HexDot kind="empty" size={12} />
      </span>
      <span className="vd-dot-l hl-transient" {...cue(at(night, 160), 'none', v)}>
        <HexDot kind="live" size={12} />
      </span>
      <span className="vd-dot-l" {...cue(v, 'pop')}>
        <HexDot kind={night.kind} size={12} />
      </span>
      <span className={cn('vd-dot-pulse', `vd-dot-pulse--${night.kind}`)} {...cue(v, 'none')} />
      <svg className="vd-dot-ring" viewBox="0 0 20 23" aria-hidden="true" focusable="false">
        <polygon points="10,0.8 19.2,6.1 19.2,16.9 10,22.2 0.8,16.9 0.8,6.1" />
      </svg>
    </>
  );
}

export interface NightsProps {
  enhanced: boolean;
  /** The night on show (0-2). */
  current: number;
  onSelect(i: number): void;
  panelId(i: number): string;
}

export function Nights({ enhanced, current, onSelect, panelId }: NightsProps) {
  return (
    <div className="vd-nights">
      <span className="sr-only">{SUMMARY}</span>
      <span className="vd-nights-row">
        {Array.from({ length: OLDER }, (_, n) => (
          <span key={n} className="vd-dot hl-entrance" style={{ '--n': n } as CSSProperties} aria-hidden="true">
            <HexDot kind="pass" size={12} />
          </span>
        ))}
        {NIGHTS.map((night) => {
          const style = { '--n': OLDER + night.i } as CSSProperties;
          const selected = enhanced && current === night.i;
          return enhanced ? (
            <Button
              key={night.day}
              type="button"
              variant="ghost"
              /* The tabs are the keyboard's way to a night; these are a pointer shortcut to the same thing. */
              tabIndex={-1}
              aria-label={`${night.dayLong}: ${night.verdict}`}
              aria-controls={panelId(night.i)}
              className={cn('vd-dot vd-dot--btn hl-entrance', `vd-dot--${night.kind}`)}
              data-current={selected ? '' : undefined}
              style={style}
              onClick={() => onSelect(night.i)}
            >
              <NightLayers night={night} />
            </Button>
          ) : (
            <span key={night.day} className={cn('vd-dot hl-entrance', `vd-dot--${night.kind}`)} style={style} aria-hidden="true">
              <NightLayers night={night} />
            </span>
          );
        })}
      </span>
      <span className="vd-nights-label" aria-hidden="true">
        Last 10 nights · oldest on the left
      </span>
    </div>
  );
}
