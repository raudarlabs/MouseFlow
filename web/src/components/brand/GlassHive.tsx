/* THE GLASS HIVE: the landing's hero art - an isometric honeycomb of frosted ice cells around one honey
 * queen, with the machines in it linked back to her.
 *
 * Ported from the concept (hivelink/concepts/05d-glasshive-arctic), which drew it with a script into an
 * empty <svg> and re-wrote every polygon thirty times a second. That picture did not exist until the script
 * ran, so it could not be server-rendered, and it was a busy loop on a page whose job is a form. Here the
 * geometry is computed once and deterministically (hive-geometry.ts), the colours are mixes of the
 * palette's variables (hive-ink.ts, brand.css), and the motion is CSS - the cells bob as whole groups on
 * their own phases rather than stretching their sides, which at a 4-unit amplitude reads the same and costs
 * nothing. prefers-reduced-motion gets the still picture.
 *
 * Gradient ids are per instance (useId), for the reason HiveMark.tsx gives: a fixed id resolves to the
 * first element of that id in the document, and a second hive would paint with the first one's defs.
 *
 * Decorative: aria-hidden. Everything it says - the three machine names, "your hive" - is said in words
 * elsewhere on the page.
 */
import { useId, type CSSProperties } from 'react';
import { cn } from '@insightis/ui/cn';
import { HIVE, K, R, pts, type DeviceKind, type HiveCell } from './hive-geometry';
import { ink, mix, op } from './hive-ink';

const FROST = ink('frost');
const ICE = ink('ice');
const CYAN = ink('ice-2');
const STEEL = ink('steel');
const HON = ink('honey');
const AMB = ink('amber');
const DEEP = ink('amber-deep');
const QINK = ink('queen-ink');
const PAGE = ink('page');
const INK = ink('ink');
const SHADE = ink('shade');

/** The machines, 24-unit line glyphs: body | accent stroke. */
const GLYPH: Record<DeviceKind, [string, string]> = {
  laptop: ['M5 6.5h14a1 1 0 0 1 1 1V16H4V7.5a1 1 0 0 1 1-1Z', 'M2.5 18.5h19'],
  desktop: ['M3.5 4.5h17a1 1 0 0 1 1 1v9.5a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1Z', 'M12 16v3.5M8 20h8'],
  server: [
    'M4.5 3.5h15a1 1 0 0 1 1 1v5h-17v-5a1 1 0 0 1 1-1ZM3.5 13h17v6a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1Z',
    'M7 6.7h.01M7 16.5h.01M10.5 6.7h6M10.5 16.5h6',
  ],
  terminal: ['M4 4.5h16A1.5 1.5 0 0 1 21.5 6v12a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 18V6A1.5 1.5 0 0 1 4 4.5Z', 'M7 10l3 2.5L7 15M12.5 15.5H17'],
  chip: ['M7 7h10v10H7Z', 'M10 3.5V7M14 3.5V7M10 17v3.5M14 17v3.5M3.5 10H7M3.5 14H7M17 10h3.5M17 14h3.5'],
};

type Stop = [offset: number, color: string, opacity: number];

const Stops = ({ stops }: { stops: Stop[] }) => (
  <>
    {stops.map(([o, c, a]) => (
      <stop key={o} offset={o} style={{ stopColor: c, stopOpacity: op(a) }} />
    ))}
  </>
);

const Lin = ({ id, stops, x2 = 0, y2 = 1 }: { id: string; stops: Stop[]; x2?: number; y2?: number }) => (
  <linearGradient id={id} x1="0" y1="0" x2={x2} y2={y2}>
    <Stops stops={stops} />
  </linearGradient>
);

const bob = (c: HiveCell): CSSProperties =>
  ({
    '--bob': (c.amp * 58).toFixed(2),
    animationDelay: `-${((c.ph / (2 * Math.PI)) * 7.39).toFixed(2)}s`,
  }) as CSSProperties;

const scaleAbout = (cx: number, cy: number, s: number, p: readonly (readonly [number, number])[]) =>
  pts(p.map(([x, y]) => [Math.round((cx + (x - cx) * s) * 100) / 100, Math.round((cy + (y - cy) * s) * 100) / 100] as const));

