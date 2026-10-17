/* The landing rendered to a string at build time, for the static index.html (scripts/build-landing.mjs).
 *
 * Why prerender a one-page site: a crawler, a link preview and a slow phone all get the headline, the
 * copy and the form in the first response, with no JavaScript run. The client then hydrates the same tree
 * (main.tsx), which is why both render <Landing> with the same props inside StrictMode - React's useId
 * values, which the brand components use for their gradient ids, depend on the tree being identical. */
import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { Landing } from './Landing';
import { WAITLIST_ENDPOINT } from './endpoint';

/* The FAQ the page renders, for the build's FAQPage JSON-LD: the same array, so they cannot disagree. */
export { FAQ } from './sections/Faq';

export function render(): string {
  return renderToString(
    <StrictMode>
      <Landing endpoint={WAITLIST_ENDPOINT} />
    </StrictMode>,
  );
}
