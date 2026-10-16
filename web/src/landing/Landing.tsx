/* THE HIVELINK LANDING - hivelink.si, coming soon.
 *
 * The chosen concept, "Glass Hive · Arctic Honey" (hivelink/concepts/05d-glasshive-arctic, owner
 * 2026-10-16), rebuilt from the app's own parts: the design system's Button, Input, Badge, Card and
 * Typography, the palette's tokens, the app's three faces, the shared HiveMark, and the hive drawn by
 * components in brand/ that the admin can use too. One design system for the site and the admin was the
 * decision; a landing written in its own CSS with its own hex values would be the second one.
 *
 * Same composition, copy and feel as the concept, with two deliberate departures:
 *   - the concept's social links went to "#". There are no accounts to link to yet, and a footer of icons
 *     that lead nowhere is worse than none, so the footer has none;
 *   - the concept's form said "you are on the list" without sending anything. This one posts to the
 *     waitlist API and says what the server said (WaitlistForm.tsx, waitlist.ts).
 *
 * Every claim on the page is a product fact: Windows and macOS only, plain words, any app because it works
 * from a picture of the screen, Logs as proof, Skills, schedules and Checks, your own AI over MCP, one
 * account for the whole hive. No numbers, no customers, no quotes - there are none yet to show.
 *
 * Rendered to static HTML at build time (entry-server.tsx, scripts/build-landing.mjs) and hydrated by
 * main.tsx, so it must render the same on both sides: nothing here reads the window during render.
 */
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { Badge } from '@insightis/ui/Badge';
import { buttonVariants } from '@insightis/ui/Button';
import { Card } from '@insightis/ui/Card';
import { Typography } from '@insightis/ui/Typography';
import { HiveMark } from '@/components/brand/HiveMark';
import { GlassHive } from '@/components/brand/GlassHive';
import { GlassCell, GlassCellAccent, GlassCellCore, GlassCellPanel } from '@/components/brand/GlassCell';
import { HiveTerminal } from '@/components/brand/HiveTerminal';
import { HIVE_MACHINES } from '@/components/brand/hive-machines';
import { WaitlistForm } from './WaitlistForm';

/** The honey "now" dot, the concept's: the one warm light outside the hive. */
const Dot = () => <i aria-hidden="true" className="landing-dot" />;

const Brand = ({ small }: { small?: boolean }) => (
  <a className={small ? 'landing-brand landing-brand-sm' : 'landing-brand'} href="./" aria-label="Hivelink home">
    <HiveMark className="landing-brand-mark" />
    <b className="font-display">hivelink</b>
  </a>
);

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

interface Prop {
  num: string;
  title: string;
  body: string;
  chip: ReactNode;
  glyph: ReactNode;
}

const PROPS: Prop[] = [
  {
    num: '01',
    title: 'Tell the hive what to do',
    body: 'Say it in plain words, for one bee or the whole swarm. Each agent works from a picture of its screen, so it reaches Excel, Explorer and any desktop window, not only a browser tab.',
    chip: (
      <>
        <span className="landing-chip-p">›</span> “reply to Ann: invoice approved”
      </>
    ),
    glyph: (
      <>
        <GlassCellPanel d="M4 4.5h16A1.5 1.5 0 0 1 21.5 6v12a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 18V6A1.5 1.5 0 0 1 4 4.5Z" />
        <GlassCellAccent d="m7 10 3 2.5L7 15M12.5 15.5H17" />
      </>
    ),
  },
  {
    num: '02',
    title: 'One hive, every machine',
    body: 'Every computer becomes a named cell. One account sees the whole hive: which bees are connected, which are buzzing right now, and what each one did.',
    chip: (
      <>
        <span className="landing-chip-p">●</span> laptop-ann <span className="landing-chip-k">·</span> online now
      </>
    ),
    glyph: (
      <>
        <GlassCellCore cx={12} cy={12} r={3} />
        <circle cx="4.5" cy="6" r="2" />
        <circle cx="19.5" cy="6" r="2" />
        <circle cx="4.5" cy="18" r="2" />
        <circle cx="19.5" cy="18" r="2" />
        <GlassCellAccent d="M6.3 7.3 9.6 10.2M17.7 7.3l-3.3 2.9M6.3 16.7l3.3-2.9M17.7 16.7l-3.3-2.9" />
      </>
    ),
  },
  {
    num: '03',
    title: 'Every bee brings back proof',
    body: 'Logs show what was asked, what the bee actually did and how it ended, with Stop and Relaunch. A run that worked turns into honey, a Skill: run it again, schedule it, or add Checks so it tests itself.',
    chip: (
      <>
        <span className="landing-chip-p">●</span> ok <span className="landing-chip-k">·</span> could not finish{' '}
        <span className="landing-chip-k">·</span> stopped
      </>
    ),
    glyph: (
      <>
        <GlassCellPanel d="M12 2.8 19.8 7.3v9.4L12 21.2 4.2 16.7V7.3Z" />
        <GlassCellAccent d="m8.4 12.3 2.5 2.5 4.7-5" />
      </>
    ),
  },
];

