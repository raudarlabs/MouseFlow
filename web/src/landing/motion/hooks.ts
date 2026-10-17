/* The motion system's React hooks. Every one of them answers "no" on the server and during hydration and
 * only then says what the browser knows, so the first client render is the server's render byte for byte
 * (SSR must equal hydration) and anything that depends on the window arrives one render later.
 */
import { useEffect, useLayoutEffect, useState, useSyncExternalStore, type RefObject } from 'react';
import { motionAllowed, subscribeMotion } from './state';

/** useLayoutEffect in the browser, useEffect on the server (where neither runs). */
export const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** Whether motion is allowed: false on the server and while hydrating, then the live answer. */
export function usePrefersMotion(): boolean {
  return useSyncExternalStore(subscribeMotion, motionAllowed, () => false);
}

/**
 * False on the server and in the first client render, true from the first effect on.
 * The switch for a component-level data-enhanced attribute: a JS-only layout (stacked acts, tabs, the deck)
 * is turned on by THIS, never by html.js alone, so a component whose script did not run keeps the
 * server's all-content layout.
 */
export function useEnhanced(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => setOn(true), []);
  return on;
}

export interface InViewOptions {
  /** Fraction of the element that must be visible. Default 0 (any pixel). */
  threshold?: number;
  rootMargin?: string;
  /** Stop observing after the first time it is in view. */
  once?: boolean;
}

/**
 * Whether the element is in view. False until measured. For starting and stopping things - a one-shot
 * cascade on entry, a canvas of dots - not for hiding content: content is revealed with data-reveal.
 */
export function useInView(ref: RefObject<Element | null>, { threshold = 0, rootMargin, once = false }: InViewOptions = {}): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e) return;
        /* An element taller than the screen can never show `threshold` of itself: half the screen covered
           by it counts as in view. */
        const rootH = e.rootBounds?.height ?? window.innerHeight;
        const on = e.isIntersecting && (e.intersectionRatio >= threshold || e.intersectionRect.height >= rootH * 0.5);
        setInView(on);
        if (on && once) io.disconnect();
      },
      { threshold: threshold > 0 ? [0, threshold, 0.5, 1] : 0, rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, threshold, rootMargin, once]);
  return inView;
}
