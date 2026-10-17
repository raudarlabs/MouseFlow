/* The products' marks, drawn once.
 *
 * THE HIVE MARK is the first product's, from the chosen concept (hivelink/concepts/05d-glasshive-arctic,
 * its <symbol id="mark">): two linked hexagons, honey and ice, with a dot where they meet. The landing and
 * the app draw the same one, which is the point of having one design system rather than two that agree.
 *
 * LINKED, NOT STACKED. Each hexagon is cut where the other one passes over it - the honey crosses on top,
 * the ice crosses at the bottom - so the two read as a chain. The cuts are masks, and the masks and the
 * gradients need ids; a page can show this mark more than once (the landing has it in its header and its
 * footer), and with a fixed id every copy's `url(#...)` resolves to the FIRST element of that id in the
 * document - so they all paint with one copy's defs, and when that copy sits somewhere hidden, a
 * display:none breakpoint or a closed menu, the others can paint with nothing. Hence useId, made safe for a
 * url(): React's ids carry characters a fragment reference does not want.
 *
 * COLOURS ARE TOKENS, not the concept's hex: the honey hexagon is upstream's --logo-mark with
 * --brand-tertiary above it, the ice one reads --logo-ice-from/--logo-ice-to, the dot is --ink-primary. On
 * the dark page that is exactly the concept's honey, amber, frost and ice-2; on light paper the same tokens
 * are re-lit (see mouseflow-palette.css), because frost on white is not a mark, it is a gap.
 *
 * Sized by className, like a lucide icon; aria-hidden, because it always sits beside the product's name.
 */
import { useId } from 'react';
import { cn } from '@insightis/ui/cn';
import type { Product } from '@/lib/product';

interface MarkProps {
  className?: string;
}

/** The hexagon outlines, in the concept's 48-unit box. */
const HONEY_CELL = 'M18 11.5 28.8 17.75v12.5L18 36.5 7.2 30.25v-12.5Z';
const ICE_CELL = 'M30 11.5 40.8 17.75v12.5L30 36.5 19.2 30.25v-12.5Z';

export const HiveMark = ({ className }: MarkProps) => {
  const id = 'hm' + useId().replace(/[^A-Za-z0-9_-]/g, '');
  const honey = id + 'h';
  const ice = id + 'i';
  const cutHoney = id + 'ch';
  const cutIce = id + 'ci';
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false" className={className}>
      <defs>
        <linearGradient id={honey} x1="6" y1="10" x2="30" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: 'hsl(var(--brand-tertiary))' }} />
          <stop offset="1" style={{ stopColor: 'hsl(var(--logo-mark))' }} />
        </linearGradient>
        <linearGradient id={ice} x1="20" y1="10" x2="42" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: 'hsl(var(--logo-ice-from))' }} />
          <stop offset="1" style={{ stopColor: 'hsl(var(--logo-ice-to))' }} />
        </linearGradient>
        {/* Mask luminance, not colour: white keeps, black cuts. */}
        <mask id={cutIce} maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="48">
          <rect width="48" height="48" fill="#fff" />
          <path d="M20.3 12.85 27.7 17.1" stroke="#000" strokeWidth="8.4" strokeLinecap="round" />
        </mask>
        <mask id={cutHoney} maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="48">
          <rect width="48" height="48" fill="#fff" />
          <path d="M20.3 30.9 27.7 35.15" stroke="#000" strokeWidth="8.4" strokeLinecap="round" />
        </mask>
      </defs>
      <path
        d={ICE_CELL}
        style={{ fill: 'hsl(var(--logo-ice-to) / 0.1)' }}
        stroke={`url(#${ice})`}
        strokeWidth="4"
        strokeLinejoin="round"
        mask={`url(#${cutIce})`}
      />
      <path
        d={HONEY_CELL}
        style={{ fill: 'hsl(var(--logo-mark) / 0.1)' }}
        stroke={`url(#${honey})`}
        strokeWidth="4"
        strokeLinejoin="round"
        mask={`url(#${cutHoney})`}
      />
      <circle cx="24" cy="24" r="2.7" style={{ fill: 'hsl(var(--ink-primary))' }} />
    </svg>
  );
};

/** The second product's mark: the cursor it always had. */
export const CursorMark = ({ className }: MarkProps) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={cn('text-logo-mark', className)}>
    {/* Centred on 12,12. It used to span y 3..19 in a 24 box - a whole unit high - which is invisible on
        its own and obvious in the extension's rail beside four centred glyphs. */}
    <path d="M5 4l14 8-6 1.6L10.5 20z" fill="currentColor" />
  </svg>
);

/* Which mark a product draws - asked by id, so the shell that shows it never has to write a product's name
 * (web/check-web.mjs holds it to that).
 *
 * OPTICAL SIZE. The hexagons keep the concept's padding inside their 48-unit box, and at the size of a
 * lucide glyph they read a size smaller than the icons in the column below them. The scale makes up the
 * difference without changing the box, so the row it sits in keeps the rhythm every other row has. */
export const ProductMark = ({ product, className }: MarkProps & { product: Product }) =>
  product === 'do'
    ? <HiveMark className={cn(className, 'scale-[1.3]')} />
    : <CursorMark className={className} />;
