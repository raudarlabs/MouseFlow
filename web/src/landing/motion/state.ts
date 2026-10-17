/* IS MOTION ALLOWED - one answer for the whole page, read by the head script's class, the reveal system,
 * every demo timeline and every hook.
 *
 * Motion is allowed when the visitor has not asked their system to reduce it AND the URL does not carry
 * ?still - the switch screenshots and reviews use to get the finished page with nothing in flight. The
 * answer follows a live change of the system setting.
 *
 * The head script in landing/index.html computes the same answer before the first paint (it has to: the
 * hero's art and the ambient loops key off html.motion from the first frame). This module is the script's
 * twin for everything after hydration; web/check-web.mjs holds the two to the same query and the same
 * switch.
 *
 * LAZY, NOT INITIALISED BY ONE CALLER. React runs a child's effects before its parent's, so a section's
 * timeline asks this before Landing's effect has started the motion system; whoever asks first computes it.
 * On the server - and so during hydration, through useSyncExternalStore's server snapshot - the answer is
 * always "no", which is also what the server HTML shows: the finished page.
 */
type Listener = () => void;

export const MOTION_QUERY = '(prefers-reduced-motion: no-preference)';

let allowed: boolean | null = null;
const listeners = new Set<Listener>();

/** The URL switch for screenshots: ?still (any value) renders every demo at its final frame. */
export function isStill(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return new URLSearchParams(window.location.search).has('still');
  } catch {
    return false;
  }
}

function compute(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return !isStill() && window.matchMedia(MOTION_QUERY).matches;
}

function start() {
  if (allowed !== null || typeof window === 'undefined') return;
  allowed = compute();
  if (typeof window.matchMedia !== 'function') return;
  const mq = window.matchMedia(MOTION_QUERY);
  const change = () => {
    const next = compute();
    if (next === allowed) return;
    allowed = next;
    document.documentElement.classList.toggle('motion', next);
    for (const l of [...listeners]) l();
  };
  mq.addEventListener?.('change', change);
}

/** Whether motion is allowed right now. False on the server. */
export function motionAllowed(): boolean {
  start();
  return allowed ?? false;
}

/** Called whenever the answer changes (the system setting was flipped while the page was open). */
export function subscribeMotion(fn: Listener): () => void {
  start();
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
