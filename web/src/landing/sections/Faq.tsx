/* 08 · QUESTIONS - the remaining objections in plain words, including what Hivelink does not do. An honest
 * FAQ is itself a trust signal, and it is quiet on purpose: a breathing space after the dense demos, with
 * the decision left to 09.
 *
 * FAQ is the one list of questions: this section renders it, and scripts/build-landing.mjs turns the same
 * array into the FAQPage JSON-LD at prerender (through entry-server.tsx), so the visible answers and the
 * structured ones can never drift apart. That is also why the section emits no JSON-LD of its own: a second
 * FAQPage on one URL is a structured-data error. Plain strings on purpose - search engines get the words as
 * they are; dress() below only wraps a few of those words for the eye (a status chip, a mono term), and the
 * text a reader or a crawler gets is the string, letter for letter.
 *
 * THREE TOPICS OF FOUR. Twelve identical rows are a wall; the same twelve, in the same order, read as three
 * short answers to three questions a buyer actually asks - what is it, where does it fit, what should I
 * know before I start. Each topic has a small mono heading in the list (an <h3>, so the outline is real).
 * From 1200 the left column is the section's head, sticky beside the list, and under it an index of the
 * three topics whose ice marker follows the topic in the middle of the screen - the empty column becomes
 * a map of the list. Without a script the index is three plain anchors and the marker is not drawn.
 *
 * NATIVE <details>. It opens and closes without a script, with Enter and Space, inside find-in-page, and
 * for crawlers; several answers can be open at once. The first one is open in the server HTML. Heights
 * snap - the page never animates a height - and the motion is all transform and opacity: the answer
 * settles in 4px (--m-base, --m-out), the +/× glyph turns 45° and crossfades to honey (the section's one
 * honey: "this one is open"), and on close the answer leaves first (--m-exit) so the snap lands on a row
 * that has already let go. With reduced motion every one of these is an instant swap.
 */
import { useEffect, useRef, type AnimationEvent, type MouseEvent, type ReactNode } from 'react';
import { callWaitlist } from '../call-waitlist';
import { motionAllowed, reveal, revealGroup, revealItem, smoothJump } from '../motion';
import { Grad, HexDot, Section, SectionHead, StatusChip } from './kit';
import './Faq.css';

export interface FaqItem {
  /** The item's id, so a link can open it: /#faq-ai-verdict. */
  id: string;
  q: string;
  a: string;
}

