/* THE RUN THEATER, as parts: the page's one picture of a live agent at work (see theater.css for why it
 * is drawn the way it is). 01 uses it whole, 02 as frozen frames, 07 as a mail screen.
 *
 *   <Theater ref={root} variant="split" bar={<TheaterBar …/>} screen={<Screen>…</Screen>}>
 *     …the side pane: LogLine / CheckLine / VerdictBar…
 *   </Theater>
 *
 * Coordinates on a Screen are percent of the screen ({ x, y, w, h } from 0 to 100), the same for the window
 * parts (screens.tsx), the cursor's waypoints, a ripple and a lens - so the bee clicks exactly where the
 * button is drawn, at every width. The overlays are transient: they exist only while a timeline drives the
 * demo; the poster is the screen at rest.
 */
import { useId, useRef, type CSSProperties, type ReactNode, type Ref } from 'react';
import { cn } from '@insightis/ui/cn';
import { cue, useTimelineFrame, type Timeline } from '../../motion';
import { Panel } from './Panel';
import { HexDot, StatusChip, type HexKind } from './status';
import './theater.css';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

/** The middle of a rectangle - where the bee clicks. */
export const centre = (r: Rect): Point => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/** Inline style placing an element on the rectangle (with .hl-at, or a lens). */
export const rectStyle = (r: Rect, style?: CSSProperties): CSSProperties =>
  ({ ...style, '--x': r.x + '%', '--y': r.y + '%', '--w': r.w + '%', '--h': r.h + '%' }) as CSSProperties;

export interface TheaterProps {
  /** split: screen 57% | side 43% from 1024px; stacked: the side pane under the screen at every width. */
  variant?: 'split' | 'stacked';
  bar?: ReactNode;
  screen: ReactNode;
  /** The side pane. */
  children?: ReactNode;
  className?: string;
  sideClassName?: string;
  /** Usually the timeline root. */
  ref?: Ref<HTMLDivElement>;
}

export function Theater({ variant = 'split', bar, screen, children, className, sideClassName, ref }: TheaterProps) {
  return (
    <Panel ref={ref} className={cn('hl-theater', `hl-theater--${variant}`, className)}>
      {bar}
      <div className="hl-theater-body">
        {screen}
        {children !== undefined && <div className={cn('hl-theater-side', sideClassName)}>{children}</div>}
      </div>
    </Panel>
  );
}

export interface TheaterBarProps {
  /** The machine's status hex: online (ice), driven (honey) … A node for a crossfading pair. */
  status?: HexKind | ReactNode;
  machine: string;
  platform?: string;
  /** The source chip and the optional test pill. */
  chips?: ReactNode;
  /** <ClockDigits …/>. */
  clock?: ReactNode;
  /** <PlayToggle …/>. */
  control?: ReactNode;
  className?: string;
}

export function TheaterBar({ status = 'online', machine, platform, chips, clock, control, className }: TheaterBarProps) {
  return (
    <div className={cn('hl-tbar', className)}>
      <span className="hl-tbar-who">
        {typeof status === 'string' ? <HexDot kind={status as HexKind} size={11} /> : status}
        <span className="hl-tbar-name">{machine}</span>
        {platform && <span className="hl-tbar-os">{platform}</span>}
      </span>
      {chips && <span className="hl-tbar-chips">{chips}</span>}
      {(clock || control) && (
        <span className="hl-tbar-end">
          {clock && <span className="hl-tbar-clock">{clock}</span>}
          {control}
        </span>
      )}
    </div>
  );
}

