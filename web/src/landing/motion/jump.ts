/* In-page jumps - the header's anchor nav, the hero's "For QA ↓ / For IT ↓", a section's foot link - are
 * plain anchors: without a script, or with reduced motion, the browser jumps (and .hl-sec's scroll-margin
 * keeps the heading clear of the sticky bar). With motion allowed the same click glides there instead, and
 * focus follows to the section, as it would after a real jump, so the next Tab continues from where the eye
 * landed. This is the only smooth scrolling on the page: no scroll-jacking, no pinned scenes.
 */
import type { MouseEvent } from 'react';

export function smoothJump(e: MouseEvent<HTMLAnchorElement>) {
  const hash = e.currentTarget.hash;
  if (!hash || hash.length < 2 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
  const target = document.getElementById(decodeURIComponent(hash.slice(1)));
  if (!target || !document.documentElement.classList.contains('motion')) return;
  e.preventDefault();
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (location.hash !== hash) history.pushState(null, '', hash);
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
}
