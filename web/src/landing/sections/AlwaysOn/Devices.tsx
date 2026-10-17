/* DEVICES - the admin's Devices screen at landing scale: one command in plain words, sent to four office
 * PCs, answered row by row. Two held, one failed its check, the paused one refused; the busy QA VM keeps
 * running its own test and the offline Mac never hears of it. Every outcome is the product's own word.
 *
 * One looping demo on the shared clock (11s). The server, reduced motion and ?still get the poster - the
 * final frame, every result and the summary in place; a running timeline replays it from the empty
 * composer. Each row's "Now" cell is a stack of layers in one grid cell (idle → queued → running → result),
 * so the row is as tall as its tallest state from the first frame and nothing below it ever moves.
 *
 * The mock is aria-hidden; the figure's caption says what it shows. The panel bar's Pause is the one real
 * control (WCAG 2.2.2: it moves on its own for longer than 5s).
 */
import { useRef, type CSSProperties, type ReactNode } from 'react';
import { Send } from 'lucide-react';
import { cn } from '@insightis/ui/cn';
import { cue, revealGroup, revealItem, useTimeline } from '../../motion';
import { DemoFrame, HexDot, Panel, PanelBar, PlayToggle, StatusChip, TypeText, type HexKind } from '../kit';
import { DEVICES, RESULT_TEXT, ROWS, type DeviceRow, type MachineStatus } from './copy';

/* The script, in ms. The goal types like a person (22ms a character), the button presses, the jobs land
   120ms apart, three machines run, the results arrive a beat apart, and the summary closes it. */
const T = {
  goal: 600,
  press: 2000,
  /** One job chip per target row, in row order. */
  job: 2200,
  jobStep: 120,
  /** A job turns into "running" this long after it lands. */
  start: 400,
  refused: 2800,
  results: [5200, 6000, 6800],
  reason: 7000,
  summary: 7400,
  duration: 11000,
};

const STATUS_HEX: Record<MachineStatus, HexKind> = { online: 'online', paused: 'paused', offline: 'offline' };

/** A layer of a row's "Now" cell: on show from `at` until the next layer's moment. */
interface Layer {
  at: number;
  className?: string;
  node: ReactNode;
}

/** The stacked "Now" cell. At rest only the last layer - the final frame - is shown (Devices.css). */
function NowStack({ layers }: { layers: Layer[] }) {
  return (
    <span className="it-now">
      {layers.map((l, i) => (
        <span key={i} className={cn('it-l', l.className)} {...cue(l.at, 'none', layers[i + 1]?.at)}>
          {l.node}
        </span>
      ))}
    </span>
  );
}

