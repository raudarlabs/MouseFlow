/* The glass hive's geometry: where every cell, socket, link and tag sits, computed once at module load.
 *
 * PORTED FROM THE CONCEPT'S SCRIPT (hivelink/concepts/05d-glasshive-arctic/index.html), which built the
 * same honeycomb into the DOM on the client and then moved it every frame. Here it is data: the same seeded
 * generator in the same call order, so the heights are the concept's heights, and nothing below depends on
 * the window, the clock or Math.random. That is what lets the landing render the hive on the server and
 * hydrate it without a mismatch - the server and the browser compute byte-identical numbers - and it is why
 * the motion is CSS (see brand.css) rather than a requestAnimationFrame loop rewriting `points`.
 *
 * NO COLOURS HERE. A cell's lighting is expressed as WEIGHTS - how much of the queen's warm light it
 * catches, how lit each face is - and GlassHive.tsx turns weights into colours by mixing the palette's
 * variables. So the palette stays in one stylesheet, and this file stays importable by node (web/check-web
 * runs it to hold the determinism): no React, no alias, no imports at all.
 */

export type DeviceKind = 'laptop' | 'desktop' | 'server' | 'terminal' | 'chip';

export type Pt = readonly [number, number];

export interface HiveCell {
  key: string;
  /** Ring distance from the queen: 0 is the queen herself. */
  d: number;
  X: number;
  Y: number;
  /** Rest height, in storeys of U. */
  z0: number;
  /** Bob amplitude in storeys, and the phase it starts at (radians). */
  amp: number;
  ph: number;
  device?: DeviceKind;
  tag?: string;
  top: Pt[];
  base: Pt[];
  cx: number;
  cy: number;
  /** Falloff of the queen's light at this cell, 1 next to her and towards 0 at the rim. */
  f: number;
  /** Ice to ice-2: 0 is pale ice near the core, 1 cyan towards the rim. */
  cool: number;
  /** Warm spill from the queen, 0..1. */
  spill: number;
  /** Per side face (the three visible ones): how lit it is, and how much honey reaches it. */
  faces: { e: number; ws: number }[];
  /** Honey on the top rim and the foot. */
  wt: number;
}

export interface FloorCell {
  X: number;
  Y: number;
  d: number;
  socket: boolean;
  outline: Pt[];
  inner: Pt[];
}

export interface HiveLink {
  key: string;
  d: string;
  from: Pt;
  to: Pt;
  /** Every third pulse runs back towards the machine, as the concept's did. */
  back: boolean;
  delay: number;
}

export interface HiveTag {
  key: string;
  label: string;
  x: number;
  y: number;
  lineFrom: number;
  width: number;
}

/* The concept's constants, unchanged: hex radius, gap, isometric squash, storey height, solid rings. */
export const R = 50;
const GAP = 7;
const S = R + GAP;
export const K = 0.56;
export const U = 58;
const SQ3 = Math.sqrt(3);
const N = 3;

/* Park-Miller, seeded with the day the look was chosen. Called in exactly the concept's order - z0 then
 * phase then amplitude, cell by cell - because reordering the calls would silently give a different hive. */
const rng = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

const ANG = [0, 1, 2, 3, 4, 5].map((i) => (i * Math.PI) / 3);
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const round = (v: number) => Math.round(v * 100) / 100;

/** Empty slots waiting for a machine, and slots outside the silhouette. */
const SOCKETS = new Set(['3,-3', '-3,1', '0,3', '-2,-1', '2,1']);
const GONE = new Set(['-3,3', '3,0']);
const DEVICES: Record<string, DeviceKind> = {
  '-1,0': 'laptop', '1,-1': 'server', '0,1': 'terminal', '-2,2': 'desktop', '2,-2': 'chip',
  '-1,-2': 'desktop', '2,0': 'laptop', '-3,2': 'server', '1,2': 'server', '0,-2': 'terminal',
};
/** The three machines the terminal card talks about, named on the hive itself. */
export const TAGS: Record<string, string> = { '-2,2': 'finance-pc', '2,-2': 'mac-studio', '1,2': 'qa-vm-1' };

const ring = (X: number, Y: number, r: number, z: number): Pt[] =>
  ANG.map((a) => [round(X + r * Math.cos(a)), round(Y * K + r * Math.sin(a) * K - z * U)] as const);