/** One ice cell: its gradients (in a fragment of their own, so they can live in the cell's <g>) and faces. */
function IceCell({ c, id, on = false }: { c: HiveCell; id: string; on?: boolean }) {
  const { top: T, base: B, f, spill, wt } = c;
  const cool = mix(ICE, CYAN, c.cool);
  const sideIds = [0, 1, 2].map((fi) => `${id}s${fi}`);
  const topId = `${id}t`;
  return (
    <g className="hive-bob" style={bob(c)}>
      <defs>
        {c.faces.map(({ e, ws }, fi) => (
          <Lin
            key={fi}
            id={sideIds[fi]}
            stops={[
              [0, mix(mix(STEEL, FROST, 0.4), cool, 0.25 + 0.65 * e), 0.2 + 0.52 * e],
              [0.55, mix(STEEL, cool, 0.35 + 0.5 * e), 0.06 + 0.15 * e],
              [1, mix(cool, HON, ws), 0.12 + 0.52 * e + 0.1 * ws],
            ]}
          />
        ))}
        <Lin
          id={topId}
          x2={1}
          stops={[
            [0, FROST, 0.19 + 0.2 * f],
            [0.55, mix(STEEL, cool, 0.45 + 0.5 * f), 0.07 + 0.17 * f],
            [1, cool, 0.14 + 0.34 * f],
          ]}
        />
      </defs>
      {/* The edges behind the glass, seen through it. */}
      <path
        d={`M${B[3]} L${B[4]} L${B[5]} L${B[0]} M${B[4]} L${T[4]} M${B[5]} L${T[5]}`}
        fill="none"
        strokeWidth={0.9}
        style={{ stroke: mix(STEEL, cool, 0.55), strokeOpacity: op(0.17 + 0.2 * f) }}
      />
      {c.faces.map(({ e, ws }, fi) => (
        <polygon
          key={fi}
          points={pts([T[fi], T[fi + 1], B[fi + 1], B[fi]])}
          fill={`url(#${sideIds[fi]})`}
          strokeWidth={0.9}
          strokeLinejoin="round"
          style={{ stroke: mix(FROST, mix(cool, HON, ws), 0.35), strokeOpacity: op(0.17 + 0.18 * e + 0.12 * ws) }}
        />
      ))}
      <polygon
        points={pts(T)}
        fill={`url(#${topId})`}
        strokeWidth={1}
        strokeLinejoin="round"
        style={{ stroke: mix(mix(FROST, cool, 0.22), HON, wt * 0.7), strokeOpacity: op(0.36 + 0.2 * f) }}
      />
      <polygon
        points={scaleAbout(c.cx, c.cy, 0.8, T)}
        fill="none"
        strokeWidth={0.9}
        strokeLinejoin="round"
        style={{ stroke: FROST, strokeOpacity: 0.1 }}
      />
      <polyline
        points={pts([T[3], T[4], T[5], T[0]])}
        fill="none"
        strokeWidth={1.3}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ stroke: FROST, strokeOpacity: op(0.46 + 0.4 * f) }}
      />
      <polyline
        points={pts([B[0], B[1], B[2], B[3]])}
        fill="none"
        strokeWidth={1.2}
        strokeLinejoin="round"
        style={{ stroke: mix(mix(cool, FROST, 0.2), HON, wt), strokeOpacity: op(0.22 + 0.6 * f) }}
      />
      {c.device && (
        <g transform={`translate(${c.cx} ${Math.round((c.cy + 4) * 100) / 100})`}>
          <ellipse rx={15} ry={Math.round(15 * K * 0.55 * 100) / 100} style={{ fill: SHADE, fillOpacity: 0.42 }} />
          <g
            transform="translate(-13 -25) scale(1.08)"
            fill="none"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ stroke: FROST }}
          >
            <path d={GLYPH[c.device][0]} style={{ fill: mix(PAGE, STEEL, 0.12), fillOpacity: 0.62 }} />
            <path d={GLYPH[c.device][1]} style={{ stroke: spill > 0.3 ? mix(HON, FROST, 0.15) : CYAN }} />
            <circle cx={20} cy={2.4} r={2.1} className="hive-breathe" style={{ fill: CYAN, stroke: 'none' }} />
          </g>
        </g>
      )}
      {/* Pointed at: a honey rim on the lid, drawn in the cell's own place so the cells in front still cover it. */}
      {on && (
        <polygon points={pts(T)} strokeWidth={2.2} strokeLinejoin="round" style={{ fill: HON, fillOpacity: 0.12, stroke: HON, strokeOpacity: 0.95 }} />
      )}
    </g>
  );
}

