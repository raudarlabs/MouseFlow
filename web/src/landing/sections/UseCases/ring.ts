/* WHERE EACH CARD SITS - the deck's arithmetic, kept out of the component so it can be read on its own.
 *
 * A card's offset is its distance from the active card in slots (0 = centre, ±1 = the neighbours, ±2 the
 * hidden staging slots, beyond that parked out of sight). The deck is a ring - Next past the last card is
 * the first - so offsets are taken modulo the shown subset, and a neighbour always exists for autoplay to
 * loop into.
 *
 * The one subtle part is a card that crosses the seam of the ring. Moving one step right, the card on the
 * far left becomes the far right; if it simply transitioned there it would sweep across the whole deck.
 * So every move is described the way the eye reads it - every card travels `k` slots in one direction -
 * and a card whose place on the ring disagrees with that straight line is PRE-PLACED: put, without a
 * transition, one slot beyond its target on the side it should arrive from, so it glides in like the rest.
 * A visible card that should leave keeps travelling off in the same direction instead of wrapping.
 */

/** The ring distance d brought into the subset's window: [-floor((n-1)/2), ceil((n-1)/2)]. */
export function ringOffset(d: number, n: number): number {
  if (n <= 1) return 0;
  const lo = -Math.floor((n - 1) / 2);
  return ((((d - lo) % n) + n) % n) + lo;
}

/** The slots that show a card (the active one and its two neighbours). */
const SHOWN = 1;

export interface Placement {
  /** Each shown card's offset after the move (may run past the ring's window for a card leaving). */
  offsets: Record<string, number>;
  /** Cards to pre-place before transitioning: id → the offset to start from, with no transition. */
  pre: Record<string, number>;
}

/** Offsets for a deck at rest on `active` - the first render, and the shape every move settles into. */
export function restingOffsets(ids: string[], active: number): Record<string, number> {
  const out: Record<string, number> = {};
  ids.forEach((id, i) => {
    out[id] = ringOffset(i - active, ids.length);
  });
  return out;
}

/**
 * Move the deck. `ids` is the shown subset in order, `active` the new active index in it, `prev` the
 * offsets the cards are drawn at now, and `delta` the move in cards (+1 = Next, the deck slides left).
 *
 * A move of one or two cards is a GLIDE: every card travels the same straight line, with the seam-crossers
 * pre-placed as described above. A longer jump (a far dot) or a re-form (`delta` 0, a filter change) would
 * send cards streaking across the whole deck, so it is a RE-FORM instead: a card that stays on screen and
 * moves at most one slot glides there; a card that comes on screen arrives from one slot beyond its place
 * on its own side (the new active card from the side the deck moves from); a card that leaves the screen
 * slides one slot outward as it fades; a card out of sight before and after jumps.
 */
export function moveDeck(ids: string[], active: number, prev: Record<string, number | undefined>, delta: number): Placement {
  const n = ids.length;
  const offsets: Record<string, number> = {};
  const pre: Record<string, number> = {};
  const dir = delta === 0 ? 0 : delta > 0 ? -1 : 1; // which way the cards travel on screen
  const k = Math.abs(delta);
  const shownAt = (o: number | undefined) => o !== undefined && Math.abs(o) <= SHOWN;
  ids.forEach((id, i) => {
    const ring = ringOffset(i - active, n);
    const p = prev[id];
    if (k === 0 || k > 2 || p === undefined) {
      if (Math.abs(ring) <= SHOWN) {
        offsets[id] = ring;
        if (!(shownAt(p) && Math.abs(p! - ring) <= 1)) pre[id] = ring === 0 ? (dir === 0 ? 1 : -dir) : ring + Math.sign(ring);
      } else if (shownAt(p)) {
        const side = p! === 0 ? (dir === 0 ? -1 : dir) : Math.sign(p!);
        offsets[id] = side * (SHOWN + 1);
      } else {
        offsets[id] = ring;
        pre[id] = ring;
      }
      return;
    }
    const straight = p + dir * k;
    if (straight === ring) {
      offsets[id] = ring;
    } else if (Math.abs(ring) <= SHOWN) {
      /* It must be on screen afterwards: arrive from beyond its slot, moving the way the deck moves. */
      offsets[id] = ring;
      pre[id] = ring - dir;
    } else if (Math.abs(p) <= SHOWN) {
      /* It was on screen and is leaving: carry on off the edge rather than wrap through the middle. */
      offsets[id] = straight;
    } else {
      /* Out of sight before and after: jump. */
      offsets[id] = ring;
      pre[id] = ring;
    }
  });
  return { offsets, pre };
}

/** The slot class a card is styled by: -3 … 3, everything further out shares ±3 (parked, hidden). */
export const slotOf = (offset: number) => Math.max(-3, Math.min(3, offset));

/** The deal-in order: the far cards first, the active card last (60ms apart). */
export const dealOf = (offset: number) => {
  const a = Math.min(Math.abs(offset), 2);
  return (2 - a) * 2 + (offset < 0 ? 1 : 0);
};
