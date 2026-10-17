/* ONE GLASS CELL: a single frosted hexagonal prism, the hive's building block at icon size.
 *
 * The landing's value cards wear one each, with a line glyph standing on the lid (the concept's #prism
 * symbol); the admin can use the same cell wherever it wants the hive's material in a small space - an
 * empty state, a section header - which is why it is a component in brand/ and not a drawing in the page.
 *
 * The glyph is the caller's: pass 24-unit line art as children and it is placed on the lid, stroked in
 * frost by default. Use `GlassCellAccent` for the strokes that should read as ice-2, and `GlassCellCore`
 * for the one warm dot, so a glyph never has to name a colour.
 *
 * Per-instance gradient ids, as everywhere in brand/ (see HiveMark.tsx). aria-hidden: an icon beside a
 * heading that already says what it is.
 */
import { useId, type ReactNode } from 'react';
import { ink, op } from './hive-ink';

const FROST = ink('frost');
const ICE = ink('ice');
const CYAN = ink('ice-2');
const STEEL = ink('steel');

const EDGE = { stroke: FROST, strokeOpacity: 0.22 };

export interface GlassCellProps {
  className?: string;
  children?: ReactNode;
}

export function GlassCell({ className, children }: GlassCellProps) {
  const id = 'gc' + useId().replace(/[^A-Za-z0-9_-]/g, '');
  const top = id + 't';
  const side = id + 's';
  const side2 = id + 'r';
  return (
    <svg viewBox="0 0 72 72" aria-hidden="true" focusable="false" className={className}>
      <defs>
        <linearGradient id={top} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: FROST, stopOpacity: 0.34 }} />
          <stop offset=".55" style={{ stopColor: ICE, stopOpacity: 0.16 }} />
          <stop offset="1" style={{ stopColor: CYAN, stopOpacity: 0.3 }} />
        </linearGradient>
        <linearGradient id={side} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: ICE, stopOpacity: 0.5 }} />
          <stop offset=".6" style={{ stopColor: STEEL, stopOpacity: 0.1 }} />
          <stop offset="1" style={{ stopColor: CYAN, stopOpacity: 0.4 }} />
        </linearGradient>
        <linearGradient id={side2} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: ICE, stopOpacity: 0.36 }} />
          <stop offset=".6" style={{ stopColor: STEEL, stopOpacity: 0.08 }} />
          <stop offset="1" style={{ stopColor: CYAN, stopOpacity: 0.34 }} />
        </linearGradient>
      </defs>
      <ellipse cx="36" cy="66" rx="30" ry="6" style={{ fill: CYAN, fillOpacity: 0.18 }} />
      <polygon points="62,40 49,52.61 49,68.61 62,56" fill={`url(#${side2})`} strokeWidth=".8" strokeLinejoin="round" style={EDGE} />
      <polygon points="49,52.61 23,52.61 23,68.61 49,68.61" fill={`url(#${side})`} strokeWidth=".8" strokeLinejoin="round" style={EDGE} />
      <polygon points="23,52.61 10,40 10,56 23,68.61" fill={`url(#${side})`} strokeWidth=".8" strokeLinejoin="round" style={{ ...EDGE, strokeOpacity: 0.24 }} />
      <polygon
        points="62,40 49,52.61 23,52.61 10,40 23,27.39 49,27.39"
        fill={`url(#${top})`}
        strokeWidth="1"
        strokeLinejoin="round"
        style={{ stroke: FROST, strokeOpacity: 0.55 }}
      />
      <polyline points="10,40 23,27.39 49,27.39" fill="none" strokeWidth="1.2" strokeLinecap="round" style={{ stroke: FROST, strokeOpacity: 0.85 }} />
      <polyline points="62,56 49,68.61 23,68.61 10,56" fill="none" strokeWidth="1" strokeLinejoin="round" style={{ stroke: ICE, strokeOpacity: 0.7 }} />
      <ellipse cx="36" cy="41" rx="13" ry="4.2" style={{ fill: ink('shade'), fillOpacity: 0.35 }} />
      {children && (
        <g
          transform="translate(24.6 15.6) scale(.95)"
          fill="none"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ stroke: FROST }}
        >
          {children}
        </g>
      )}
    </svg>
  );
}

/** A glyph stroke in ice-2 - the "this is the action" part of a cell's glyph. */
export const GlassCellAccent = ({ d }: { d: string }) => <path d={d} style={{ stroke: CYAN }} />;

/** A filled panel behind a glyph, the glass darkened so the line art reads. */
export const GlassCellPanel = ({ d }: { d: string }) => (
  <path d={d} style={{ fill: ink('page'), fillOpacity: op(0.55) }} />
);

/** The one warm thing in a glyph: a honey dot, as the queen is in the hive. */
export const GlassCellCore = ({ cx, cy, r }: { cx: number; cy: number; r: number }) => (
  <circle cx={cx} cy={cy} r={r} style={{ fill: ink('amber'), stroke: ink('honey') }} />
);