function buildHive() {
  const rnd = rng(20261016);
  const cells: Omit<HiveCell, 'top' | 'base' | 'cx' | 'cy' | 'f' | 'cool' | 'spill' | 'faces' | 'wt'>[] = [];
  const floor: FloorCell[] = [];
  for (let q = -7; q <= 7; q++) {
    for (let r = -7; r <= 7; r++) {
      const d = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
      if (d > 6) continue;
      const X = S * 1.5 * q;
      const Y = S * SQ3 * (r + q / 2);
      const key = q + ',' + r;
      if (d <= N && !SOCKETS.has(key) && !GONE.has(key)) {
        /* The queen stands only a storey above her ring: taller than her neighbours, so she reads as the centre,
         * but not a tower - the concept's 2.55 storeys turned her into a column that swallowed the mark on her lid. */
        const z0 = d === 0 ? 1.6 : d === 1 ? 1.02 + rnd() * 0.42 : d === 2 ? 0.58 + rnd() * 0.5 : 0.26 + rnd() * 0.4;
        const ph = rnd() * 6.283;
        const amp = d === 0 ? 0.05 : 0.07 + rnd() * 0.05;
        cells.push({ key, d, X, Y, z0, ph, amp, device: DEVICES[key], tag: TAGS[key] });
      } else if (!GONE.has(key)) {
        const socket = SOCKETS.has(key);
        floor.push({ X, Y, d, socket, outline: ring(X, Y, R, 0), inner: ring(X, Y, R * 0.62, 0) });
      }
    }
  }
  cells.sort((a, b) => a.Y - b.Y || a.X - b.X);

  /* The frame: the solid cluster at the top of its bob, plus the queen's crown. */
  let minX = 1e9;
  let maxX = -1e9;
  let minY = 1e9;
  let maxY = -1e9;
  for (const c of cells) {
    for (const p of [...ring(c.X, c.Y, R, c.z0 + c.amp + (c.d === 0 ? 0.9 : 0.35)), ...ring(c.X, c.Y, R, 0)]) {
      minX = Math.min(minX, p[0]);
      maxX = Math.max(maxX, p[0]);
      minY = Math.min(minY, p[1]);
      maxY = Math.max(maxY, p[1]);
    }
  }
  const viewBox = { x: round(minX - 24), y: round(minY - 24), w: round(maxX - minX + 48), h: round(maxY - minY + 48) };

  /* Lighting, as weights. The same formulas as the concept, minus the colour arithmetic. */
  const rimX = S * 1.5 * N;
  const shade = [0.82, 1, 1.16];
  const lit: HiveCell[] = cells.map((c) => {
    const top = ring(c.X, c.Y, R, c.z0);
    const base = ring(c.X, c.Y, R, 0);
    const cx = c.X;
    const cy = round(c.Y * K - c.z0 * U);
    if (c.d === 0) return { ...c, top, base, cx, cy, f: 1, cool: 0, spill: 1, faces: [], wt: 1 };
    const dist = Math.hypot(c.X, c.Y) / S;
    const f = 1 / (1 + 0.42 * dist * dist);
    const cool = clamp((dist / 3.6) * 0.8 + (c.X / rimX) * 0.28 + 0.04);
    const spill = clamp(f * 1.2 - 0.1);
    const D = [-c.X / (dist * S), -c.Y / (dist * S)];
    const faces = [0, 1, 2].map((fi) => {
      const na = ((30 + 60 * fi) * Math.PI) / 180;
      const nd = Math.cos(na) * D[0] + Math.sin(na) * D[1];
      return {
        e: f * (0.55 + 0.45 * clamp(nd)) * shade[fi],
        /* Warmth lands as light, not as tint: the glass stays ice, its foot and its edges catch honey. */
        ws: clamp((spill * (0.2 + 0.8 * clamp(nd)) - 0.05) * 2.6),
      };
    });
    return { ...c, top, base, cx, cy, f, cool, spill, faces, wt: clamp((spill - 0.1) * 2.2) };
  });

  const queen = lit.find((c) => c.d === 0)!;
  const links: HiveLink[] = lit
    .filter((c) => c.device)
    .map((c, i) => {
      const x1 = c.cx;
      const y1 = round(c.cy - 22);
      const x2 = queen.cx;
      const y2 = round(queen.cy - 4);
      const mx = round((x1 + x2) / 2);
      const my = round(Math.min(y1, y2) - 46 - Math.hypot(x2 - x1, y2 - y1) * 0.18);
      return {
        key: c.key,
        d: `M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}`,
        from: [x1, y1] as const,
        to: [x2, y2] as const,
        back: i % 3 === 1,
        delay: round(i * 0.83),
      };
    });

  const tags: HiveTag[] = lit
    .filter((c) => c.tag)
    .map((c) => ({
      key: c.key,
      label: c.tag!,
      x: c.cx,
      y: round(c.cy - 78),
      lineFrom: round(c.cy - 30),
      width: round(c.tag!.length * 6.7 + 30),
    }));

  return { cells: lit, floor, links, tags, queen, viewBox };
}

export const HIVE = buildHive();

export const pts = (a: readonly Pt[]) => a.map((p) => p[0] + ',' + p[1]).join(' ');
