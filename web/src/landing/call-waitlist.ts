import type { MouseEvent } from 'react';

/* EVERY "JOIN THE WAITLIST" GOES TO THE ONE FORM - the header's and each section's. The page has one
 * waitlist and one call to it, said the same way everywhere; each button is a shortcut, not a second form. On most screens the form is
 * already in view, so a plain #waitlist jump moves nothing and the press looks dead - this brings the form
 * to the middle of the screen, puts the cursor in the address field and lets the field glow once, so the
 * press visibly lands somewhere. Before hydration the href still jumps to #waitlist. */
export function callWaitlist(e: MouseEvent<HTMLAnchorElement>) {
  const field = document.getElementById('email') as HTMLInputElement | null;
  const form = document.getElementById('waitlist');
  if (!field || !form) return;
  e.preventDefault();
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  form.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'center' });
  field.focus({ preventScroll: true });
  const box = field.closest('.landing-field');
  if (box) {
    box.classList.remove('landing-field-call');
    void (box as HTMLElement).offsetWidth; // restart the glow when pressed twice
    box.classList.add('landing-field-call');
  }
}
