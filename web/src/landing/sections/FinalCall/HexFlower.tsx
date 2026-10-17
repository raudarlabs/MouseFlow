/* THE HEX FLOWER: the hero's hive one last time, in miniature - six frosted ice columns round one honey
 * queen. The page opened on "Every machine. One hive." and closes on the same picture, small enough to sit
 * over a form: a few of the machines (a PC, a Mac, a test VM) on their cells, and the queen they report to,
 * with her light spilling onto the glass that faces her.
 *
 * DRAWN THE HERO'S WAY, SEVEN CELLS INSTEAD OF THIRTY. The cells are the hero's IceCell and QueenCell
 * recipes (GlassHive.tsx) - columns of a storey or so on a common floor, side faces mixed from frost, steel
 * and ice by how lit they are, warmed by how squarely they face the queen, a bright rim on the near edges -
 * with a lid of 26 units instead of 50. They are restated here rather than imported because GlassHive keeps them
 * private to its own hive; brand/'s single GlassCell is a short icon prism with a glyph socket, which read as
 * a tray of pucks at this size rather than as the hive.
 *
 * WHY TEN LAYERS AND NOT ONE SVG. The flower assembles on entry - each outer column slides in along its
 * own axis, the queen settles last and her light comes on (FinalCall.css). A transform on an SVG <g> is
 * painted on the main thread; on an HTML box it is composited. So every cell is its own full-size layer,
 * an <svg> sharing one viewBox, stacked back to front in DOM order: the isometric overlap needs no
 * z-index, and every layer scales with the art box (152px tall on a phone, 176 from 768, 200 from 1200)
 * without a measurement. Each layer carries its own transform-origin (its lid) and its own entrance
 * offset, both as percentages of that box.
 *
 * Colours are the brand's illustration inks (hive-ink.ts), never literals, and the geometry is constants
 * rounded at module load, so the server and the browser print the same markup. Decorative: aria-hidden -
 * the heading under it says what it means.
 */
import { useId, type CSSProperties, type ReactNode } from 'react';
import { K } from '@/components/brand/hive-geometry';
import { ink, mix, op } from '@/components/brand/hive-ink';

const FROST = ink('frost');
const ICE = ink('ice');
const CYAN = ink('ice-2');
const STEEL = ink('steel');
const HON = ink('honey');
const AMB = ink('amber');
const DEEP = ink('amber-deep');
const QINK = ink('queen-ink');
const PAGE = ink('page');
const SHADE = ink('shade');

/** Lid circumradius; the hero's is 50. */
const R = 26;
/** A storey, in units: the hero's U (58) at this lid. */
const U = Math.round(58 * (R / 50) * 100) / 100;
/** Neighbour spacing: the hero's gap (7 on 50) scaled with the lid. */
const STEP = Math.sqrt(3) * R * (57 / 50);

const r2 = (n: number) => Math.round(n * 100) / 100;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

type Pt = readonly [number, number];
const pts = (p: readonly Pt[]) => p.map((q) => q[0] + ',' + q[1]).join(' ');

/* The machine glyphs: the hero's own 24-unit line art (GlassHive's GLYPH), body | accent stroke. */
const GLYPH = {
  desktop: ['M3.5 4.5h17a1 1 0 0 1 1 1v9.5a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1Z', 'M12 16v3.5M8 20h8'],
  laptop: ['M5 6.5h14a1 1 0 0 1 1 1V16H4V7.5a1 1 0 0 1 1-1Z', 'M2.5 18.5h19'],
  server: [
    'M4.5 3.5h15a1 1 0 0 1 1 1v5h-17v-5a1 1 0 0 1 1-1ZM3.5 13h17v6a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1Z',
    'M7 6.7h.01M7 16.5h.01M10.5 6.7h6M10.5 16.5h6',
  ],
} as const;

type Device = keyof typeof GLYPH;

/* The ring, clockwise from the top - the order the cells settle in. `angle` is on the unsquashed floor
   (270° straight back, 90° straight forward), `z` the column's height in storeys (the hero's ring-one
   range, a little shorter - 0.6-1.1 under the queen's 1.45 - so seven columns read as one flower, not a
   stand of pillars). Four carry a machine; the two in front stay clear glass, so the queen's face reads
   through them. */
const RING: { angle: number; z: number; device?: Device }[] = [
  { angle: 270, z: 1.02, device: 'desktop' },
  { angle: 330, z: 0.9, device: 'server' },
  { angle: 30, z: 0.96, device: 'laptop' },
  { angle: 90, z: 0.62 },
  { angle: 150, z: 0.78 },
  { angle: 210, z: 1.1, device: 'laptop' },
];
const QUEEN_Z = 1.45;