/* THE HEADER'S "JOIN THE WAITLIST" GOES TO THE ONE FORM. The page has one waitlist and one call to it, said
 * the same way twice; the header's copy is a shortcut, not a second form. On most screens the form is
 * already in view, so a plain #waitlist jump moves nothing and the press looks dead - this brings the form
 * to the middle of the screen, puts the cursor in the address field and lets the field glow once, so the
 * press visibly lands somewhere. Before hydration the href still jumps to #waitlist. */
function callWaitlist(e: MouseEvent<HTMLAnchorElement>) {
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

export function Landing({ endpoint }: { endpoint: string }) {
  /* Which machine cell is being pointed at. Null at rest - and on the server, so the prerender and the
   * first client render agree. */
  const [pointed, setPointed] = useState<string | null>(null);
  /* Where the card opens: beside the pointed cell, on whichever side has room, so it never covers the
   * glass it is talking about. Measured from the cell's own box at the moment it is pointed at - nothing
   * is read from the window during render. Null keeps the stylesheet's resting place (and the phone's). */
  const [at, setAt] = useState<{ left: number; top: number } | null>(null);
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
    setPointed(key);
    const box = art.current?.getBoundingClientRect();
    if (!key || !cell || !box || !window.matchMedia('(min-width: 1200px)').matches) return;
    const w = term.current?.offsetWidth ?? 372;
    const h = term.current?.offsetHeight ?? 260;
    const gap = 18;
    const right = cell.right - box.left + gap;
    const left = right + w <= box.width ? right : Math.max(0, cell.left - box.left - gap - w);
    const top = Math.min(Math.max(8, cell.top + cell.height / 2 - box.top - h / 2), box.height - h - 8);
    setAt({ left: Math.round(left), top: Math.round(top) });
  }
  return (
    <div className="landing">
      <Backdrop />

      <div className="landing-hero-wrap">
        <header className="landing-top">
          <Brand />
          <span className="landing-soon" aria-hidden="true">
            <Dot />
            Early access
          </span>
          <nav className="landing-top-cta" aria-label="Primary">
            <span className="landing-soon">
              <Dot />
              Coming soon
            </span>
            {/* A link, so it is an <a> - in the Button's own look. Not `<Button asChild>`: the vendored Button
                wraps its label in a span between two slots, and Radix's Slot refuses more than one child. */}
            <a href="#waitlist" onClick={callWaitlist} className={buttonVariants({ variant: 'secondary', rounded: 'full', size: 'lg', className: 'landing-glass-btn' })}>
              Join the waitlist
            </a>
          </nav>
        </header>

        <main className="landing-hero" id="main">
          <div className="landing-copy">
            <Badge variant="secondary" rounded="full" className="landing-pill" leftSlot={<Dot />}>
              Coming soon<i aria-hidden="true" className="landing-pill-sep" />
              <span className="text-ink-primary">Early access</span>
            </Badge>
            <Typography variant="h1" className="landing-h1">
              <span className="block">Every machine.</span>
              <span className="landing-grad block">One hive.</span>
            </Typography>
            <Typography className="landing-sub">
              <b>Hivelink</b> builds your hive from AI agents&nbsp;— one worker bee on each of your Windows and Mac
              computers. Tell the hive what to do in plain words: every bee does the job on its own screen, in any
              app, and brings back proof it worked.
            </Typography>
            <WaitlistForm endpoint={endpoint} className="landing-wait" />
            <p className="landing-os font-mono">
              Windows <i aria-hidden="true" /> macOS <i aria-hidden="true" /> one bee on every machine
            </p>
          </div>

          <div className="landing-art" ref={art} onMouseLeave={() => setPointed(null)}>
            <GlassHive className="landing-hive" active={pointed} onPoint={point} />
            <HiveTerminal
              ref={term}
              className="landing-term"
              style={at ? { left: at.left, top: at.top, bottom: 'auto' } : undefined}
              machine={pointed ? HIVE_MACHINES[pointed] ?? null : null}
            />
          </div>
        </main>
      </div>

      <section className="landing-props" aria-labelledby="props-title">
        <div className="landing-props-head">
          <p className="landing-eyebrow font-mono">Inside the hive</p>
          <Typography variant="h2" id="props-title" className="landing-h2">
            Built for people who keep more than one machine buzzing.
          </Typography>
          <Typography className="landing-props-lead">
            Put a bee on each Windows PC and Mac you use, then hand out work in plain words&nbsp;— yourself, or
            through your own AI, like Claude, connected over MCP. The hive does the rest.
          </Typography>
        </div>
        <div className="landing-cards">
          {PROPS.map((p) => (
            <Card key={p.num} variant="outline" rounded="xl" fullWidth className="landing-card">
              <div className="landing-card-top">
                <GlassCell className="landing-cell-ico">{p.glyph}</GlassCell>
                <span className="font-mono landing-num">{p.num}</span>
              </div>
              <Typography variant="h3" className="landing-h3">
                {p.title}
              </Typography>
              <Typography className="landing-card-body">{p.body}</Typography>
              <span className="landing-chip font-mono">{p.chip}</span>
            </Card>
          ))}
        </div>
      </section>

      <footer className="landing-foot">
        <div className="landing-foot-in">
          <Brand small />
          <small>© 2026 Hivelink. The hive opens soon · Early access.</small>
        </div>
      </footer>
    </div>
  );
}
