/* LAST NIGHT - Wednesday night on two machines, drawn twice from the same data: a horizontal night from
 * 768px (lanes on a 01:30 → 09:00 scale, an axis under them) and a vertical one on a phone (a rail with the
 * runs as rows). Each is the better picture at its width, and only one is displayed; the whole drawing is
 * aria-hidden and the figure's sr-only caption says what it shows, so nothing is read twice.
 *
 * THE SWEEP. One honey marker crosses the night - a wrapper the size of the night translated −100% → 0 on
 * --m-inout (sweep.ts) - and each run arrives as the line reaches it: its cue time is solved from where it
 * sits, so the two drawings each keep step with their own line. The wrapper's transform is written from the
 * section's own clock on every frame (sweepAt), not left to a CSS animation: the clock can pause, restart
 * its act or hurry to catch up with a reader who has scrolled ahead, and the line has to be wherever the
 * runs think it is. At rest (the server, reduced motion, ?still) the wrapper is untransformed, which puts
 * the marker on 09:00: the poster is the morning.
 *
 * When the night has played through, the bar's Pause button becomes Replay.
 */
import { useRef, type CSSProperties, type Ref } from 'react';
import { Moon } from 'lucide-react';
import { cn } from '@insightis/ui/cn';
import { cue, reveal, stagger, useIsoLayoutEffect, type Timeline } from '../../motion';
import { CueSwap, DemoFrame, HexDot, Panel, PanelBar, PlayToggle, ReplayButton, StatusChip } from '../kit';
import { nightX, passAt, sweepAt } from './sweep';
import type { NightBlock, NightLane, NightResult } from './types';

const CHIP: Record<NightResult, 'pass' | 'fail' | 'missed'> = { pass: 'pass', fail: 'fail', missed: 'missed' };

/** The dawn warms over the sweep's last 1.2s (motion spec), arriving with the marker at 09:00. */
const DAWN_AT = passAt(1) - 1200;
/** A run's result dot pops just after the run itself arrives. */
const DOT_LAG = 80;

/* Hours on the horizontal axis and the dashed gridlines through the lanes; 09:00 is the now-marker's. */
const HOURS = ['02:00', '04:00', '06:00', '08:00'];

/* The marker's rolling label on the horizontal night: it reads the hour it is crossing, then settles on the
   morning. Each roll is centred on the moment the line crosses that hour (a roll takes 300ms), so the digits
   change under the line rather than just after it. */
const ROLL_LEAD = 150;
const TAG_VALUES = [
  { at: 0, node: '01:30' },
  ...HOURS.map((h) => ({ at: passAt(nightX(h)) - ROLL_LEAD, node: h })),
  { at: passAt(1) - ROLL_LEAD, node: '09:00 · morning' },
];

/* A run's tile on the horizontal night: 20px wide (a two-minute run is a few pixels on this scale, so the
   tiles are drawn at a readable width and the cluster starts at its true time), 3px apart. The marker
   reaches the second and third tiles a little after the first; PLOT_W is the night's typical width at
   1200px+, used only to place those cues. */
const SEG_W = 23;
const PLOT_W = 920;

export interface NightPanelProps {
  timeline: Timeline;
  lanes: NightLane[];
  blocks: NightBlock[];
  /** The bar's chip: "Wed 02:00 → Thu 09:00". */
  range: string;
  /** The sr-only figcaption. */
  label: string;
  /** The visible caption under the panel. */
  caption: string;
  /** The panel: hovering it pauses the demo. */
  panelRef: Ref<HTMLDivElement>;
}