/** A hexagon of circumradius r round (x, y), squashed by K: the six corners, right corner first, clockwise
    on screen (so 0-1, 1-2 and 2-3 are the three faces the viewer sees). */
const hex = (x: number, y: number, r = R): Pt[] =>
  [0, 1, 2, 3, 4, 5].map((i) => {
    const a = (i * Math.PI) / 3;
    return [r2(x + r * Math.cos(a)), r2(y + r * Math.sin(a) * K)] as const;
  });

/* Each visible face's outward normal on the floor (deg), and how lit it is from the page's light. */
const FACES = [
  { normal: 30, e: 0.55 },
  { normal: 90, e: 0.8 },
  { normal: 150, e: 0.36 },
];

interface Cell {
  k: number;
  x: number;
  y: number;
  z: number;
  device?: Device;
  T: Pt[];
  B: Pt[];
  /** Per visible face: lit, and honey from the queen. */
  faces: { e: number; ws: number }[];
}

const SPILL = 0.62;

const cells: Cell[] = RING.map((c, k) => {
  const a = (c.angle * Math.PI) / 180;
  const x = r2(STEP * Math.cos(a));
  const y = r2(STEP * Math.sin(a) * K);
  const lid = r2(y - c.z * U);
  /* The queen is at the centre, opposite the cell's own direction: a face warms by how squarely it turns
     towards her. */
  const toQueen = c.angle + 180;
  const faces = FACES.map((f) => ({
    e: f.e,
    ws: r3(SPILL * Math.max(0, Math.cos(((f.normal - toQueen) * Math.PI) / 180))),
  }));
  return { k, x, y, z: c.z, device: c.device, T: hex(x, lid), B: hex(x, y), faces };
});

const QT = hex(0, r2(-QUEEN_Z * U));
const QB = hex(0, 0);

/* The art's frame: every corner, the glyphs standing on the lids, and a little air. */
const corners = [...cells.flatMap((c) => [...c.T, ...c.B]), ...QT, ...QB];
const X0 = Math.min(...corners.map((p) => p[0])) - 4;
const X1 = Math.max(...corners.map((p) => p[0])) + 4;
const Y0 = Math.min(...corners.map((p) => p[1]), ...cells.filter((c) => c.device).map((c) => c.T[0][1] - 16)) - 4;
const Y1 = Math.max(...corners.map((p) => p[1])) + 8;
const VW = r2(X1 - X0);
const VH = r2(Y1 - Y0);
const VIEWBOX = `${r2(X0)} ${r2(Y0)} ${VW} ${VH}`;

const pct = (v: number, from: number, of: number) => `${r3(((v - from) / of) * 100)}%`;

type Stop = [offset: number, color: string, opacity: number];

const Lin = ({ id, stops, x2 = 0, y2 = 1 }: { id: string; stops: Stop[]; x2?: number; y2?: number }) => (
  <linearGradient id={id} x1="0" y1="0" x2={x2} y2={y2}>
    {stops.map(([o, c, a]) => (
      <stop key={o} offset={o} style={{ stopColor: c, stopOpacity: op(a) }} />
    ))}
  </linearGradient>
);

/** A layer: the full art box, one viewBox, so every layer lines up with every other. */
const Layer = ({ className, style, children }: { className: string; style?: CSSProperties; children: ReactNode }) => (
  <svg viewBox={VIEWBOX} preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false" className={className} style={style}>
    {children}
  </svg>
);