export const FAQ: FaqItem[] = [
  {
    id: 'faq-what',
    q: 'What is Hivelink?',
    a: 'A live AI agent on each of your Windows PCs, Macs and test VMs, plus one account that sees them all. You give it tests and jobs in plain words. It carries them out on that machine’s own screen, in any app, and brings back every step, the checks the machine decided and the frames that prove them.',
  },
  {
    id: 'faq-recorder',
    q: 'Is it a test recorder?',
    a: 'No. Nothing is recorded and replayed. A test is a goal in words plus up to eight checks, and the agent decides every step from a fresh look at the screen, on every run.',
  },
  {
    id: 'faq-ai-verdict',
    q: 'Does the AI decide whether my test passed?',
    a: 'No — that’s the point. The model chooses each step. The machine decides each check, from the accessibility tree on the desktop or from the page itself in Chrome. The verdict is computed from what was recorded, and nothing without evidence is ever green.',
  },
  {
    id: 'faq-identical',
    q: 'Will every run be identical?',
    a: 'No, and the verdict doesn’t need it to be. Every step is a model decision, so two runs can take slightly different paths. What stays fixed is the arithmetic: only checks with evidence turn green, and a run that couldn’t prove anything is grey, not red.',
  },
  {
    id: 'faq-apps',
    q: 'Which apps can it test?',
    a: 'Desktop apps on Windows and macOS that name their controls — Outlook, Excel, File Explorer, your in-house WinForms or WPF app, native dialogs — plus web apps in Chrome through the Hivelink extension. Apps that name almost nothing, like many Electron and canvas apps, come back CANNOT CHECK: grey, never a false pass. There are no phone apps, and no browsers other than Chrome.',
  },
  {
    id: 'faq-server',
    q: 'Can I put it on a server and leave it there?',
    a: 'Yes, if the server is an always-on Windows PC or VM, or a Mac, that keeps a signed-in, unlocked desktop session. The agent works on the screen, so it needs one. It starts when that user signs in, not as a background service, and from then on asks for work by itself. Windows Server, headless boxes, Docker and Linux aren’t supported.',
  },
  {
    id: 'faq-shell',
    q: 'Can it run shell commands or scripts?',
    a: 'No. Its commands are jobs in plain words, carried out through the screen the way a person would: open the app, click, type, check. It opens apps by name, never by command line, and refuses to drive its own terminal.',
  },
  {
    id: 'faq-testrail',
    q: 'Does it work with TestRail, Jira or CI?',
    a: 'Through your own AI. Connect Claude to Hivelink over MCP and to your test-management tool. Claude can then run a case with its id as ref, get the verdict check by check, and write it back. There’s no built-in TestRail, Jira or CI integration, and no JUnit export yet.',
  },
  {
    id: 'faq-throughput',
    q: 'How many tests can one machine run in a night?',
    a: 'A machine has one mouse, so its tests run one after another. At about two minutes a test, 100 tests take roughly three and a half hours. For more, add a second VM and split the tests.',
  },
  {
    id: 'faq-asleep',
    q: 'What if the machine is asleep at 02:00?',
    a: 'Then nothing runs, and it says so. Hivelink can’t wake a sleeping computer. A run that comes due more than 30 minutes late is marked missed instead of running hours later. Three failures in a row pause a schedule, with the reason in words.',
  },
  {
    id: 'faq-screen',
    q: 'Does my screen leave the computer?',
    a: 'Yes, during a run. Each step sends a screenshot to the model — Anthropic’s Claude by default — to decide the next action. Frames are kept as evidence only for runs that made a check or ended badly: at most 12 per run, for 30 days, private to your account. Delete my data erases runs, frames, schedules, tests and machine tokens in one go.',
  },
  {
    id: 'faq-try',
    q: 'When can I try it?',
    a: 'Early access opens soon. Join the waitlist and we’ll email you once, when the hive opens.',
  },
];

/* The topics, in the list's own order: four questions each. `slug` names the topic's anchor (#faq-fits);
   it is not an item id, so the hash effect below never tries to open it. */
interface Topic {
  slug: string;
  label: string;
  from: number;
  to: number;
}

const TOPICS: Topic[] = [
  { slug: 'is', label: 'What it is', from: 0, to: 4 },
  { slug: 'fits', label: 'Where it fits', from: 4, to: 8 },
  { slug: 'start', label: 'Before you start', from: 8, to: 12 },
];

const two = (n: number) => String(n).padStart(2, '0');
/** "01–04": the topic's rows, by the numbers the rows carry from 768. */
const range = (t: Topic) => `${two(t.from + 1)}–${two(t.to)}`;

const TITLE: ReactNode = (
  <>
    Asked around <Grad>the hive.</Grad>
  </>
);
const LEAD = 'Straight answers for QA and IT — including what it doesn’t do yet.';

/* THE WORDS THE PAGE ALREADY TAUGHT. Where an answer uses one of the product's own words, it is shown the way
   the demos above showed it - CANNOT CHECK and missed in their status chips, the status colours as their hex
   dots, `ref` and a button's name as mono terms - so the FAQ reads in the same language as the run cards.
   The last answer's "Join the waitlist" is the one link: it goes to 09's form, right below. */