export function NightPanel({ timeline, lanes, blocks, range, label, caption, panelRef }: NightPanelProps) {
  const sweepH = useRef<HTMLDivElement>(null);
  const sweepV = useRef<HTMLDivElement>(null);

  /* The line follows the clock. A layout effect, so the first frame a running timeline paints already has
     the line where it belongs (a demo below the fold starts it at the night's first minute). Only the
     displayed drawing has a box, but writing both costs nothing. will-change only while it travels. */
  useIsoLayoutEffect(
    () =>
      timeline.subscribe((t) => {
        const f = sweepAt(t);
        const moving = f > 0 && f < 1;
        const off = ((f - 1) * 100).toFixed(3);
        for (const [el, axis] of [
          [sweepH.current, 'x'],
          [sweepV.current, 'y'],
        ] as const) {
          if (!el) continue;
          el.style.transform = f >= 1 ? '' : axis === 'x' ? `translate3d(${off}%, 0, 0)` : `translate3d(0, ${off}%, 0)`;
          el.classList.toggle('hl-will', moving);
        }
      }),
    [timeline],
  );

  return (
    <DemoFrame label={label} caption={caption} className="ns-fig">
      <Panel ref={panelRef} tone="steel" className="ns-night" {...reveal('panel', 0)}>
        <PanelBar
          title={
            <>
              <Moon className="ns-moon" aria-hidden strokeWidth={2} />
              Last night
            </>
          }
          end={
            <>
              <StatusChip size="sm">{range}</StatusChip>
              {timeline.ended ? <ReplayButton timeline={timeline} label="Replay last night" /> : <PlayToggle timeline={timeline} />}
            </>
          }
        />
        <div className="ns-night-body" aria-hidden="true">
          <i className="ns-sky" />
          <i className="ns-dawn" {...cue(DAWN_AT, 'none')} />
          <Horizontal lanes={lanes} blocks={blocks} sweepRef={sweepH} />
          <Vertical lanes={lanes} blocks={blocks} sweepRef={sweepV} />
        </div>
      </Panel>
    </DemoFrame>
  );
}

const pct = (f: number) => Math.round(f * 10000) / 100;

/* ── 768px and up: lanes on a time scale ─────────────────────────────────────────────────────────────── */

interface DrawingProps {
  lanes: NightLane[];
  blocks: NightBlock[];
  /** The sweep's wrapper, moved by the panel's clock. */
  sweepRef: Ref<HTMLDivElement>;
}

function Horizontal({ lanes, blocks, sweepRef }: DrawingProps) {
  return (
    <div className="ns-h">
      {lanes.map((l, i) => (
        <LaneName key={l.name} lane={l} className="ns-h-name" style={{ gridRow: i + 2 }} />
      ))}

      {/* Dashed hour lines through both lanes. */}
      <div className="ns-h-hours">
        <div className="ns-track">
          {HOURS.map((h) => (
            <i key={h} style={{ '--x': pct(nightX(h)) } as CSSProperties} />
          ))}
        </div>
      </div>

      {lanes.map((l, i) => (
        <div key={l.name} className={cn('ns-h-lane', `ns-h-lane--${l.status}`)} style={{ gridRow: i + 2 }}>
          <div className="ns-track">
            {l.status === 'offline' && <Asleep blocks={blocks.filter((b) => b.lane === i)} />}
            <LaneNote lane={l} />
            <LaneRuns runs={blocks.filter((b) => b.lane === i && b.result !== 'missed')} />
            {blocks
              .filter((b) => b.lane === i && b.result === 'missed')
              .map((b) => (
                <Missed key={b.id} block={b} />
              ))}
          </div>
        </div>
      ))}

      <div className="ns-h-axis">
        <div className="ns-track">
          {[...HOURS, '09:00'].map((h) => (
            <span key={h} className={cn('ns-h-hour', h === '09:00' && 'ns-h-hour--now')} style={{ '--x': pct(nightX(h)) } as CSSProperties}>
              {h}
            </span>
          ))}
        </div>
      </div>

      <div className="ns-h-clip">
        <div ref={sweepRef} className="ns-sweep ns-h-sweep">
          <i className="ns-trail" />
          <i className="ns-line" />
          <HexDot kind="live" size={7} className="ns-head" />
          <span className="ns-h-tag">
            <CueSwap kind="roll" values={TAG_VALUES} />
          </span>
        </div>
      </div>
    </div>
  );
}