/** The queen: a tall honey cell under a beam of light, the mark pressed into her lid. */
function QueenCell({ c, ids }: { c: HiveCell; ids: Record<'beam' | 'side' | 'sideR' | 'top', string> }) {
  const { top: T, base: B, cx, cy } = c;
  return (
    <g className="hive-bob" style={bob(c)}>
      <polygon
        points={pts([[cx - R * 0.7, cy - 170], [cx + R * 0.7, cy - 170], [cx + R * 0.98, cy], [cx - R * 0.98, cy]] as const)}
        fill={`url(#${ids.beam})`}
      />
      {[0, 1, 2].map((fi) => (
        <polygon
          key={fi}
          points={pts([T[fi], T[fi + 1], B[fi + 1], B[fi]])}
          fill={`url(#${fi === 0 ? ids.sideR : ids.side})`}
          strokeWidth={1}
          strokeLinejoin="round"
          style={{ stroke: mix(FROST, HON, 0.4), strokeOpacity: 0.55 }}
        />
      ))}
      <polygon points={pts(T)} fill={`url(#${ids.top})`} strokeWidth={1.4} strokeLinejoin="round" style={{ stroke: mix(FROST, HON, 0.2) }} />
      <polyline points={pts([T[3], T[4], T[5], T[0]])} fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ stroke: FROST }} />
      <polyline points={pts([B[0], B[1], B[2], B[3]])} fill="none" strokeWidth={1.6} strokeLinejoin="round" opacity={0.9} style={{ stroke: mix(HON, FROST, 0.4) }} />
      {/* The Hivelink mark, embossed: the same two hexagons as HiveMark, in the queen's own shadow ink. */}
      <g transform={`translate(${cx} ${cy}) scale(1.15 ${Math.round(1.15 * K * 1000) / 1000})`}>
        {/* Pressed deep enough to read: full-strength shadow ink with a pale lip under each stroke, the way
            an engraving catches light - at 0.72 it vanished into the honey on a bright screen. */}
        <g transform="translate(-24 -23)" fill="none" strokeWidth={4} strokeLinejoin="round" opacity={0.55}>
          <path d="M30 11.5 40.8 17.75v12.5L30 36.5 19.2 30.25v-12.5Z" style={{ stroke: FROST }} />
          <path d="M18 11.5 28.8 17.75v12.5L18 36.5 7.2 30.25v-12.5Z" style={{ stroke: FROST }} />
        </g>
        <g transform="translate(-24 -24)" fill="none" strokeWidth={4} strokeLinejoin="round">
          <path d="M30 11.5 40.8 17.75v12.5L30 36.5 19.2 30.25v-12.5Z" style={{ stroke: QINK }} />
          <path d="M18 11.5 28.8 17.75v12.5L18 36.5 7.2 30.25v-12.5Z" style={{ stroke: mix(QINK, DEEP, 0.2) }} />
          <circle cx={24} cy={24} r={2.9} style={{ fill: QINK, stroke: 'none' }} />
        </g>
      </g>
    </g>
  );
}

export interface GlassHiveProps {
  className?: string;
  /** The machine names and "your hive" label over the cells. The landing shows them only where they fit. */
  tags?: boolean;
  /** The machine cell somebody is pointing at (a hive-geometry key), drawn with a honey rim. */
  active?: string | null;
  /** Pointing at a machine cell (with where that cell is on screen), or away from all of them (null).
   *  Without it the hive is only a picture. */
  onPoint?: (key: string | null, at?: DOMRect) => void;
}

