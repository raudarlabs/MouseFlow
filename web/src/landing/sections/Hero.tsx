/* THE HERO: the header, "Every machine. / One hive.", the waitlist form and the glass hive you can point
 * at - plus the two things that keep the rest of the page reachable from it: the anchor nav (from 1200) and
 * the sticky bar that slides in once the hero has left the screen.
 *
 * THREE EXPORTS, BECAUSE OF THE LANDMARKS. The header is the page's banner and the sticky bar a navigation;
 * the hero's body is the first part of the main landmark, which Landing.tsx wraps round it AND the nine
 * sections - so "skip to main content" and landmark navigation land on the product story, not on the hero.
 * HeroHeader and StickyBar each follow which section is in view (one cheap observer each), and the bar finds
 * the hero by its id, so the three need no shared state.
 *
 * The composition is the concept's (hivelink/concepts/05d-glasshive-arctic), built from the app's parts:
 * the design system's Badge, Typography and Button, the shared HiveMark, and the hive drawn by brand/.
 * Nothing in it animates in except the hive art and its labels - the copy is the first paint and must read
 * at it.
 *
 * Rendered on the server like the rest of the page, so it must render the same on both sides: nothing here
 * reads the window during render. The pointed cell, the card's place, the section in view and the bar's
 * state all start empty and arrive from effects.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Badge } from '@insightis/ui/Badge';
import { buttonVariants } from '@insightis/ui/Button';
import { Typography } from '@insightis/ui/Typography';
import { cn } from '@insightis/ui/cn';
import { HiveMark } from '@/components/brand/HiveMark';
import { GlassHive } from '@/components/brand/GlassHive';
import { HiveTerminal } from '@/components/brand/HiveTerminal';
import { HIVE_MACHINES } from '@/components/brand/hive-machines';
import { WaitlistForm } from '../WaitlistForm';
import { callWaitlist } from '../call-waitlist';
import { smoothJump, useIsoLayoutEffect } from '../motion';
import { placeCard } from './Hero/place-card';
import './hero.css';

/** The honey "now" dot, the concept's: the one warm light outside the hive. */
const Dot = () => <i aria-hidden="true" className="landing-dot" />;

/* What it runs on and who decides - one line of facts under the form, each with its hex, so a wrapped line
   starts with a hex like the first one does and the line reads as a list at any width. */
const FACTS = ['Windows', 'macOS', 'desktop apps + Chrome', 'verdicts decided by the machine'];

export const Brand = ({ small }: { small?: boolean }) => (
  <a className={small ? 'landing-brand landing-brand-sm' : 'landing-brand'} href="./" aria-label="Hivelink home">
    <HiveMark className="landing-brand-mark" />
    <b className="font-display">hivelink</b>
  </a>
);

/* The anchor nav: five places, and the sections that light each one. 07 (the rails) and 09 (the form) have
   no link of their own; while one of them is in view the indicator rests. */
const NAV = [
  { href: '#qa', label: 'How it tests', ids: ['qa', 'proof'] },
  { href: '#nightly', label: 'Night shift', ids: ['nightly'] },
  { href: '#it', label: 'For IT', ids: ['it', 'channels'] },
  { href: '#use-cases', label: 'Use cases', ids: ['use-cases'] },
  { href: '#faq', label: 'FAQ', ids: ['faq'] },
];
const SPIED = ['qa', 'proof', 'nightly', 'it', 'channels', 'use-cases', 'trust', 'faq', 'join'];

/** The hero body's id: the sticky bar watches it leave, the nav rests while it is in view. */
const HERO_ID = 'hero';

const glassBtn = buttonVariants({ variant: 'secondary', rounded: 'full', size: 'lg', className: 'landing-glass-btn' });

/** The page's banner: the brand, the "Early access" tag (under 1200), the anchor nav (from 1200) and the
    header's Join - a link to the hero's form, in the Button's own look. */