/** The ice job chip: a hex with an arrow into it - the command, arriving. */
const JobGlyph = () => (
  <svg className="it-jobglyph" viewBox="0 0 12 13" aria-hidden="true" focusable="false">
    <path d="M6 .8 11 3.6v5.8L6 12.2 1 9.4V3.6Z" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
    <path d="M3.6 6.5h4.6M6.4 4.6l1.9 1.9-1.9 1.9" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** "running": the honey dot and a thin indeterminate bar - the section's one honey, being driven. */
function Running({ test, breathe }: { test?: string; breathe?: boolean }) {
  return (
    <span className="it-run">
      <span className="it-run-line">
        <StatusChip kind="live" className={cn('it-run-chip', !breathe && 'it-run-chip--still')}>
          {DEVICES.running}
        </StatusChip>
        {test && <span className="it-run-test">{test}</span>}
      </span>
      <span className="it-bar">
        <i />
      </span>
    </span>
  );
}

function nowLayers(row: DeviceRow, target: number): Layer[] {
  const idle: Layer = { at: 0, className: 'it-l-idle', node: <span className="it-quiet">{DEVICES.idle}</span> };
  const job = T.job + target * T.jobStep;
  const queued: Layer = {
    at: job,
    className: 'it-l-job',
    node: (
      <StatusChip kind="accent" size="sm" className="it-job">
        <JobGlyph />
        {DEVICES.queued}
      </StatusChip>
    ),
  };
  if (row.role === 'target') {
    const res = T.results[target] ?? T.results[0]!;
    const failed = row.result === 'failed';
    return [
      idle,
      queued,
      { at: job + T.start, className: 'it-l-run', node: <Running /> },
      {
        at: res,
        className: 'it-l-res',
        node: (
          <span className="it-res">
            <span {...cue(res + 170, 'pop')} className="it-res-chip">
              <StatusChip kind={failed ? 'fail' : 'pass'}>{RESULT_TEXT[row.result]}</StatusChip>
            </span>
            {row.reason && (
              <span className="it-reason it-reason--fail" {...cue(T.reason, 'rise')}>
                {row.reason}
              </span>
            )}
          </span>
        ),
      },
    ];
  }
  if (row.role === 'refused') {
    return [
      idle,
      queued,
      {
        at: T.refused,
        className: 'it-l-res',
        node: (
          <span className="it-res">
            <span {...cue(T.refused + 170, 'pop')} className="it-res-chip">
              <StatusChip kind="grey">refused</StatusChip>
            </span>
            <span className="it-reason">{row.reason}</span>
          </span>
        ),
      },
    ];
  }
  return [];
}

function Now({ row, target }: { row: DeviceRow; target: number }) {
  if (row.role === 'busy') return <Running test={row.test} breathe />;
  if (row.role === 'away') return <span className="it-quiet">{row.seen}</span>;
  return <NowStack layers={nowLayers(row, target)} />;
}

export function Devices() {
  const root = useRef<HTMLDivElement>(null);
  const tl = useTimeline(root, { duration: T.duration, loop: true });
  let target = -1;
  return (
    <DemoFrame label={DEVICES.sr} caption={DEVICES.caption} className="it-devices">
      <Panel ref={root} className="it-dev">
        <PanelBar
          title={<span aria-hidden="true">{DEVICES.bar}</span>}
          end={<PlayToggle timeline={tl} label="Pause the Devices example" />}
        />
        <div className="it-dev-body" aria-hidden="true">
          {/* The composer: the admin's "Give a command", typed into and sent. */}
          <div className="it-cmp hl-tile">
            <div className="it-cmp-top">
              <span className="it-cmp-label">{DEVICES.composer}</span>
              <span className="it-seg">
                <span className="it-seg-on">{DEVICES.segments[0]}</span>
                <span>{DEVICES.segments[1]}</span>
              </span>
            </div>
            {/* Who it goes to: the four machines ticked in the list - the busy QA VM and the offline Mac are
                not among them. */}
            <div className="it-to">
              <span className="it-to-label">{DEVICES.to}</span>
              {ROWS.filter((r) => r.role === 'target' || r.role === 'refused').map((r) => (
                <span key={r.name} className="it-to-chip">
                  <HexDot kind={STATUS_HEX[r.status]} size={8} />
                  {r.name}
                </span>
              ))}
            </div>
            <div className="it-cmp-row">
              <span className="it-field">
                <span className="it-field-ph hl-transient" {...cue(0, 'none', T.goal)}>
                  {DEVICES.placeholder}
                </span>
                <TypeText text={DEVICES.goal} at={T.goal} speed="person" className="it-field-v" />
              </span>
              <span className="it-send hl-press" {...cue(T.press, 'none')}>
                <Send aria-hidden strokeWidth={2} />
                {DEVICES.send}
              </span>
            </div>
          </div>

          <div className="it-table">
            <div className="it-row it-row--head">
              {DEVICES.columns.map((c) => (
                <span key={c} className={`it-th it-th--${c.toLowerCase()}`}>
                  {c}
                </span>
              ))}
            </div>
            <div className="it-rows" {...revealGroup({ '--i-base': 2 } as CSSProperties)}>
              {ROWS.map((row, i) => {
                if (row.role === 'target' || row.role === 'refused') target += 1;
                const online = row.status === 'online';
                return (
                  <div key={row.name} className={cn('it-row', `it-row--${row.role}`, `it-row--${row.status}`)} {...revealItem(i)}>
                    <span className="it-row-hex">
                      <HexDot kind={STATUS_HEX[row.status]} size={12} />
                      {online && <i className="it-ring hl-ring" />}
                    </span>
                    <span className="it-row-id">
                      <span className="it-row-name">
                        {row.name}
                        <span className="it-row-ver">
                          v{row.agent}
                          {row.update && <span className="it-row-upd">update</span>}
                        </span>
                      </span>
                      <span className="it-row-meta">
                        <span className="it-row-plat">{row.platform}</span>
                        <span className="it-row-sep"> · </span>
                        <span className="it-row-stat">{row.status}</span>
                      </span>
                    </span>
                    <span className="it-row-now">
                      <Now row={row} target={target} />
                    </span>
                    <span className="it-row-act">{row.role === 'busy' && <span className="hl-pill it-stop">Stop</span>}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="it-sum">
            <span className="it-sum-counts">
              {DEVICES.summary.counts.map((c, i) => (
                <span key={c.text} {...cue(T.summary + i * 70, 'pop')}>
                  <StatusChip kind={c.kind}>{c.text}</StatusChip>
                </span>
              ))}
            </span>
            <span className="it-sum-note" {...cue(T.summary + 280, 'fade')}>
              {DEVICES.summary.note}
            </span>
          </div>
        </div>
      </Panel>
    </DemoFrame>
  );
}