function LaneName({ lane, className, style }: { lane: NightLane; className?: string; style?: CSSProperties }) {
  return (
    <span className={cn('ns-lane', className)} style={style}>
      <span className="ns-lane-n">
        <HexDot kind={lane.status} size={8} />
        {lane.name}
      </span>
      <span className="ns-lane-p">{lane.platform}</span>
    </span>
  );
}

/** A machine's runs, one after another: a cluster of tiles from the first one's time, and their names. */
function LaneRuns({ runs }: { runs: NightBlock[] }) {
  if (!runs.length) return null;
  const x0 = nightX(runs[0]!.time);
  /* The marker reaches tile k as it reaches its left edge. */
  const at = runs.map((_, k) => passAt(x0 + (k * SEG_W) / PLOT_W));
  return (
    <div className="ns-cl" style={{ '--x': pct(x0) } as CSSProperties}>
      <span className="ns-segs">
        {runs.map((b, k) => (
          <span key={b.id} className={cn('ns-seg', `ns-seg--${b.result}`)} {...cue(at[k]!, 'rise')}>
            <span className="ns-seg-dot" {...cue(at[k]! + DOT_LAG, 'pop')}>
              <HexDot kind={b.result} size={8} />
            </span>
          </span>
        ))}
      </span>
      <span className="ns-cl-list">
        {runs.map((b, k) => (
          <span key={b.id} className="ns-cl-line" {...cue(at[k]! + stagger(1, 30), 'rise')}>
            <span className="ns-t">{b.time}</span>
            <span className="ns-n">{b.name}</span>
            <StatusChip kind={CHIP[b.result]} size="sm">
              {b.tag}
            </StatusChip>
          </span>
        ))}
      </span>
    </div>
  );
}

/* What a lane was doing between its runs, written along it from 1200px (where there is room): the reason
   one machine ran its tests and the other missed its slot. Each note arrives as the marker reaches it. */
const LANE_NOTE = {
  online: { at: '06:15', text: 'awake · taking work' },
  offline: { at: '02:15', text: 'not listening' },
} as const;

function LaneNote({ lane }: { lane: NightLane }) {
  const n = LANE_NOTE[lane.status];
  const x = nightX(n.at);
  return (
    <span className="ns-lane-note" style={{ '--x': pct(x) } as CSSProperties} {...cue(passAt(x), 'fade')}>
      {n.text}
    </span>
  );
}

/** A machine that was not listening: a faint hatch from the start of the night to the moment it was next
    heard from (the end of its last miss). */
function Asleep({ blocks }: { blocks: NightBlock[] }) {
  const until = blocks.reduce((m, b) => (b.result === 'missed' ? Math.max(m, nightX(b.until ?? b.time)) : m), 0);
  if (!until) return null;
  return <i className="ns-asleep" style={{ '--w': pct(until) } as CSSProperties} />;
}

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** A run nobody was there for: a hollow dashed tile over the time it waited, its words to its left. It
    appears as the marker reaches the end of the wait - when the miss was recorded. */
function Missed({ block }: { block: NightBlock }) {
  const x = nightX(block.time);
  const end = nightX(block.until ?? block.time);
  const at = passAt(end);
  const style = { '--x': pct(x), '--w': pct(Math.max(end - x, 0.02)) } as CSSProperties;
  return (
    <>
      <span className="ns-miss" style={style} {...cue(at, 'fade')}>
        {block.until && <span className="ns-miss-w">{minutes(block.until) - minutes(block.time)} min</span>}
      </span>
      <span className="ns-miss-label" style={style} {...cue(at + 40, 'rise')}>
        <span className="ns-miss-line">
          <span className="ns-t">{block.time}</span>
          <span className="ns-n">{block.name}</span>
        </span>
        <StatusChip kind="missed" size="sm">
          {block.note ? `${block.tag} — ${block.note}` : block.tag}
        </StatusChip>
      </span>
    </>
  );
}

/* ── Under 768px: the night as a rail ───────────────────────────────────────────────────────────────────
   Rows of fixed height, so where each run sits - and so when the marker reaches it - is known here, and the
   rail's rows are set from the same list (--v-rows): change a height in one place and the cues follow. */