/** One ice column: the hero's IceCell recipe at a 26-unit lid, near the queen (f = .85, pale ice). */
function IceColumn({ c, id }: { c: Cell; id: string }) {
  const { T, B } = c;
  const f = 0.85;
  const cool = mix(ICE, CYAN, 0.3);
  const wt = SPILL * 0.5;
  const top = id + 't';
  const side = (fi: number) => id + 's' + fi;
  const lidX = r2(T[0][0] - R);
  const lidY = T[0][1];
  return (
    <>
      <defs>
        {c.faces.map(({ e, ws }, fi) => (
          <Lin
            key={fi}
            id={side(fi)}
            stops={[
              [0, mix(mix(STEEL, FROST, 0.4), cool, 0.25 + 0.65 * e), 0.2 + 0.52 * e],
              [0.55, mix(STEEL, cool, 0.35 + 0.5 * e), 0.06 + 0.15 * e],
              [1, mix(cool, HON, ws), 0.12 + 0.52 * e + 0.1 * ws],
            ]}
          />
        ))}
        <Lin
          id={top}
          x2={1}
          stops={[
            [0, FROST, 0.19 + 0.2 * f],
            [0.55, mix(STEEL, cool, 0.45 + 0.5 * f), 0.07 + 0.17 * f],
            [1, cool, 0.14 + 0.34 * f],
          ]}
        />
      </defs>
      {/* Its light on the floor. */}
      <ellipse cx={c.x} cy={r2(c.y + 3)} rx={R * 1.05} ry={r2(R * K * 1.05)} style={{ fill: CYAN, fillOpacity: 0.07 }} />
      {/* The edges behind the glass, seen through it. */}
      <path
        d={`M${B[3]} L${B[4]} L${B[5]} L${B[0]} M${B[4]} L${T[4]} M${B[5]} L${T[5]}`}
        fill="none"
        strokeWidth={0.7}
        style={{ stroke: mix(STEEL, cool, 0.55), strokeOpacity: op(0.17 + 0.2 * f) }}
      />
      {c.faces.map(({ e, ws }, fi) => (
        <polygon
          key={fi}
          points={pts([T[fi], T[fi + 1], B[fi + 1], B[fi]])}
          fill={`url(#${side(fi)})`}
          strokeWidth={0.7}
          strokeLinejoin="round"
          style={{ stroke: mix(FROST, mix(cool, HON, ws), 0.35), strokeOpacity: op(0.17 + 0.18 * e + 0.12 * ws) }}
        />
      ))}
      <polygon
        points={pts(T)}
        fill={`url(#${top})`}
        strokeWidth={0.8}
        strokeLinejoin="round"
        style={{ stroke: mix(mix(FROST, cool, 0.22), HON, wt * 0.7), strokeOpacity: op(0.36 + 0.2 * f) }}
      />
      <polygon points={pts(hex(lidX, lidY, R * 0.8))} fill="none" strokeWidth={0.7} strokeLinejoin="round" style={{ stroke: FROST, strokeOpacity: 0.1 }} />
      <polyline
        points={pts([T[3], T[4], T[5], T[0]])}
        fill="none"
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ stroke: FROST, strokeOpacity: op(0.46 + 0.4 * f) }}
      />
      <polyline
        points={pts([B[0], B[1], B[2], B[3]])}
        fill="none"
        strokeWidth={0.9}
        strokeLinejoin="round"
        style={{ stroke: mix(mix(cool, FROST, 0.2), HON, wt), strokeOpacity: op(0.22 + 0.6 * f) }}
      />
      {c.device && (
        <g transform={`translate(${lidX} ${r2(lidY + 2)})`}>
          <ellipse rx={7.8} ry={r2(7.8 * K * 0.55)} style={{ fill: SHADE, fillOpacity: 0.32 }} />
          <g transform="translate(-6.76 -13) scale(.56)" fill="none" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" style={{ stroke: FROST }}>
            <path d={GLYPH[c.device][0]} style={{ fill: mix(PAGE, STEEL, 0.12), fillOpacity: 0.62 }} />
            <path d={GLYPH[c.device][1]} style={{ stroke: CYAN }} />
            <circle cx={20} cy={2.4} r={2.1} style={{ fill: CYAN, stroke: 'none' }} />
          </g>
        </g>
      )}
    </>
  );
}

/** The queen: a honey column a storey and a half tall, the Hivelink mark pressed into her lid - the
    hero's QueenCell at a 26-unit lid. */
function QueenColumn({ id }: { id: string }) {
  const side = id + 's';
  const sideR = id + 'r';
  const top = id + 't';
  const cy = QT[0][1];
  const mark = r3((1.15 * R) / 50);
  return (
    <>
      <defs>
        <Lin id={side} stops={[[0, mix(HON, FROST, 0.55), 0.96], [0.45, mix(HON, AMB, 0.55), 0.9], [1, DEEP, 0.88]]} />
        <Lin id={sideR} stops={[[0, mix(HON, FROST, 0.25), 0.92], [0.45, AMB, 0.88], [1, mix(DEEP, QINK, 0.3), 0.9]]} />
        <radialGradient id={top} cx=".45" cy=".42" r=".65">
          <stop offset="0" style={{ stopColor: mix(HON, FROST, 0.8) }} />
          <stop offset=".35" style={{ stopColor: mix(HON, FROST, 0.55) }} />
          <stop offset=".8" style={{ stopColor: mix(HON, AMB, 0.55) }} />
          <stop offset="1" style={{ stopColor: AMB }} />
        </radialGradient>
      </defs>
      {[0, 1, 2].map((fi) => (
        <polygon
          key={fi}
          points={pts([QT[fi], QT[fi + 1], QB[fi + 1], QB[fi]])}
          fill={`url(#${fi === 0 ? sideR : side})`}
          strokeWidth={0.8}
          strokeLinejoin="round"
          style={{ stroke: mix(FROST, HON, 0.4), strokeOpacity: 0.55 }}
        />
      ))}
      <polygon points={pts(QT)} fill={`url(#${top})`} strokeWidth={1} strokeLinejoin="round" style={{ stroke: mix(FROST, HON, 0.2) }} />
      <polyline points={pts([QT[3], QT[4], QT[5], QT[0]])} fill="none" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" style={{ stroke: FROST }} />
      <polyline points={pts([QB[0], QB[1], QB[2], QB[3]])} fill="none" strokeWidth={1.1} strokeLinejoin="round" opacity={0.9} style={{ stroke: mix(HON, FROST, 0.4) }} />
      {/* The mark, embossed: a pale lip under each stroke, then the stroke in the queen's own ink. */}
      <g transform={`translate(0 ${cy}) scale(${mark} ${r3(mark * K)})`}>
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
    </>
  );
}

