/* THE MOTION SYSTEM'S START: run once, after hydration, from Landing's effect.
 *
 * In this order, because the order is what makes it invisible:
 *   1. html.js - a script is running (the head script set it already; this is the belt to its braces).
 *   2. Every [data-reveal] already on screen is marked .is-in.is-instant - SYNCHRONOUSLY, before anything
 *      can hide it - so what the server painted stays exactly where it is. Only what is below the fold
 *      will rise in, and it is below the fold, so nobody sees it hide.
 *   3. html.motion is kept in step with motionAllowed() (the head script set it before first paint; a live
 *      change of the system setting flips it).
 *   4. html.reveals - from here the "before" state of a reveal applies (motion.css) - and ONE shared
 *      IntersectionObserver reveals each target once, when 15% of it is in view, and never hides it again.
 *   5. One more observer marks every [data-loop] container data-play="on|off", which pauses the ambient
 *      CSS loops inside it while it is off screen.
 *
 * One MutationObserver over the page does two jobs:
 *   - later arrivals (a deck's controls rendered once enhanced) are handed to both observers, so a
 *     [data-reveal] that mounts after this ran is revealed rather than left hidden;
 *   - a revealed element whose class React rewrote (its className is state-driven: an active tab, an open
 *     row) gets .is-in back at once, as .is-instant, so a re-render never hides it or replays its entrance.
 *     The callback is a microtask, so the re-add lands before the browser paints the loss.
 *
 * Idempotent: StrictMode runs effects twice in development, and a second start returns the first one's stop.
 */
import { motionAllowed, subscribeMotion } from './state';

const REVEAL = '[data-reveal]';
const LOOP = '[data-loop]';

let stop: (() => void) | null = null;

function inViewport(el: Element): boolean {
  const r = el.getBoundingClientRect();
  const h = window.innerHeight || document.documentElement.clientHeight;
  return r.bottom > 0 && r.top < h && (r.width > 0 || r.height > 0);
}

export function initMotion(): () => void {
  if (stop) return stop;
  if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return () => {};
  const html = document.documentElement;
  html.classList.add('js');

  /* Elements that have been revealed (or shown as painted): the ones whose .is-in must survive React. */
  const shown = new WeakSet<Element>();
  const show = (el: Element, instant: boolean) => {
    shown.add(el);
    el.classList.add('is-in');
    if (instant) el.classList.add('is-instant');
  };
  /* What still waits for its reveal. An element that already carries .is-in (a second start in development's
     StrictMode) is taken as shown. */
  const pending = (root: ParentNode) =>
    [...root.querySelectorAll<HTMLElement>(REVEAL)].filter((el) => {
      if (el.classList.contains('is-in')) shown.add(el);
      return !shown.has(el);
    });

  /* 2. On screen now: shown as painted. */
  for (const el of pending(document)) if (inViewport(el)) show(el, true);

  /* 3. html.motion follows the one answer. */
  const syncMotion = () => html.classList.toggle('motion', motionAllowed());
  syncMotion();
  const unsubscribe = subscribeMotion(syncMotion);

  /* 4. Reveals. 15% of the target in view - or, for a target taller than the screen can show 15% of, a
     third of the screen's height covered by it - with the bottom tenth of the screen not counting, so a
     reveal happens where the eye already is. */
  const reveal = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const rootH = e.rootBounds?.height ?? window.innerHeight;
        if (e.intersectionRatio >= 0.15 || e.intersectionRect.height >= rootH * 0.3) {
          show(e.target, false);
          reveal.unobserve(e.target);
        }
      }
    },
    { threshold: [0, 0.05, 0.15, 0.3], rootMargin: '0px 0px -10% 0px' },
  );
  html.classList.add('reveals');
  for (const el of pending(document)) reveal.observe(el);

  /* 5. Ambient loops pause off screen. A little margin, so a loop is already running as it scrolls in. */
  const loops = new IntersectionObserver(
    (entries) => {
      for (const e of entries) (e.target as HTMLElement).dataset.play = e.isIntersecting ? 'on' : 'off';
    },
    { rootMargin: '120px 0px 120px 0px' },
  );
  for (const el of document.querySelectorAll(LOOP)) loops.observe(el);

  const watch = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'attributes') {
        /* React rewrote a revealed element's class: give .is-in back without replaying the entrance. */
        if (shown.has(r.target as Element) && !(r.target as Element).classList.contains('is-in')) show(r.target as Element, true);
        continue;
      }
      for (const n of r.addedNodes) {
        if (!(n instanceof HTMLElement)) continue;
        const targets = [...(n.matches(REVEAL) ? [n] : []), ...pending(n)];
        for (const el of targets) {
          if (shown.has(el)) continue;
          /* Mounted on screen: show it as it is - a control that blinks in after hydration reads as a bug. */
          if (inViewport(el)) show(el, true);
          else reveal.observe(el);
        }
        if (n.matches(LOOP)) loops.observe(n);
        for (const el of n.querySelectorAll(LOOP)) loops.observe(el);
      }
    }
  });
  const root = document.getElementById('root') ?? document.body;
  watch.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

  stop = () => {
    reveal.disconnect();
    loops.disconnect();
    watch.disconnect();
    unsubscribe();
    html.classList.remove('reveals');
    stop = null;
  };
  return stop;
}
