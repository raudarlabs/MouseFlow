/* 09 · EARLY ACCESS - the single closing invitation, phrased as the page's promise: a night shift for your
 * tests, and a job for the machines you keep running. The form is right here, because a reader at the
 * bottom of a long phone page who is sent ten screens back up is a reader lost.
 *
 * THE BOOKEND OF THE HERO. The page opened on a glass hive round one honey queen; it closes on the same
 * hive in miniature (FinalCall/HexFlower.tsx), assembling as the panel arrives, over the hero's own hex
 * lattice and a warm pool of the queen's light. Under the form, a row of ten nights - the product's own
 * "row of nights", oldest on the left - with nothing in it yet but one honey dot: your first night, 02:00,
 * which is when Nightly runs. It is the only panel on the page with a honey edge, and honey here means what
 * it means everywhere: yours to press, and now.
 *
 * The form is the hero's WaitlistForm, a second instance with its own ids ("waitlist-final",
 * "email-final"): same field, same honey button, same endpoint, same list, same outcomes. Every section's
 * "Join" link (href="#join") lands here without a script; with one, callWaitlist brings this form to the
 * middle of the screen and puts the cursor in it.
 *
 * The head lives INSIDE the panel, under the art (head="none" on the Section, then SectionHead here), so
 * the H2 keeps its id and the section stays labelled by it. Everything is server-rendered at rest - the
 * flower assembled, the queen lit, the first dot honey - and the entrance is CSS keyed to the reveals
 * (FinalCall.css), so without a script or with reduced motion the panel is simply there.
 */
import type { CSSProperties, FocusEvent, ReactNode } from 'react';
import { HexDot, Panel, Grad, Section, SectionHead } from './kit';
import { reveal } from '../motion';
import { WaitlistForm } from '../WaitlistForm';
import { HexFlower } from './FinalCall/HexFlower';
import './FinalCall.css';

const TITLE: ReactNode = (
  <>
    Give your tests <Grad>a night shift.</Grad>
  </>
);

/* A no-break space before the dash, so a wrapped line never starts with it. */
const LEAD =
  'And the machines you keep running a job to do. Early access opens soon\u00a0— leave your email and we’ll write once, when the hive opens.';

/** The row of nights this account does not have yet: ten, the length the product shows, and only the
    first one lit. 02:00 is when Nightly runs. */
const NIGHTS = 10;
const FIRST_NIGHT = { label: 'Your first night', time: '02:00' };

/** What it runs on and how work reaches it - each one a product fact. */
const TRUST = ['Windows', 'macOS', 'desktop apps and Chrome', 'Claude over MCP', 'Telegram'];

const dot = (d: number) => ({ '--d': d }) as CSSProperties;

/** A "Join" press anywhere on the page focuses this form's field at once, while the page is still gliding
    here - and a Tab can land in it too. Either way the panel must already be there when the eye arrives,
    not start its reveal then: it is marked shown-as-painted (the motion system's own .is-in.is-instant,
    which the observer keeps), so the field and its call glow are in full view on arrival. */
const arrive = (e: FocusEvent<HTMLElement>) => {
  const panel = e.currentTarget;
  if (!panel.classList.contains('is-in')) panel.classList.add('is-in', 'is-instant');
};

export function FinalCall({ endpoint }: { endpoint: string }) {
  return (
    <Section
      id="join"
      index="09"
      label="Early access"
      title={TITLE}
      lead={LEAD}
      head="none"
      pool="honey"
      seam="honey"
      className="hl-final"
      stageClassName="hl-final-stage"
    >
      <Panel tone="honey" className="hl-final-panel" onFocus={arrive} {...reveal('panel', 0)}>
        {/* The panel's own light: the hero's lattice fading out from the art, the queen's warm pool behind
            it (the section's one slow breath), and cool ice in the lower corners for depth. */}
        <div className="hl-fc-bg" aria-hidden="true">
          <Lattice />
          <span className="hl-fc-pool" />
        </div>

        <HexFlower className="hl-fc-art" />

        <SectionHead id="join" index="09" label="Early access" title={TITLE} lead={LEAD} layout="center" className="hl-final-head" />

        {/* The form never moves: it arrives with the panel and has no reveal of its own, so a "Join" press
            that glides here lands on a field that is already there, not on one still fading in. */}
        <div className="hl-final-formwrap">
          <WaitlistForm endpoint={endpoint} formId="waitlist-final" fieldId="email-final" className="hl-final-form" />
        </div>

        <div className="hl-fc-after" {...reveal('up', 3)}>
          <div className="hl-fc-nights">
            <span className="hl-fc-dots" aria-hidden="true">
              <span className="hl-fc-dot hl-fc-dot--first hl-entrance" style={dot(0)}>
                <HexDot kind="empty" size={10} />
                <i className="hl-fc-dot-ring" />
                <i className="hl-fc-dot-fill">
                  <HexDot kind="honey" size={10} />
                </i>
              </span>
              {Array.from({ length: NIGHTS - 1 }, (_, i) => (
                <span key={i} className="hl-fc-dot hl-entrance" style={dot(i + 1)}>
                  <HexDot kind="empty" size={10} />
                </span>
              ))}
            </span>
            <span className="hl-fc-caption">
              <span>
                {FIRST_NIGHT.label} · <b>{FIRST_NIGHT.time}</b>
              </span>
            </span>
          </div>
          {/* The hero's OS line, said again: every part carries its own hex in front and keeps its words
              together, so the line wraps only between parts and every line - the first one too - starts
              with a hex. A list that wraps on a phone still reads as a list. */}
          <p className="hl-fc-trust">
            {TRUST.map((t) => (
              <span key={t}>
                <i aria-hidden="true" />
                {t}
              </span>
            ))}
          </p>
        </div>
      </Panel>
    </Section>
  );
}

/** The hero's hex lattice (Landing's Backdrop), with an id of its own: a pattern id resolves to the first
    element of that id in the document, so this one must not share the backdrop's. */
function Lattice() {
  return (
    <svg className="hl-fc-lattice">
      <defs>
        <pattern id="hl-fc-hexgrid" width="96" height="55.4256" patternUnits="userSpaceOnUse" x="50%">
          <path
            d="M64 27.7128 56 41.5692 40 41.5692 32 27.7128 40 13.8564 56 13.8564Z M112 0 104 13.8564 88 13.8564 80 0 88-13.8564 104-13.8564Z M112 55.4256 104 69.282 88 69.282 80 55.4256 88 41.5692 104 41.5692Z M16 0 8 13.8564-8 13.8564-16 0-8-13.8564 8-13.8564Z M16 55.4256 8 69.282-8 69.282-16 55.4256-8 41.5692 8 41.5692Z"
            fill="none"
            strokeWidth="1"
            style={{ stroke: 'hsl(var(--hive-ice))', strokeOpacity: 0.06 }}
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#hl-fc-hexgrid)" />
    </svg>
  );
}