const DRESS: Record<string, (key: number) => ReactNode> = {
  'CANNOT CHECK': (k) => (
    <StatusChip key={k} kind="cannot" size="sm" className="hl-faq-chip">
      CANNOT CHECK
    </StatusChip>
  ),
  missed: (k) => (
    <StatusChip key={k} kind="missed" size="sm" className="hl-faq-chip">
      missed
    </StatusChip>
  ),
  ref: (k) => (
    <code key={k} className="hl-chip hl-chip--sm hl-faq-chip">
      ref
    </code>
  ),
  'Delete my data': (k) => (
    <span key={k} className="hl-chip hl-chip--sm hl-faq-chip">
      Delete my data
    </span>
  ),
  green: (k) => <Tone key={k} kind="pass" word="green" />,
  grey: (k) => <Tone key={k} kind="grey" word="grey" />,
  red: (k) => <Tone key={k} kind="fail" word="red" />,
  'Join the waitlist': (k) => (
    <a key={k} href="#join" onClick={callWaitlist} className="hl-faq-link">
      Join the waitlist
    </a>
  ),
};

const WORDS = new RegExp(`\\b(${Object.keys(DRESS).join('|')})\\b`);

/** A colour word with its status dot in front: the dot is decoration, the word is the text. */
function Tone({ kind, word }: { kind: 'pass' | 'grey' | 'fail'; word: string }) {
  return (
    <span className="hl-faq-tone">
      <HexDot kind={kind} size={8} />
      {word}
    </span>
  );
}

/** The answer string with its product words dressed; split() with a capture group alternates text, word. */
function dress(text: string): ReactNode[] {
  return text.split(WORDS).map((part, i) => (i % 2 ? DRESS[part]!(i) : part));
}

/* OPEN AND CLOSE, ON TOP OF THE NATIVE TOGGLE. With motion allowed a press on an open row lets the answer
   fade out first and closes it when that is done; a press on a closed row lets the browser open it and
   marks it .is-opening so the answer settles in. A press during the fade-out keeps the row open. Without
   motion nothing here runs and the browser's own toggle is the whole behaviour - as it is with no script. */
const EXIT_MS = 170; // --m-exit
const closing = new WeakMap<HTMLDetailsElement, number>();

function arrive(item: HTMLDetailsElement) {
  item.classList.remove('is-closing');
  item.classList.add('is-opening');
}

function onPress(e: MouseEvent<HTMLElement>) {
  const item = e.currentTarget.parentElement;
  if (!(item instanceof HTMLDetailsElement)) return;
  const pending = closing.get(item);
  if (pending !== undefined) {
    e.preventDefault();
    window.clearTimeout(pending);
    closing.delete(item);
    item.classList.remove('is-closing');
    return;
  }
  if (!motionAllowed()) return;
  if (!item.open) {
    arrive(item);
    return;
  }
  e.preventDefault();
  item.classList.remove('is-opening');
  item.classList.add('is-closing');
  closing.set(
    item,
    window.setTimeout(() => {
      closing.delete(item);
      item.open = false;
      item.classList.remove('is-closing');
    }, EXIT_MS),
  );
}

/** .is-opening comes off when the answer has settled, so the next open plays again. */
function onSettled(e: AnimationEvent<HTMLDetailsElement>) {
  if (e.animationName === 'hl-detail-in') e.currentTarget.classList.remove('is-opening');
}

/** The +/× in its hex frame: an ice layer and a honey layer stacked, crossfaded - a colour never transitions. */
function Glyph() {
  const art = (
    <>
      <polygon points="12,1.5 21.09,6.75 21.09,17.25 12,22.5 2.91,17.25 2.91,6.75" />
      <path className="hl-faq-plus" d="M12 7.75v8.5M7.75 12h8.5" />
    </>
  );
  return (
    <span className="hl-faq-glyph" aria-hidden="true">
      <svg className="hl-faq-g hl-faq-g--ice" viewBox="0 0 24 24" focusable="false">
        {art}
      </svg>
      <svg className="hl-faq-g hl-faq-g--honey" viewBox="0 0 24 24" focusable="false">
        {art}
      </svg>
    </span>
  );
}

/** A label drawn twice, dim and lit, in one grid cell: the index's "you are here" is an opacity crossfade. */
function Lit({ children }: { children: ReactNode }) {
  return (
    <span className="hl-faq-lit">
      <span>{children}</span>
      <span className="hl-faq-lit-on" aria-hidden="true">
        {children}
      </span>
    </span>
  );
}