export function GlassHive({ className, tags = true, active = null, onPoint }: GlassHiveProps) {
  const id = 'gh' + useId().replace(/[^A-Za-z0-9_-]/g, '');
  const g = (n: string) => id + n;
  const { cells, floor, links, tags: tagList, queen, viewBox: vb } = HIVE;
  const S = R + 7;
  const qTagW = Math.round('YOUR HIVE'.length * 7.5 + 34);
  return (
    <svg
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
      className={cn('glass-hive overflow-visible', className)}
    >
      <defs>
        {/* A warm pool under the queen that cools to ice at the edges. */}
        <radialGradient id={g('floor')}>
          <Stops stops={[[0, AMB, 0.56], [0.17, AMB, 0.19], [0.36, CYAN, 0.15], [0.7, CYAN, 0.05], [1, CYAN, 0]]} />
        </radialGradient>
        <radialGradient id={g('qhalo')}>
          <Stops stops={[[0, mix(HON, FROST, 0.6), 0.95], [0.25, HON, 0.55], [0.6, AMB, 0.15], [1, AMB, 0]]} />
        </radialGradient>
        <radialGradient id={g('qpool')}>
          <Stops stops={[[0, mix(HON, FROST, 0.35), 0.9], [0.3, HON, 0.46], [0.66, AMB, 0.15], [1, AMB, 0]]} />
        </radialGradient>
        <Lin id={g('beam')} stops={[[0, HON, 0], [0.7, mix(HON, FROST, 0.3), 0.08], [1, mix(HON, FROST, 0.45), 0.34]]} />
        <Lin id={g('qside')} stops={[[0, mix(HON, FROST, 0.55), 0.96], [0.45, mix(HON, AMB, 0.55), 0.9], [1, DEEP, 0.88]]} />
        <Lin id={g('qsideR')} stops={[[0, mix(HON, FROST, 0.25), 0.92], [0.45, AMB, 0.88], [1, mix(DEEP, QINK, 0.3), 0.9]]} />
        <radialGradient id={g('qtop')} cx=".45" cy=".42" r=".65">
          <Stops stops={[[0, mix(HON, FROST, 0.8), 1], [0.35, mix(HON, FROST, 0.55), 1], [0.8, mix(HON, AMB, 0.55), 1], [1, AMB, 1]]} />
        </radialGradient>
        {links.map((l, i) => (
          <linearGradient key={l.key} id={g('lk' + i)} gradientUnits="userSpaceOnUse" x1={l.from[0]} y1={l.from[1]} x2={l.to[0]} y2={l.to[1]}>
            {/* Ice-blue at the machine, honey as it reaches the queen. */}
            <Stops stops={[[0, ICE, 0.1], [0.5, CYAN, 0.46], [0.82, HON, 0.62], [1, mix(HON, FROST, 0.4), 0.95]]} />
          </linearGradient>
        ))}
        {links.map((l, i) => (
          <linearGradient key={l.key} id={g('lp' + i)} gradientUnits="userSpaceOnUse" x1={l.from[0]} y1={l.from[1]} x2={l.to[0]} y2={l.to[1]}>
            <Stops stops={[[0, FROST, 0.95], [0.55, ICE, 0.95], [0.82, mix(HON, FROST, 0.3), 1], [1, mix(HON, FROST, 0.5), 1]]} />
          </linearGradient>
        ))}
      </defs>

      {/* Floor: the glow, the receding outlines, and the empty sockets waiting for a machine. */}
      <g>
        <ellipse cx={0} cy={18} rx={S * 6.2} ry={Math.round(S * 6.2 * K * 1.05 * 100) / 100} fill={`url(#${g('floor')})`} />
        {floor.map((f) => (
          <g key={f.X + ',' + f.Y}>
            <polygon
              points={pts(f.outline)}
              strokeWidth={1}
              strokeLinejoin="round"
              style={{
                fill: f.socket ? ICE : 'none',
                fillOpacity: f.socket ? 0.035 : undefined,
                stroke: ICE,
                strokeOpacity: op(f.socket ? 0.32 : 0.24 - (f.d - 4) * 0.075),
              }}
            />
            {f.socket && (
              <>
                <circle cx={f.X} cy={Math.round(f.Y * K * 100) / 100} r={2.4} style={{ fill: ICE, fillOpacity: 0.55 }} />
                <polygon points={pts(f.inner)} fill="none" strokeWidth={1} strokeDasharray="3 4" style={{ stroke: ICE, strokeOpacity: 0.16 }} />
              </>
            )}
          </g>
        ))}
        <ellipse
          className="hive-breathe"
          cx={queen.cx}
          cy={Math.round(queen.Y * K + 6)}
          rx={R * 3.4}
          ry={Math.round(R * 3.4 * K * 100) / 100}
          fill={`url(#${g('qpool')})`}
          style={{ mixBlendMode: 'screen' }}
        />
      </g>

      {/* Cells, back to front. */}
      <g>
        {cells.map((c, i) =>
          c.d === 0 ? (
            <QueenCell key={c.key} c={c} ids={{ beam: g('beam'), side: g('qside'), sideR: g('qsideR'), top: g('qtop') }} />
          ) : (
            <IceCell key={c.key} c={c} id={g('c' + i)} on={c.key === active} />
          ),
        )}
      </g>

      {/* Links from every machine to the queen, with a bright pulse travelling along each. */}
      <g>
        {links.map((l, i) => (
          <g key={l.key}>
            <path d={l.d} fill="none" strokeWidth={1.4} strokeLinecap="round" stroke={`url(#${g('lk' + i)})`} />
            <path
              d={l.d}
              fill="none"
              strokeWidth={2.6}
              strokeLinecap="round"
              stroke={`url(#${g('lp' + i)})`}
              pathLength={100}
              strokeDasharray="4 96"
              className={cn('hive-pulse', l.back && 'hive-pulse-back')}
              style={{ animationDelay: `-${l.delay}s` }}
            />
          </g>
        ))}
        <ellipse
          className="hive-breathe"
          cx={queen.cx}
          cy={queen.cy}
          rx={R * 1.9}
          ry={Math.round(R * 1.9 * K * 100) / 100}
          fill={`url(#${g('qhalo')})`}
          opacity={0.55}
          style={{ mixBlendMode: 'screen' }}
        />
      </g>

      {tags && (
        <g className="hive-tags font-mono">
          {tagList.map((t) => (
            <g key={t.key}>
              <line x1={t.x} y1={t.lineFrom} x2={t.x} y2={t.y + 12} strokeWidth={1} strokeDasharray="2 3" style={{ stroke: ICE, strokeOpacity: 0.45 }} />
              <g transform={`translate(${t.x} ${t.y})`}>
                <rect
                  x={-t.width / 2}
                  y={-12}
                  width={t.width}
                  height={24}
                  rx={12}
                  strokeWidth={1}
                  style={{ fill: mix(PAGE, STEEL, 0.1), fillOpacity: 0.74, stroke: ICE, strokeOpacity: 0.3 }}
                />
                <circle cx={-t.width / 2 + 13} cy={0} r={3} style={{ fill: CYAN }} />
                <text x={-t.width / 2 + 22} y={4} fontSize={11} letterSpacing=".02em" style={{ fill: INK }}>
                  {t.label}
                </text>
              </g>
            </g>
          ))}
          <g transform={`translate(${queen.cx} ${Math.round((queen.cy - 150) * 100) / 100})`}>
            <rect
              x={-qTagW / 2}
              y={-13}
              width={qTagW}
              height={26}
              rx={13}
              strokeWidth={1}
              style={{ fill: AMB, fillOpacity: 0.14, stroke: HON, strokeOpacity: 0.55 }}
            />
            <text x={0} y={4.2} fontSize={11} textAnchor="middle" letterSpacing=".08em" style={{ fill: mix(HON, FROST, 0.5) }}>
              YOUR HIVE
            </text>
          </g>
        </g>
      )}
      {/* WHERE A POINTER CAN LAND: one invisible prism outline per machine cell, on top of everything so the
          links and tags never steal it, bobbing with its cell so it stays under the glass it belongs to. The
          active one gets a honey rim on its top face - the same honey the queen is lit with, because the
          queen is who it reports to. Tap toggles, for screens with no hover. */}
      {onPoint && (
        <g>
          {cells
            .filter((c) => c.device)
            .map((c) => {
              const t = c.top;
              const b = c.base;
              const on = c.key === active;
              return (
                <g key={c.key} className="hive-bob" style={bob(c)}>
                  <polygon
                    points={pts([t[3], t[4], t[5], t[0], b[0], b[1], b[2], b[3]])}
                    className="hive-hit"
                    onPointerEnter={(e) => e.pointerType === 'mouse' && onPoint(c.key, e.currentTarget.getBoundingClientRect())}
                    onClick={(e) => onPoint(on ? null : c.key, e.currentTarget.getBoundingClientRect())}
                  />
                </g>
              );
            })}
        </g>
      )}
    </svg>
  );
}