/** The floor the flower stands on: the next ring of the hive as faint outlines, fading outwards, and a
    pool of the queen's light. Static. */
function Floor({ id }: { id: string }) {
  const outer = [0, 1, 2, 3, 4, 5].flatMap((i) => {
    const a = ((i * 60 + 30) * Math.PI) / 180;
    const b = ((i * 60 + 150) * Math.PI) / 180;
    const corner: Pt = [2 * STEP * Math.cos(a), 2 * STEP * Math.sin(a)];
    const mid: Pt = [corner[0] + STEP * Math.cos(b), corner[1] + STEP * Math.sin(b)];
    return [corner, mid];
  });
  return (
    <>
      <defs>
        <radialGradient id={id}>
          <stop offset="0" style={{ stopColor: AMB, stopOpacity: 0.5 }} />
          <stop offset=".2" style={{ stopColor: AMB, stopOpacity: 0.16 }} />
          <stop offset=".42" style={{ stopColor: CYAN, stopOpacity: 0.12 }} />
          <stop offset=".75" style={{ stopColor: CYAN, stopOpacity: 0.03 }} />
          <stop offset="1" style={{ stopColor: CYAN, stopOpacity: 0 }} />
        </radialGradient>
      </defs>
      <ellipse cx={0} cy={6} rx={r2(STEP * 2.6)} ry={r2(STEP * 2.6 * K)} fill={`url(#${id})`} />
      {outer.map(([x, y], i) => (
        <polygon
          key={i}
          points={pts(hex(r2(x), r2(y * K)))}
          fill="none"
          strokeWidth={0.7}
          strokeLinejoin="round"
          strokeDasharray={i % 2 ? '2 3' : undefined}
          style={{ stroke: ICE, strokeOpacity: 0.1 }}
        />
      ))}
    </>
  );
}

const QUEEN_X = pct(0, X0, VW);
const QUEEN_Y = pct(QT[0][1], Y0, VH);

export function HexFlower({ className }: { className?: string }) {
  const id = 'fl' + useId().replace(/[^A-Za-z0-9_-]/g, '');
  const order = [...cells].sort((a, b) => a.y - b.y || a.x - b.x);
  const column = (c: Cell) => {
    /* Where its entrance starts: 82% of its distance back out along its own axis, as a share of the box. */
    const style = {
      '--k': c.k,
      '--tx': `${r3((c.x * 0.82 * 100) / VW)}%`,
      '--ty': `${r3((c.y * 0.82 * 100) / VH)}%`,
      transformOrigin: `${pct(c.x, X0, VW)} ${pct(c.T[0][1], Y0, VH)}`,
    } as CSSProperties;
    return (
      <Layer key={c.k} className="hl-fc-layer hl-fc-cell hl-entrance" style={style}>
        <IceColumn c={c} id={`${id}c${c.k}`} />
      </Layer>
    );
  };
  const glowAt = { '--qx': QUEEN_X, '--qy': QUEEN_Y } as CSSProperties;
  return (
    <div className={className} aria-hidden="true" style={{ aspectRatio: `${VW} / ${VH}`, ...glowAt }}>
      <Layer className="hl-fc-layer hl-fc-floor">
        <Floor id={`${id}f`} />
      </Layer>
      {order.filter((c) => c.y < 0).map(column)}
      <span className="hl-fc-beam hl-entrance" />
      <Layer className="hl-fc-layer hl-fc-cell hl-fc-cell--queen hl-entrance" style={{ transformOrigin: `${QUEEN_X} ${QUEEN_Y}` }}>
        <QueenColumn id={`${id}q`} />
      </Layer>
      <span className="hl-fc-halo hl-entrance" />
      {order.filter((c) => c.y > 0).map(column)}
    </div>
  );
}
