/* Whether the three ways in stand side by side (1200px and up) or one under another.
 *
 * It decides who owns the threads. Side by side, the three come into view together, and three demos
 * starting at once would meet the engine's two-at-a-time rule: the first would sit frozen on an empty
 * tile while the other two played. So there they are ONE demo - the row - with the threads 350ms apart.
 * One under another, each tile is its own demo and plays when it is half in view.
 *
 * False on the server and while hydrating (the server cannot know the width, and SSR must equal
 * hydration); the live answer one render later, and again whenever the window crosses 1200px.
 */
import { useSyncExternalStore } from 'react';

const WIDE = '(min-width: 1200px)';

function subscribe(change: () => void) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const mq = window.matchMedia(WIDE);
  mq.addEventListener?.('change', change);
  return () => mq.removeEventListener?.('change', change);
}

const now = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(WIDE).matches;

export function useWide(): boolean {
  return useSyncExternalStore(subscribe, now, () => false);
}
