import type { MouseEvent } from 'react';

/* EVERY "JOIN THE WAITLIST" GOES TO A WAITLIST FORM - the header's, the sticky bar's and each section's.
 * The page has one waitlist and one form component, rendered twice: in the hero and again at the end
 * (WaitlistForm.tsx, both posting to the same list), so a reader at the bottom of a long phone page is not
 * sent ten screens back up. Each button is a shortcut to one of them, never a third form.
 *
 * WHICH ONE. A form already on screen wins - the one nearest the middle of it, so a press never scrolls
 * away from a field the visitor can see. Otherwise the link's own href decides, the same place it goes
 * without a script: the header's #waitlist is the hero form, a section's #join the final one. A link marked
 * data-waitlist="nearest" (the sticky bar's, which shows on every screen of the page) takes whichever form
 * is closer instead.
 *
 * On most screens a plain jump moves little and the press looks dead - this brings the form to the middle
 * of the screen, puts the cursor in the address field and lets the field glow once, so the press visibly
 * lands somewhere. The glide happens only with motion allowed (html.motion). Before hydration the href
 * still jumps.
 */
const FORMS = 'form[data-waitlist]';

function distanceToCentre(el: Element): number {
  const r = el.getBoundingClientRect();
  const mid = (window.innerHeight || document.documentElement.clientHeight) / 2;
  return Math.abs(r.top + r.height / 2 - mid);
}

function onScreen(el: Element): boolean {
  const r = el.getBoundingClientRect();
  const h = window.innerHeight || document.documentElement.clientHeight;
  return r.top >= 0 && r.bottom <= h;
}

function nearest(forms: HTMLFormElement[]): HTMLFormElement | null {
  let best: HTMLFormElement | null = null;
  let bestD = Infinity;
  for (const f of forms) {
    const d = distanceToCentre(f);
    if (d < bestD) {
      best = f;
      bestD = d;
    }
  }
  return best;
}

/** The form a link names: the form itself (#waitlist) or the one inside the section it names (#join). */
function named(hash: string): HTMLFormElement | null {
  if (hash.length < 2) return null;
  const target = document.getElementById(decodeURIComponent(hash.slice(1)));
  if (!target) return null;
  if (target.matches(FORMS)) return target as HTMLFormElement;
  return target.querySelector<HTMLFormElement>(FORMS);
}

export function callWaitlist(e: MouseEvent<HTMLAnchorElement>) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
  const forms = [...document.querySelectorAll<HTMLFormElement>(FORMS)];
  if (!forms.length) return;
  const link = e.currentTarget;
  const visible = forms.filter(onScreen);
  const form =
    nearest(visible) ?? (link.dataset.waitlist === 'nearest' ? nearest(forms) : named(link.hash) ?? nearest(forms));
  const field = form?.querySelector<HTMLInputElement>('input[type="email"]');
  if (!form || !field) return;
  e.preventDefault();
  const glide = document.documentElement.classList.contains('motion');
  form.scrollIntoView({ behavior: glide ? 'smooth' : 'auto', block: 'center' });
  field.focus({ preventScroll: true });
  const box = field.closest('.landing-field');
  if (box) {
    box.classList.remove('landing-field-call');
    void (box as HTMLElement).offsetWidth; // restart the glow when pressed twice
    box.classList.add('landing-field-call');
  }
}
