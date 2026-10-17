/* THE KEPT FRAME'S FLIGHT - at the start of act 3 the screen is kept as evidence ("what it proved"), and a
 * frost outline of it leaves the screen and lands in the "Frame kept" chip in the side pane, so the chip
 * reads as the screen you just watched rather than as a label.
 *
 * The screen and the chip are in different columns (split) or rows (stacked), so the flight is measured:
 * the ghost is placed over the screen while invisible and then only transform and opacity move - it
 * shrinks from the screen's size (a box scaled down stays crisp; a 45px thumbnail scaled up would not).
 * It flies only when the clock crosses its moment while the demo is actually playing: a seek past it, a
 * paused demo and the poster never fly. Curve and length are the motion system's (--m-out, 520ms).
 */
import { useRef, type RefObject } from 'react';
import { useTimelineFrame, type Timeline } from '../../motion';

interface FlightRefs {
  /** The demo root: the ghost's positioning box, and where data-run / data-paused are read. */
  root: RefObject<HTMLElement | null>;
  /** The theater: the flight starts from its screen (the kit's Screen takes no ref). */
  from: RefObject<HTMLElement | null>;
  to: RefObject<HTMLElement | null>;
  ghost: RefObject<HTMLElement | null>;
}

export function useFrameFlight(tl: Timeline, at: number, ms: number, { root, from, to, ghost }: FlightRefs) {
  const last = useRef(-1);
  useTimelineFrame((t) => {
    const prev = last.current;
    last.current = t;
    /* A frame step, not a jump: the engine's longest frame is 64ms (at rate 1). */
    if (!(prev < at && t >= at && t - prev < 120)) return;
    const box = root.current;
    const a = from.current?.querySelector<HTMLElement>('.hl-screen');
    const b = to.current;
    const g = ghost.current;
    if (!box || !a || !b || !g || !box.hasAttribute('data-run') || box.hasAttribute('data-paused')) return;
    if (typeof g.animate !== 'function') return;
    const o = box.getBoundingClientRect();
    const r1 = a.getBoundingClientRect();
    const r2 = b.getBoundingClientRect();
    if (!r1.width || !r2.width) return;
    g.style.left = r1.left - o.left + 'px';
    g.style.top = r1.top - o.top + 'px';
    g.style.width = r1.width + 'px';
    g.style.height = r1.height + 'px';
    const dx = r2.left - r1.left;
    const dy = r2.top - r1.top;
    const sx = r2.width / r1.width;
    const sy = r2.height / r1.height;
    const ease = getComputedStyle(box).getPropertyValue('--m-out').trim() || 'ease-out';
    g.classList.add('hl-will');
    const anim = g.animate(
      [
        { opacity: 0, transform: 'translate3d(0,0,0) scale(1,1)' },
        { opacity: 0.9, transform: 'translate3d(0,0,0) scale(1,1)', offset: 0.12 },
        { opacity: 0.85, offset: 0.8 },
        { opacity: 0, transform: `translate3d(${dx}px,${dy}px,0) scale(${sx},${sy})` },
      ],
      { duration: ms, easing: ease, fill: 'none' },
    );
    const done = () => g.classList.remove('hl-will');
    anim.onfinish = done;
    anim.oncancel = done;
  }, tl);
}