type VRow =
  | { kind: 'lane'; lane: number; h: number }
  | { kind: 'run'; block: NightBlock; h: number }
  | { kind: 'tick'; time: string; h: number };

const V_LANE = 36;
const V_RUN = 58;
const V_TICK = 44;
/* The marker "reaches" a run as it reaches the run's name, 20px into the row. */
const V_READ = 20;

function vRows(lanes: NightLane[], blocks: NightBlock[]): VRow[] {
  const rows: VRow[] = [];
  /* Lanes in order, each with its runs, and a quiet hour between them so the rail reads as time passing. */
  const quiet = ['04:00', '08:00'];
  lanes.forEach((_, i) => {
    rows.push({ kind: 'lane', lane: i, h: V_LANE });
    for (const b of blocks.filter((x) => x.lane === i)) rows.push({ kind: 'run', block: b, h: V_RUN });
    const q = quiet[i];
    if (q) rows.push({ kind: 'tick', time: q, h: V_TICK });
  });
  return rows;
}

function Vertical({ lanes, blocks, sweepRef }: DrawingProps) {
  const rows = vRows(lanes, blocks);
  const total = rows.reduce((s, r) => s + r.h, 0);
  let top = 0;
  const placed = rows.map((r) => {
    const at = passAt((top + V_READ) / total);
    top += r.h;
    return { r, at };
  });
  const style = { '--v-rows': rows.map((r) => `minmax(${r.h}px, auto)`).join(' ') + ' auto' } as CSSProperties;
  const nowAt = passAt(1) - 140;
  return (
    <div className="ns-v" style={style}>
      {placed.map(({ r, at }, i) => {
        const row = { gridRow: i + 1 };
        if (r.kind === 'lane') {
          const l = lanes[r.lane]!;
          return (
            <div key={'lane' + r.lane} className="ns-v-row ns-v-row--lane" style={row}>
              <span />
              <span className={cn('ns-v-node', i === 0 && 'ns-v-node--first')}>
                <HexDot kind={l.status} size={9} />
              </span>
              <span className="ns-v-lane">
                <span className="ns-v-lane-n">{l.name}</span>
                <span className="ns-v-lane-p">{l.platform}</span>
              </span>
            </div>
          );
        }
        if (r.kind === 'tick') {
          return (
            <div key={'tick' + r.time} className="ns-v-row ns-v-row--tick" style={row}>
              <span className="ns-v-time">{r.time}</span>
              <span className="ns-v-node ns-v-node--tick" />
              <span />
            </div>
          );
        }
        const b = r.block;
        return (
          <div key={b.id} className={cn('ns-v-row ns-v-row--run', `ns-v-row--${b.result}`)} style={row}>
            <span className="ns-v-time">{b.time}</span>
            <span className="ns-v-node">
              <span className="ns-v-dot" {...cue(at + DOT_LAG, 'pop')}>
                <HexDot kind={b.result} size={10} />
              </span>
            </span>
            <span className="ns-v-run" {...cue(at, 'rise')}>
              <span className="ns-v-run-n">{b.name}</span>
              <span className="ns-v-run-st">
                <StatusChip kind={CHIP[b.result]} size="sm">
                  {b.tag}
                </StatusChip>
                {b.note && <span className="ns-v-run-note">{b.note}</span>}
              </span>
            </span>
          </div>
        );
      })}

      <div className="ns-v-row ns-v-row--now" style={{ gridRow: rows.length + 1 }}>
        <span className="ns-v-time ns-v-now" {...cue(nowAt, 'fade')}>
          09:00
        </span>
        <span />
        <span className="ns-v-now" {...cue(nowAt, 'fade')}>
          morning
        </span>
      </div>

      <div className="ns-v-clip" style={{ gridRow: `1 / ${rows.length + 1}` }}>
        <div ref={sweepRef} className="ns-sweep ns-v-sweep">
          <i className="ns-trail" />
          <i className="ns-line" />
          <HexDot kind="live" size={7} className="ns-head" />
        </div>
      </div>
    </div>
  );
}