export function HeroHeader() {
  const active = useSectionInView();
  return (
    <header className="landing-top" data-loop="">
      <Brand />
      <span className="landing-soon landing-top-tag" aria-hidden="true">
        <Dot />
        Early access
      </span>
      <AnchorNav active={active} label="Sections" />
      <nav className="landing-top-cta" aria-label="Primary">
        <span className="landing-soon">
          <Dot />
          Coming soon
        </span>
        {/* A link, so it is an <a> - in the Button's own look. Not `<Button asChild>`: the vendored Button
            wraps its label in a span between two slots, and Radix's Slot refuses more than one child. */}
        <a href="#waitlist" onClick={callWaitlist} className={glassBtn}>
          Join the hive
        </a>
      </nav>
    </header>
  );
}

/** The sticky bar. Hidden and inert until the hero has gone up under where it will be; without a script it
    never shows. */
export function StickyBar() {
  const active = useSectionInView();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = document.getElementById(HERO_ID);
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    /* The top 60px of the screen are the bar's: it comes in once the hero has gone up under where the bar
       will be, so a jump to #qa - which leaves the hero's last pixel at the top edge - already has it. */
    const io = new IntersectionObserver(
      ([e]) => {
        if (e) setShown(!e.isIntersecting && e.boundingClientRect.top < 0);
      },
      { rootMargin: '-60px 0px 0px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div className="landing-bar" data-shown={shown ? '' : undefined} inert={!shown}>
      <div className="landing-bar-in">
        <Brand small />
        <AnchorNav active={active} label="Sections (sticky)" />
        <div className="landing-bar-end">
          <span className="landing-soon">
            <Dot />
            Coming soon
          </span>
          <a href="#waitlist" data-waitlist="nearest" onClick={callWaitlist} className={cn(glassBtn, 'landing-bar-join')}>
            <span className="landing-bar-join-short">Join</span>
            <span className="landing-bar-join-long">Join the hive</span>
          </a>
        </div>
      </div>
    </div>
  );
}

/** Which nav entry's section is in view: ONE observer over the section ids, watching a line at 45% of
    the screen's height - the section that line crosses is the one being read. Null on the server. */
function useSectionInView(): number | null {
  const [active, setActive] = useState<number | null>(null);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const id = e.target.id;
          const i = NAV.findIndex((n) => n.ids.includes(id));
          setActive(i < 0 ? null : i);
        }
      },
      { rootMargin: '-45% 0px -55% 0px' },
    );
    for (const id of SPIED) {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    }
    /* Above the first section (the hero) nothing is active. */
    const hero = document.getElementById(HERO_ID);
    if (hero) io.observe(hero);
    return () => io.disconnect();
  }, []);
  return active;
}

/** The nav itself, in the header and again in the sticky bar. It measures its own links to place the
    indicator - after layout, in an effect, and again when its size changes. */
function AnchorNav({ active, label }: { active: number | null; label: string }) {
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = nav.current;
    if (!el) return undefined;
    const place = () => {
      if (active === null) {
        el.removeAttribute('data-active');
        return;
      }
      const link = el.querySelectorAll<HTMLAnchorElement>('a')[active];
      if (!link || !el.offsetWidth) return;
      el.style.setProperty('--ix', link.offsetLeft + 'px');
      el.style.setProperty('--is', String(link.offsetWidth / el.offsetWidth));
      el.setAttribute('data-active', '');
      /* Only after the first placement may it travel: it must not slide in from the left edge. */
      requestAnimationFrame(() => el.setAttribute('data-measured', ''));
    };
    place();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(place);
    ro.observe(el);
    return () => ro.disconnect();
  }, [active]);
  return (
    <nav ref={nav} className="landing-nav" aria-label={label}>
      {NAV.map((n, i) => (
        <a key={n.href} href={n.href} onClick={smoothJump} aria-current={i === active ? 'location' : undefined}>
          {n.label}
        </a>
      ))}
      <span className="landing-nav-ind" aria-hidden="true">
        <i />
      </span>
    </nav>
  );
}

