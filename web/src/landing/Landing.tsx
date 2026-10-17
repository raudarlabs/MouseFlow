/* THE HIVELINK LANDING - hivelink.si, coming soon.
 *
 * The chosen concept, "Glass Hive · Arctic Honey" (hivelink/concepts/05d-glasshive-arctic, owner
 * 2026-10-16), rebuilt from the app's own parts: the design system's Button, Input, Badge and Typography,
 * the palette's tokens, the app's three faces, the shared HiveMark, and the hive drawn by components in
 * brand/ that the admin can use too. One design system for the site and the admin was the decision; a
 * landing written in its own CSS with its own hex values would be the second one.
 *
 * ONE STORY. The hero, then nine sections that follow one test through one week in the hive - how it tests,
 * why the green is proven, the night shift, the IT side, the ways in, eight real jobs, the rails, the
 * questions, and the invitation (sections/index.tsx holds the order). Every section is built from one kit
 * (sections/kit/) and moves by one motion system (motion/), which this component starts once it has
 * hydrated.
 *
 * Every claim on the page is a product fact: Windows and macOS only, plain words, a live agent that works
 * from the screen and the accessibility tree, verdicts the machine decides, Logs as proof, schedules, your
 * own AI over MCP, Telegram, one account for the whole hive. No numbers, no customers, no quotes - there
 * are none yet to show. The footer has no social links: there are no accounts to link to yet.
 *
 * Rendered to static HTML at build time (entry-server.tsx, scripts/build-landing.mjs) and hydrated by
 * main.tsx, so it must render the same on both sides: nothing here reads the window during render.
 */
import { useEffect } from 'react';
import { initMotion } from './motion';
import { Brand, Hero, HeroHeader, StickyBar } from './sections/Hero';
import { StorySections } from './sections';

/** The backdrop: a faint hex lattice under the page's cold light and the queen's warm one. */
function Backdrop() {
  return (
    <div className="landing-bg" aria-hidden="true">
      <svg preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id="landing-hexgrid" width="96" height="55.4256" patternUnits="userSpaceOnUse">
            <path
              d="M64 27.7128 56 41.5692 40 41.5692 32 27.7128 40 13.8564 56 13.8564Z M112 0 104 13.8564 88 13.8564 80 0 88-13.8564 104-13.8564Z M112 55.4256 104 69.282 88 69.282 80 55.4256 88 41.5692 104 41.5692Z M16 0 8 13.8564-8 13.8564-16 0-8-13.8564 8-13.8564Z M16 55.4256 8 69.282-8 69.282-16 55.4256-8 41.5692 8 41.5692Z"
              fill="none"
              strokeWidth="1"
              style={{ stroke: 'hsl(var(--hive-ice))', strokeOpacity: 0.06 }}
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#landing-hexgrid)" />
      </svg>
    </div>
  );
}

export function Landing({ endpoint }: { endpoint: string }) {
  /* The motion system starts after hydration: reveals, ambient-loop pausing. Until then - and for ever
     without a script - the server's HTML is the finished page. */
  useEffect(() => initMotion(), []);
  return (
    <div className="landing">
      <Backdrop />
      {/* The landmarks: the header is the banner, the sticky bar a navigation, and ONE <main> holds the
          hero's body and the whole story - so "skip to main content" lands on the product, not on half of it. */}
      <HeroHeader />
      <StickyBar />
      <main id="main" className="landing-main">
        <Hero endpoint={endpoint} />
        <StorySections endpoint={endpoint} />
      </main>
      <footer className="landing-foot">
        <div className="landing-foot-in">
          <Brand small />
          <small>© 2026 Hivelink. The hive opens soon · Early access.</small>
          <small className="landing-credit">
            Created by{' '}
            <a href="https://raudar.dev/" target="_blank" rel="noopener">
              Raudar Labs
            </a>
          </small>
        </div>
      </footer>
    </div>
  );
}