/** The 5% hex lattice under the desktop - the hero's, small. */
function Lattice() {
  const id = 'hl-lat' + useId().replace(/[^A-Za-z0-9_-]/g, '');
  return (
    <svg className="hl-screen-lattice" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id={id} width="48" height="27.7128" patternUnits="userSpaceOnUse">
          <path
            d="M32 13.8564 28 20.7846 20 20.7846 16 13.8564 20 6.9282 28 6.9282Z M56 0 52 6.9282 44 6.9282 40 0 44-6.9282 52-6.9282Z M56 27.7128 52 34.641 44 34.641 40 27.7128 44 20.7846 52 20.7846Z M8 0 4 6.9282-4 6.9282-8 0-4-6.9282 4-6.9282Z M8 27.7128 4 34.641-4 34.641-8 27.7128-4 20.7846 4 20.7846Z"
            fill="none"
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

export interface ScreenProps {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** A machine's screen: 16/10 (16/11 under 768), the page colour over the lattice. A picture - aria-hidden. */
export function Screen({ children, className, style }: ScreenProps) {
  return (
    <div className={cn('hl-screen', className)} style={style} aria-hidden="true">
      <Lattice />
      {children}
    </div>
  );
}

export interface ScreenWindowProps {
  title: string;
  rect?: Rect;
  className?: string;
  children?: ReactNode;
}

/** A window's chrome: a surface-card body, a slim title bar with three frost dots and a mono title. Draw its
    contents as siblings placed on the screen (with .hl-at and rectStyle), so they share the overlays'
    coordinates. */
export function ScreenWindow({ title, rect = { x: 7, y: 8, w: 86, h: 84 }, className, children }: ScreenWindowProps) {
  const style = { '--wx': rect.x + '%', '--wy': rect.y + '%', '--ww': rect.w + '%', '--wh': rect.h + '%' } as CSSProperties;
  return (
    <div className={cn('hl-win', className)} style={style}>
      <div className="hl-win-bar">
        <i />
        <i />
        <i />
        <span className="hl-win-title">{title}</span>
      </div>
      {children}
    </div>
  );
}

/** The honey border the product lights round a screen while it drives it: in at `at`, out at `out`. Put
    data-holding on the timeline root to hold it steady at .35 (a gate waiting for a person). */
export function DriveBorder({ at, out, className }: { at: number; out?: number; className?: string }) {
  return (
    <span className={cn('hl-drive hl-transient', className)} {...cue(at, 'none', out)}>
      <i />
    </span>
  );
}

export interface Waypoint extends Point {
  /** When the cursor sets off for this point (it glides there in 560ms). */
  at: number;
}

export interface BeeCursorProps {
  /** Where it goes and when, in time order. It appears at the first waypoint. */
  path: Waypoint[];
  /** When it leaves the screen. */
  out?: number;
  /** The timeline it follows; by default the one in TimelineContext. */
  timeline?: Timeline | null;
}

/** The bee's cursor: a frost arrow with a small honey hex at its tail. It follows the timeline by writing
    two custom properties on its layer - no React render per move. */
export function BeeCursor({ path, out, timeline }: BeeCursorProps) {
  const layer = useRef<HTMLSpanElement>(null);
  const shown = useRef(-1);
  useTimelineFrame((t) => {
    const el = layer.current;
    if (!el || !path.length) return;
    let i = 0;
    while (i + 1 < path.length && t >= path[i + 1]!.at) i++;
    if (i === shown.current) return;
    shown.current = i;
    el.style.setProperty('--x', path[i]!.x + '%');
    el.style.setProperty('--y', path[i]!.y + '%');
  }, timeline);
  const first = path[0];
  const last = path[path.length - 1];
  return (
    <span
      ref={layer}
      className="hl-bee-layer hl-transient"
      style={last ? ({ '--x': last.x + '%', '--y': last.y + '%' } as CSSProperties) : undefined}
      {...cue(first?.at ?? 0, 'none', out)}
    >
      <svg className="hl-bee" viewBox="0 0 16 22" aria-hidden="true" focusable="false">
        <path className="hl-bee-arrow" d="M1 1v15.2l4.1-3.7 2.6 6.2 2.6-1.1-2.6-6.1 5.6-.3Z" />
        <polygon className="hl-bee-hex" points="13.2,15.4 15.6,16.8 15.6,19.6 13.2,21 10.8,19.6 10.8,16.8" />
      </svg>
    </span>
  );
}

/** A click: a frost ring at (x, y), scale .4 → 1.6, gone in 360ms. */
export function Ripple({ at, x, y }: { at: number } & Point) {
  return <span className="hl-ripple" style={{ '--x': x + '%', '--y': y + '%' } as CSSProperties} {...cue(at, 'none')} />;
}

export interface LensProps {
  rect: Rect;
  /** The mono tag: 'Edit “Total” · tree'. */
  tag?: ReactNode;
  result?: 'pass' | 'fail' | 'grey';
  /** When the ticks close on the control. */
  at?: number;
  /** When it lets go. */
  out?: number;
  /** When the tag crossfades to PASS or FAIL. */
  resolveAt?: number;
  /** Put the tag above the control rather than under it. */
  above?: boolean;
  /** A frozen frame's lens: the status-coloured ring, no ticks, always there. */
  still?: boolean;
  className?: string;
}

/** The check lens: four corner ticks closing on what a check reads, and its tag turning PASS or FAIL. */
export function Lens({ rect, tag, result = 'pass', at = 0, out, resolveAt, above, still, className }: LensProps) {
  const word = result === 'pass' ? 'PASS' : result === 'fail' ? 'FAIL' : 'no verdict';
  return (
    <span
      className={cn('hl-lens', `hl-lens--${result}`, still ? 'hl-lens--still' : 'hl-transient', className)}
      style={rectStyle(rect)}
      {...(still ? {} : cue(at, 'none', out))}
    >
      {!still && (
        <>
          <i />
          <i />
          <i />
          <i />
        </>
      )}
      {tag && (
        <span className={cn('hl-lens-tag', above && 'hl-lens-tag--above')}>
          <span className="hl-lens-tag-q">{tag}</span>
          <span className="hl-lens-tag-r" {...(still || resolveAt === undefined ? {} : cue(resolveAt, 'fade'))}>
            {tag} · {word}
          </span>
        </span>
      )}
    </span>
  );
}

export interface ClockValue {
  at: number;
  v: string;
}

/** A clock whose digits roll (translateY ±100%, 300ms --m-inout) to each new time; only the digits that
    change move. At rest it shows the last time. Decorative - the figcaption says the times. */
export function ClockDigits({ values, className }: { values: ClockValue[]; className?: string }) {
  const len = Math.max(0, ...values.map((v) => v.v.length));
  const cols: { at: number; ch: string }[][] = [];
  for (let i = 0; i < len; i++) {
    const col: { at: number; ch: string }[] = [];
    for (const { at, v } of values) {
      const ch = v[i] ?? ' ';
      if (!col.length || col[col.length - 1]!.ch !== ch) col.push({ at, ch });
    }
    cols.push(col);
  }
  return (
    <span className={cn('hl-clock', className)} aria-hidden="true">
      {cols.map((col, i) => (
        <span key={i} className="hl-swap hl-swap--roll">
          {col.map((l, j) => (
            <span key={j} {...cue(l.at, 'none', col[j + 1]?.at)}>
              {l.ch === ' ' ? ' ' : l.ch}
            </span>
          ))}
        </span>
      ))}
    </span>
  );
}

export interface FrozenFrameProps {
  /** The colour of the ring: what it proved (pass), where it failed (fail), nothing proven (grey). */
  status: 'pass' | 'fail' | 'grey';
  /** "what it proved" · "where it failed". */
  label: ReactNode;
  /** The rectangle the ring sits on. */
  lens: Rect;
  /** Width in px (128 on a phone, 160 on desktop). */
  width?: number;
  /** The window, small: <BillingWindow …/>. */
  children: ReactNode;
  className?: string;
}

/** A kept frame: the same screen, small, with a status-coloured ring on what the check read and its label.
    A picture - aria-hidden; say what it shows in the text beside it. */
export function FrozenFrame({ status, label, lens, width, children, className }: FrozenFrameProps) {
  return (
    <span className={cn('hl-frame', className)} style={width ? ({ '--frame-w': width + 'px' } as CSSProperties) : undefined} aria-hidden="true">
      <Screen>
        {children}
        <Lens still rect={lens} result={status} />
      </Screen>
      <span className="hl-frame-label">
        <StatusChip size="sm">{label}</StatusChip>
      </span>
    </span>
  );
}