export function Faq() {
  const nav = useRef<HTMLElement>(null);
  const list = useRef<HTMLDivElement>(null);

  /* A link to one answer (/#faq-screen) opens it: native <details> does not open for its own fragment. */
  useEffect(() => {
    const open = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      const item = id ? document.getElementById(id) : null;
      if (!(item instanceof HTMLDetailsElement) || item.open) return;
      if (motionAllowed()) arrive(item);
      item.open = true;
    };
    open();
    window.addEventListener('hashchange', open);
    return () => window.removeEventListener('hashchange', open);
  }, []);

  /* The index follows the topic crossing a thin band at 38-42% of the screen - one IntersectionObserver, no
     scroll listener - and writes data-at on the nav; CSS moves the marker and lights the label. The topics
     touch (their spacing is padding), so wherever the band lies inside the list, one of them is the current
     one; above or below the list the last answer stands. It runs at every width - three observed boxes cost
     nothing - though the index is only shown from 1200. */
  useEffect(() => {
    const el = nav.current;
    const groups = list.current?.querySelectorAll<HTMLElement>('[data-topic]');
    if (!el || !groups?.length || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) el.dataset.at = (e.target as HTMLElement).dataset.topic;
      },
      { rootMargin: '-38% 0px -58% 0px' },
    );
    groups.forEach((g) => io.observe(g));
    return () => io.disconnect();
  }, []);

  return (
    <Section id="faq" index="08" label="Questions" head="none" pool="none" title={TITLE} lead={LEAD} stageClassName="hl-faq-stage">
      <div className="hl-faq-cols">
        {/* The head is the section's own (head="none" on the Section), so the index can sit under it in the
            same sticky column. --i-base 0 there: the head keeps its 0 / 70 / 140ms, the index follows at 210. */}
        <div className="hl-faq-side">
          <SectionHead id="faq" index="08" label="Questions" title={TITLE} lead={LEAD} layout="stack" />
          <nav ref={nav} className="hl-faq-nav" aria-label="Questions by topic" {...reveal('up', 3)}>
            <span className="hl-faq-mark" aria-hidden="true" />
            <ol>
              {TOPICS.map((t) => (
                <li key={t.slug}>
                  <a href={`#faq-${t.slug}`} onClick={smoothJump}>
                    <span className="hl-faq-nav-n" aria-hidden="true">
                      {range(t)}
                    </span>
                    <Lit>{t.label}</Lit>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </div>

        {/* One reveal group: topics and rows rise together on the system's stagger (after the head's three
            steps, capped at six), so the list arrives as one gesture rather than fifteen. */}
        <div ref={list} className="hl-faq" {...revealGroup()}>
          {TOPICS.map((t, ti) => (
            <div key={t.slug} className="hl-faq-topic" data-topic={ti}>
              <h3 id={`faq-${t.slug}`} className="hl-faq-th" {...revealItem(t.from + ti, 'fade')}>
                <i className="hl-faq-th-hex" aria-hidden="true" />
                <span>{t.label}</span>
                <i className="hl-faq-th-rule" aria-hidden="true" />
                <span className="hl-faq-th-n" aria-hidden="true">
                  {range(t)}
                </span>
              </h3>
              {FAQ.slice(t.from, t.to).map((f, j) => {
                const n = t.from + j;
                return (
                  <details
                    key={f.id}
                    id={f.id}
                    className="hl-faq-item"
                    open={n === 0}
                    onAnimationEnd={onSettled}
                    {...revealItem(n + ti + 1)}
                  >
                    <summary className="hl-faq-q" onClick={onPress}>
                      <span className="hl-faq-n" aria-hidden="true">
                        {two(n + 1)}
                      </span>
                      <span className="hl-faq-qt">{f.q}</span>
                      <Glyph />
                    </summary>
                    {/* hl-entrance: an answer opened off screen (a /#faq-… link) still arrives - the section's
                        off-screen pause must not hold it at its first, invisible frame. */}
                    <div className="hl-faq-a hl-entrance">
                      <p>{dress(f.a)}</p>
                    </div>
                  </details>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
