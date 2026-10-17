/* Typed attributes for a demo cue - `<li {...cue(4200, 'rise')}>` - so a section never misspells the
 * attribute names the engine and motion.css read. See timeline.ts for what they mean. */
export type CueFx = 'fade' | 'rise' | 'rise-lg' | 'pop' | 'left' | 'right' | 'none';

export interface CueAttrs {
  'data-cue': number;
  'data-cue-out'?: number;
  'data-fx'?: CueFx;
}

/** Appear at `at` ms (and leave at `out` ms), entering with `fx` (default fade). */
export function cue(at: number, fx?: CueFx, out?: number): CueAttrs {
  const attrs: CueAttrs = { 'data-cue': Math.round(at) };
  if (fx && fx !== 'fade') attrs['data-fx'] = fx;
  if (out !== undefined) attrs['data-cue-out'] = Math.round(out);
  return attrs;
}

/** 70ms apart, capped at six steps: the delay of the n-th sibling in a stagger (the page's one rule). */
export const stagger = (n: number, step = 70) => Math.min(Math.max(n, 0), 6) * step;
