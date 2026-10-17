/* The illustration colours as CSS values, for SVG style attributes.
 *
 * The colours themselves live in brand.css as --hive-* variables; this only names them and mixes them. A
 * mix is color-mix() rather than arithmetic on hex, so the palette is never restated in script, and the
 * strings are pure functions of their weights - identical on the server and in the browser, which is what
 * lets the hive hydrate without a mismatch.
 *
 * Opacity is NOT folded into the colour: SVG has fill-opacity, stroke-opacity and stop-opacity for that,
 * and keeping them apart keeps every value below a plain colour that color-mix() can nest.
 */
export type HiveInk =
  | 'frost' | 'ice' | 'ice-hi' | 'ice-2' | 'steel'
  | 'honey' | 'amber' | 'amber-deep' | 'queen-ink'
  | 'page' | 'ink' | 'shade';

export const ink = (name: HiveInk) => `hsl(var(--hive-${name}))`;

/** `a` moved `t` of the way towards `b`, as the concept's mix(a, b, t) did with RGB triples. */
export const mix = (a: string, b: string, t: number): string => {
  if (t <= 0) return a;
  if (t >= 1) return b;
  return `color-mix(in srgb, ${a}, ${b} ${(t * 100).toFixed(1)}%)`;
};

/** An opacity, clamped and rounded so the server and the client print the same digits. */
export const op = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 1000) / 1000;
