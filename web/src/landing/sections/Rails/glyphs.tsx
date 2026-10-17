/* The six rails' glyphs: 24-unit line art that stands on a GlassCell's lid, as the brand's cells always
 * carry theirs. Frost for the object, ice-2 (GlassCellAccent) for the part that is the rule - the strike,
 * the pause, the no-entry, the way out, the eye - and the one honey core on the switch that is yours.
 * Colours come from the cell's own helpers, so nothing here names one.
 */
import type { ReactNode } from 'react';
import { GlassCellAccent, GlassCellCore, GlassCellPanel } from '@/components/brand/GlassCell';

const SCREEN = 'M3 5.5A1.5 1.5 0 0 1 4.5 4h15A1.5 1.5 0 0 1 21 5.5v9A1.5 1.5 0 0 1 19.5 16h-15A1.5 1.5 0 0 1 3 14.5Z';
const BUBBLE = 'M3 5.5A2 2 0 0 1 5 3.5h10a2 2 0 0 1 2 2V11a2 2 0 0 1-2 2H9.5L6 16v-3H5a2 2 0 0 1-2-2Z';
const HEX = 'M10 5.2 15.2 8.2v6L10 17.2 4.8 14.2v-6Z';
const TOGGLE = 'M2.5 12A4.5 4.5 0 0 1 7 7.5h10a4.5 4.5 0 0 1 0 9H7A4.5 4.5 0 0 1 2.5 12Z';

export const RAIL_GLYPHS: Record<'key' | 'oneway' | 'speech' | 'out' | 'switch' | 'watch', ReactNode> = {
  /* a key, struck through: it never types one */
  key: (
    <>
      <path d="M7.5 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7Z" />
      <path d="M11 12h9M17.5 12v2.8M20 12v2" />
      <GlassCellAccent d="M4 20 20 4" />
    </>
  ),
  /* a one-way arrow that stops at a pause */
  oneway: (
    <>
      <path d="M2.5 12h10M9.5 8.5 13 12l-3.5 3.5" />
      <GlassCellAccent d="M17 7.5v9M20.5 7.5v9" />
    </>
  ),
  /* a speech mark with a no-entry sign: what the screen says is not an order */
  speech: (
    <>
      <GlassCellPanel d={BUBBLE} />
      <path d={BUBBLE} />
      <path d="M7 7.5h6M7 10h3.5" />
      <GlassCellAccent d="M18 13.2a3.6 3.6 0 1 0 0 7.2a3.6 3.6 0 1 0 0-7.2ZM16.2 16.8h3.6" />
    </>
  ),
  /* an arrow leaving a cell: the agent dials out, nothing comes in */
  out: (
    <>
      <GlassCellPanel d={HEX} />
      <path d={HEX} />
      <GlassCellAccent d="M10.5 11.2 20 3.8M15.6 3.6H20.2v4.6" />
    </>
  ),
  /* the local switch, its knob the one warm thing: yours */
  switch: (
    <>
      <GlassCellPanel d={TOGGLE} />
      <path d={TOGGLE} />
      <GlassCellCore cx={16.6} cy={12} r={2.7} />
    </>
  ),
  /* an eye inside a framed screen: a border while it drives, a record afterwards */
  watch: (
    <>
      <GlassCellPanel d={SCREEN} />
      <path d={SCREEN} />
      <path d="M8.5 20h7" />
      <GlassCellAccent d="M6.8 10s2-3.2 5.2-3.2 5.2 3.2 5.2 3.2-2 3.2-5.2 3.2S6.8 10 6.8 10ZM12 8.9a1.1 1.1 0 1 0 0 2.2a1.1 1.1 0 1 0 0-2.2Z" />
    </>
  ),
};