export function Hero({ endpoint }: { endpoint: string }) {
  /* Which machine cell is being pointed at. Null at rest - and on the server, so the prerender and the
   * first client render agree. */
  const [pointed, setPointed] = useState<string | null>(null);
  /* Where the card opens (Hero/place-card.ts): beside the pointed cell on the desktop, above or below it in
   * the phone's strip - never over the glass it is talking about. Nothing is read from the window during
   * render; null keeps the stylesheet's resting place. */
  const [at, setAt] = useState<{ left: number; top: number } | null>(null);
  /* The pointed cell's box, as it was at the moment it was pointed at. */
  const cellBox = useRef<DOMRect | null>(null);
  const hero = useRef<HTMLDivElement>(null);
  const art = useRef<HTMLDivElement>(null);
  const term = useRef<HTMLDivElement>(null);
  /* A touch screen has no "leave": a tap anywhere outside the hive closes the card. */
  useEffect(() => {
    if (!pointed) return undefined;
    const close = (e: PointerEvent) => {
      if (art.current && !art.current.contains(e.target as Node)) setPointed(null);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [pointed]);
  function point(key: string | null, cell?: DOMRect) {
    cellBox.current = cell ?? null;
    setPointed(key);
  }
  /* Placed AFTER the card has rendered the new machine's lines and before the frame is painted: measured
     while it was still empty, a card is a 40px title bar, and one clamped by that height ran off the
     bottom of the screen. Worked out in the art's coordinates, applied in the hero's - the card is the
     hero's child, not the art's, so the strip's fade-out mask never cuts a card that is taller than a
     short phone's strip. */
  useIsoLayoutEffect(() => {
    const cell = cellBox.current;
    const card = term.current;
    const box = art.current?.getBoundingClientRect();
    const origin = hero.current?.getBoundingClientRect();
    if (!pointed || !cell || !card || !box || !origin) return;
    const wide = window.matchMedia('(min-width: 1200px)').matches;
    const spot = placeCard(cell, box, card.offsetWidth, card.offsetHeight, wide, window.innerHeight);
    setAt({ left: Math.round(spot.left + box.left - origin.left), top: Math.round(spot.top + box.top - origin.top) });
  }, [pointed]);
  return (
    <div className="landing-hero-wrap" id={HERO_ID} data-loop="">
      <section className="landing-hero" aria-labelledby="hero-title" ref={hero}>
        <div className="landing-copy">
          <Badge variant="secondary" rounded="full" className="landing-pill" leftSlot={<Dot />}>
            Coming soon<i aria-hidden="true" className="landing-pill-sep" />
            <span className="text-ink-primary">A live agent for QA and IT</span>
          </Badge>
          <Typography variant="h1" id="hero-title" className="landing-h1">
            <span className="block">Every machine.</span>
            <span className="landing-grad block">One hive.</span>
          </Typography>
          <Typography className="landing-sub">
            <b>Hivelink</b> puts a live AI agent on every Windows PC, Mac and test VM you run. Write tests in plain
            words: it runs them on the real screen, every night, and the machine itself decides pass or fail. Or
            hand it any job&nbsp;— it lives on that machine and works in any app.
          </Typography>
          <WaitlistForm endpoint={endpoint} className="landing-wait" />
          <ul className="landing-os font-mono">
            {FACTS.map((f) => (
              <li key={f}>
                <i aria-hidden="true" />
                {f}
              </li>
            ))}
          </ul>
          <nav className="landing-jumps" aria-label="Jump to">
            <a className="landing-jump" href="#qa" onClick={smoothJump}>
              <i className="landing-jump-hex" aria-hidden="true" />
              For QA — how it tests
              <span className="landing-jump-arrow" aria-hidden="true">
                ↓
              </span>
            </a>
            <a className="landing-jump" href="#it" onClick={smoothJump}>
              <i className="landing-jump-hex landing-jump-hex--it" aria-hidden="true" />
              For IT — where it lives
              <span className="landing-jump-arrow" aria-hidden="true">
                ↓
              </span>
            </a>
          </nav>
        </div>

        <div className="landing-art hl-entrance" ref={art} onMouseLeave={() => setPointed(null)}>
          <GlassHive className="landing-hive" active={pointed} onPoint={point} />
        </div>
        <HiveTerminal
          ref={term}
          className="landing-term"
          style={at ? ({ left: at.left, top: at.top, bottom: 'auto' } as CSSProperties) : undefined}
          machine={pointed ? HIVE_MACHINES[pointed] ?? null : null}
        />
      </section>
    </div>
  );
}
