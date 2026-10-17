/* THE ROWS OF NIGHTS - the admin's Skills list at landing scale: each test's name, where it runs, its last
 * ten nights as hexes (oldest on the left), and a chevron. A row is a real button that opens its detail line:
 * the failing test names its check, the missed skill says nobody was listening.
 *
 * WITHOUT A SCRIPT every row is open - the server's page carries every detail line, and a button that
 * cannot be pressed must not be hiding anything. Once the component has run (useEnhanced) the rows close
 * but the two the morning is about - the red one, and the miss - which is the story: what broke, and why
 * nothing ran on finance-pc.
 *
 * On the section's timeline the dots cascade in left to right over their ghosts (the cell draws one), 30ms
 * apart and 70ms between rows, each row's newest night arriving last; the red one sends out one ring. An open
 * row's detail holds a pending line until its words land. The dots are aria-hidden; each row's sr-only
 * summary says what they mean.
 */
import { useState, type Ref } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@insightis/ui/Button';
import { cn } from '@insightis/ui/cn';
import { cue, reveal, stagger, useEnhanced } from '../../motion';
import { HexDot, Panel, PanelBar, StatusChip } from '../kit';
import type { SkillRow } from './types';

export interface SkillRowsProps {
  rows: SkillRow[];
  /** "Skills · 1 test failing" - the count is drawn red. */
  title: { list: string; failing: string };
  /** The legend under the rows. */
  legend: { pass: string; fail: string; grey: string; missed: string; order: string };
  /** When the cascade starts on the section's timeline. */
  at: number;
  panelRef?: Ref<HTMLDivElement>;
}

/** Each dot 30ms after the one before it; each row 70ms after the row above. */
const dotAt = (at: number, row: number, i: number) => at + stagger(row) + i * 30;

/** A detail's words land 360ms after its row's last night. */
const detailAt = (at: number, row: number, r: SkillRow) => dotAt(at, row, r.nights.length) + 360;

export function SkillRows({ rows, title, legend, at, panelRef }: SkillRowsProps) {
  const enhanced = useEnhanced();
  /* Open once enhanced: the rows the morning is about - the red one and the miss. */
  const [open, setOpen] = useState<Record<string, boolean>>(() => Object.fromEntries(rows.map((r) => [r.id, r.outcome.kind !== 'pass'])));
  const isOpen = (id: string) => !enhanced || !!open[id];

  return (
    <Panel ref={panelRef} className="ns-rows" {...reveal('panel', 1)}>
      <PanelBar
        title={
          <>
            {title.list}
            <span className="ns-rows-sep" aria-hidden="true">
              ·
            </span>
            <span className="ns-rows-failing">
              <HexDot kind="fail" size={8} />
              {title.failing}
            </span>
          </>
        }
        end={<span className="ns-rows-note">{legend.order}</span>}
      />
      <ul className="ns-rows-list">
        {rows.map((r, ri) => {
          const on = isOpen(r.id);
          const last = r.nights.length - 1;
          const detailId = `nightly-${r.id}-detail`;
          return (
            <li key={r.id} className={cn('ns-row', on && 'is-open', `ns-row--${r.outcome.kind}`)}>
              <Button
                type="button"
                variant="ghost"
                className="ns-row-btn"
                aria-expanded={on}
                aria-controls={detailId}
                onClick={() => setOpen((o) => ({ ...o, [r.id]: !on }))}
                rightSlot={<ChevronDown className="ns-row-chev" aria-hidden strokeWidth={2} />}
              >
                <span className="ns-row-name">{r.name}</span>
                <span className="ns-row-sub">{r.sub}</span>
                <span className="ns-row-dots" aria-hidden="true">
                  {r.nights.map((n, i) => (
                    <span key={i} className={cn('ns-dot', i === last && n === 'fail' && 'ns-dot--ring')}>
                      <span className="ns-dot-in" {...cue(dotAt(at, ri, i), 'pop')}>
                        <HexDot kind={n} size={9} />
                      </span>
                      {i === last && n === 'fail' && <i className="ns-ring" {...cue(dotAt(at, ri, i) + 160, 'none')} />}
                    </span>
                  ))}
                  {r.missed && (
                    <span className="ns-dot ns-dot--missed" {...cue(dotAt(at, ri, r.nights.length), 'fade')}>
                      <HexDot kind="missed" size={9} />
                      <span className="ns-missed-tag">missed</span>
                    </span>
                  )}
                </span>
                <span className="sr-only">{r.summary}</span>
              </Button>
              <div id={detailId} className="ns-row-detail" hidden={!on}>
                {r.outcome.kind !== 'pass' && (
                  <span className="ns-row-pending hl-transient" aria-hidden="true" {...cue(0, 'none', detailAt(at, ri, r))}>
                    <i />
                    <i />
                  </span>
                )}
                <p className="ns-row-detail-in" {...(r.outcome.kind !== 'pass' ? cue(detailAt(at, ri, r), 'rise') : {})}>
                  <StatusChip kind={r.outcome.kind} size="sm">
                    {r.outcome.word}
                  </StatusChip>
                  <span className="sr-only">: </span>
                  <span>{r.detail}</span>
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="ns-legend">
        <Key kind="pass">{legend.pass}</Key>
        <Key kind="fail">{legend.fail}</Key>
        <Key kind="grey">{legend.grey}</Key>
        <Key kind="missed">{legend.missed}</Key>
        <span className="ns-legend-order">— {legend.order}</span>
      </p>
    </Panel>
  );
}

function Key({ kind, children }: { kind: 'pass' | 'fail' | 'grey' | 'missed'; children: string }) {
  return (
    <span className="ns-key">
      <HexDot kind={kind} size={8} />
      {children}
    </span>
  );
}
