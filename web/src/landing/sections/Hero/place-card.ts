/* WHERE THE LOGS CARD OPENS when somebody points at a machine cell in the hero's hive.
 *
 * One rule at every width: the card never covers the glass it is talking about, and never opens where it
 * cannot be read. On the desktop it opens BESIDE the cell, on whichever side has room, and is kept inside
 * what is on screen (the art reaches below the fold). In the phone's and the tablet's hive strip there is
 * no side with room, so it opens ABOVE or BELOW the cell - away from the strip's middle - and stays out of
 * the strip's faded bottom; where the strip is too short for either, it opens below and over the copy.
 *
 * Pure arithmetic on boxes the caller measured after the card had rendered the machine's lines, so the
 * height used is the real one; the hero applies the result as the card's left/top inside the art.
 */

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface CardSpot {
  left: number;
  top: number;
}

/** Space kept between the card and the cell, and between the card and an edge. */
const GAP = 16;
const EDGE = 8;
/** The phone/tablet strip fades in over its first 24px and out over its last 18% (hero.css, .landing-art's
    mask): a card there would fade with it. */
const STRIP_TOP = 24;
const STRIP_SOLID = 0.82;
/** The card's inset from the strip's sides on a phone: the hero's 12px, not the page gutter. */
const SIDE = 12;

/** v kept between lo and hi; when the space is smaller than the card, the top edge wins. */
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi));

export function placeCard(cell: Box, art: Box, w: number, h: number, wide: boolean, screenH: number): CardSpot {
  /* The cell, in the art's own coordinates. */
  const x = cell.left - art.left;
  const y = cell.top - art.top;
  if (wide) {
    const right = x + cell.width + GAP;
    const left = right + w <= art.width - EDGE ? right : Math.max(EDGE, x - GAP - w);
    /* Inside the part of the art that is on screen: below the top of the viewport if the page has scrolled,
       above its bottom if the art runs past the fold. */
    const shownTop = Math.max(0, -art.top) + EDGE;
    const shownBottom = Math.min(art.height, screenH - art.top) - EDGE;
    const top = clamp(y + cell.height / 2 - h / 2, shownTop, shownBottom - h);
    return { left: Math.round(left), top: Math.round(top) };
  }
  const left = clamp(x + cell.width / 2 - w / 2, SIDE, art.width - w - SIDE);
  const floor = art.height * STRIP_SOLID;
  const below = y + cell.height + EDGE;
  const above = y - h - EDGE;
  const fitsBelow = below + h <= floor;
  const fitsAbove = above >= STRIP_TOP;
  /* A cell in the strip's upper half gets the card under it, one in the lower half over it - away from the
     strip's middle - and the other side when that one has no room. */
  const upper = y + cell.height / 2 < art.height / 2;
  let top: number;
  if (upper ? fitsBelow : fitsAbove) top = upper ? below : above;
  else if (upper ? fitsAbove : fitsBelow) top = upper ? above : below;
  /* A strip shorter than the card on both sides (a short phone, where the strip gave its height to the
     form): under the cell and out over the copy. The copy can wait while a card is open - one tap outside
     closes it - but the cell it describes, with its honey rim, has to stay in sight. */
  else top = below;
  return { left: Math.round(left), top: Math.round(top) };
}
