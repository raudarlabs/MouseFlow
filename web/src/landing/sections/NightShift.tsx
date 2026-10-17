/* 03 · THE NIGHT SHIFT - once one run is believable (01) and its green is proven (02), the next question is
 * whether it runs without anyone there. This is the QA lead's real value: regressions guarded overnight and
 * read in the morning. So the stage is one night told in three panels -
 *
 *   last night        Wednesday on two machines: three tests one after another on qa-vm-1 from 02:00, and
 *                     finance-pc, which was not listening when its 06:00 skill came due
 *   the rows          each test's row of nights, the admin's Skills list at landing scale
 *   9 a.m.            the answer from Claude, naming 02's failure in the test's own words
 *
 * - then the clock's kinds and the four honest rules, stated as features, and the page's first "Join the
 * waitlist" (this is the first "I want this"). finance-pc's dashed miss is the question 04 answers: what makes
 * a machine always on?
 *
 * ONE TIMELINE (SCORE below) plays the three panels in order: the honey marker sweeps the night, the rows
 * fill, the answer arrives. It plays once and again only after the section has fully left the screen.
 *
 * NO PANEL IS EVER AN EMPTY SHELL. The rows show every night as a faint ghost hex before its colour pops
 * in, and a row that starts open holds a pending line where its detail will land; the morning card is there
 * from the start - the question, the tool Claude called thinking, the answer's box with pending lines - and
 * only the answer itself arrives. And the answer is never kept from a reader who is looking at it: while
 * the card is in view the clock runs RUSH times faster until the answer is in (a time-lapse of the night
 * above it, well under a second); a reader on the rows gets the sweep hurried to them the same way.
 *
 * Every claim is the product's: Nightly is 02:00 on weekdays in your zone, a run more than 30 minutes late is
 * missed and never run late, one mouse per machine, three failures in a row pause a schedule, Test now takes
 * the schedule's queue, and mouseflow_case_results is the tool that answers "did anything break last night?".
 */
import { useEffect, useRef, useState } from 'react';
import { CalendarClock, Repeat, Timer } from 'lucide-react';
import { revealGroup, revealItem, useInView, useTimeline } from '../motion';
import { Grad, HexDot, JoinCta, Section } from './kit';
import { MorningCard, type MorningCopy } from './NightShift/MorningCard';
import { NightPanel } from './NightShift/NightPanel';
import { SkillRows } from './NightShift/SkillRows';
import { passAt } from './NightShift/sweep';
import type { NightBlock, NightLane, SkillRow } from './NightShift/types';
import './NightShift.css';

/* ── THE COPY ── */

const LEAD =
  'Nightly is one button: 02:00 on weekdays, in your time zone. Tests run one after another on a machine that’s awake and taking work, and by morning every test has a row of nights — the one that broke names its check, in its own words, with the frame where it failed.';

const NIGHT_LABEL =
  'Example: last night on two machines — three tests ran one after another on qa-vm-1 from 02:00; finance-pc was asleep when its 06:00 skill was due, so it was marked missed.';

const NIGHT_CAPTION = 'Illustration of one example night, played about 6,000× faster.';

const LANES: NightLane[] = [
  { name: 'qa-vm-1', platform: 'Windows 11 VM', status: 'online' },
  { name: 'finance-pc', platform: 'Windows 11', status: 'offline' },
];

const BLOCKS: NightBlock[] = [
  { id: 'invoice', lane: 0, time: '02:00', name: 'Invoice total is right', result: 'fail', tag: 'failed a check' },
  { id: 'outlook', lane: 0, time: '02:02', name: 'Outlook still sends', result: 'pass', tag: 'passed' },
  { id: 'saved', lane: 0, time: '02:04', name: 'Saved, then still saved', result: 'pass', tag: 'passed' },
  /* Due at 06:00; the machine was next heard from 47 minutes later, and that is when the miss was recorded. */
  { id: 'q3', lane: 1, time: '06:00', until: '06:47', name: 'Q3 export', result: 'missed', tag: 'missed', note: 'nothing was listening' },
];

const p = 'pass' as const;
const ROWS: SkillRow[] = [
  {
    id: 'invoice',
    name: 'Invoice total is right',
    sub: 'test · qa-vm-1',
    nights: [p, p, p, 'grey', p, p, p, p, p, 'fail'],
    outcome: { kind: 'fail', word: 'failed a check' },
    detail: '“Total” holds “1,204.00”, not “1,240.00”. Frame kept.',
    summary: 'Last 10 nights: 8 passed, 1 no verdict, then failed a check last night.',
  },
  {
    id: 'outlook',
    name: 'Outlook still sends',
    sub: 'test · qa-vm-1',
    nights: [p, p, p, p, p, p, p, p, p, p],
    outcome: { kind: 'pass', word: 'passed' },
    detail: '2 held.',
    summary: 'Last 10 nights: all passed.',
  },
  {
    id: 'saved',
    name: 'Saved, then still saved',
    sub: 'test · Chrome',
    nights: [p, p, p, p, p, p, 'grey', p, p, p],
    outcome: { kind: 'pass', word: 'passed' },
    detail: '“Saved” caught before the message faded.',
    summary: 'Last 10 nights: 9 passed, 1 no verdict.',
  },
  {
    id: 'q3',
    name: 'Q3 export',
    sub: 'skill · finance-pc, weekdays 06:00',
    nights: [p, p, p, p, p, p, p, p, p],
    missed: true,
    outcome: { kind: 'missed', word: 'missed by 47 min' },
    detail: 'nothing was listening when it was due.',
    summary: 'Last 9 runs passed; missed last night, so no dot was added.',
  },
];

const ROWS_TITLE = { list: 'Skills', failing: '1 test failing' };
const LEGEND = { pass: 'passed', fail: 'failed a check', grey: 'no verdict', missed: 'missed', order: 'oldest on the left' };

const MORNING: MorningCopy = {
  kicker: 'Thu 09:04 · asked in Claude',
  ask: 'Did anything break last night?',
  tool: 'mouseflow_case_results',
  lead: (
    <>
      One thing. <b>“Invoice total is right”</b> failed check 1 on qa-vm-1:
    </>
  ),
  check: {
    statement: '“Total” holds “1,240.00”',
    evidence: '“Total” holds “1,204.00”, not “1,240.00”',
    proves: 'The check that proves the total is hours × rate.',
  },
  rest: (
    <>
      The frame where it failed is kept. <b>“Outlook still sends”</b> and <b>“Saved, then still saved”</b> passed. <b>“Q3 export”</b> was missed by 47
      minutes: finance-pc wasn’t listening when it was due, so nothing ran and nothing is painted red.
    </>
  ),
  actions: ['Open the frame', 'Test now'],
  note: 'Test now goes through the same queue as the 02:00 run.',
};

const SCHEDULES_LABEL = 'Put anything on a clock';
const SCHEDULES = [
  { id: 'nightly', icon: 'switch', name: 'Nightly', detail: '02:00 on weekdays' },
  { id: 'every', icon: Repeat, name: 'Every 6 hours' },
  { id: 'daily', icon: CalendarClock, name: 'Weekdays at 09:00' },
  { id: 'once', icon: Timer, name: 'Once, at 19:41' },
] as const;

const RULES = [
  { title: 'Late is missed', body: 'More than 30 minutes late? It’s marked missed and counted — never run hours late.' },
  {
    title: 'One mouse per machine',
    body: 'Tests run one after another, about two minutes each: 100 tests is roughly 3.5 hours of night. Add a VM to go wider.',
  },
  { title: 'Three strikes, it pauses', body: 'Three failures in a row pause the schedule, with the reason in words.' },
  {
    title: 'Test now takes the night path',
    body: 'A manual run goes through the same queue as the schedule, so you test the path that runs at 02:00.',
  },
];

/* ── THE SCORE: one timeline, three panels ──
   0      the panels reveal (scroll reveals, 720ms); the tool is thinking in the morning card from here on
   600    the marker sweeps the night to 09:00 (4.2s, --m-inout); runs arrive as it reaches them
   4800   the rows of nights cascade in over their ghosts, 30ms a dot; the red one rings; details land
   6200   the answer arrives in its box, the tool's dots turn into a tick, the product's buttons follow */
const SWEPT = passAt(1);
const SCORE = {
  rows: SWEPT,
  answer: SWEPT + 1400,
  actions: SWEPT + 1600,
  duration: SWEPT + 2300,
};
/* Acts: a paused demo resumes from the start of its act - the sweep restarts whole, the rows refill. */
const ACTS = [0, 600, SCORE.rows, SCORE.answer - 400];
/* How much faster the clock runs while it catches up with a reader who is looking further on than it is:
   from the very start to the answer is 6.2s of score, under 0.8s at this rate. */
const RUSH = 8;

export function NightShift() {
  const root = useRef<HTMLDivElement>(null);
  const night = useRef<HTMLDivElement>(null);
  const rows = useRef<HTMLDivElement>(null);
  const morning = useRef<HTMLDivElement>(null);

  /* Where the reader is looking decides whether the clock may hurry. The answer is the section's payoff:
     with the card in view the clock hurries to it, even if the night above is in view too (it then plays
     as a time-lapse). On the rows alone it hurries only to the rows - and not while the night, the sweep's
     own audience, is in view. */
  const nightIn = useInView(night, { threshold: 0.35 });
  const rowsIn = useInView(rows, { threshold: 0.35 });
  const morningIn = useInView(morning, { threshold: 0.35 });
  const target = morningIn ? SCORE.answer : rowsIn && !nightIn ? SCORE.rows : 0;

  const [rush, setRush] = useState(false);
  const tl = useTimeline(root, {
    duration: SCORE.duration,
    acts: ACTS,
    threshold: 0.35,
    /* Pointing at the night freezes the sweep; reading the rows or the answer does not. */
    pauseOn: night,
    replayOnReenter: true,
    rate: rush ? RUSH : 1,
  });

  const targetRef = useRef(target);
  targetRef.current = target;
  const rushRef = useRef(false);
  useEffect(
    () =>
      tl.subscribe((t) => {
        const next = t < targetRef.current;
        if (next !== rushRef.current) {
          rushRef.current = next;
          setRush(next);
        }
      }),
    [tl],
  );

  return (
    <Section
      id="nightly"
      index="03"
      label="The night shift"
      head="split"
      pool="right"
      seam="honey"
      title={
        <>
          Press Nightly. <Grad>Read the verdict over coffee.</Grad>
        </>
      }
      lead={LEAD}
      foot={<JoinCta note="Early access opens soon." />}
    >
      <div ref={root} className="ns-demo">
        <NightPanel timeline={tl} lanes={LANES} blocks={BLOCKS} range="Wed 02:00 → Thu 09:00" label={NIGHT_LABEL} caption={NIGHT_CAPTION} panelRef={night} />
        <div className="ns-lower">
          <SkillRows rows={ROWS} title={ROWS_TITLE} legend={LEGEND} at={SCORE.rows} panelRef={rows} />
          <MorningCard copy={MORNING} at={{ answer: SCORE.answer, actions: SCORE.actions }} colRef={morning} />
        </div>
      </div>

      <div className="ns-more">
        <div className="ns-clock" {...revealGroup()}>
          <p className="ns-clock-label" id="nightly-clock" {...revealItem(0)}>
            {SCHEDULES_LABEL}
          </p>
          <ul className="ns-clock-list" aria-labelledby="nightly-clock">
            {SCHEDULES.map((s, i) => (
              <li key={s.id} className="ns-sched" {...revealItem(i + 1)}>
                {s.icon === 'switch' ? <i className="ns-switch" aria-hidden="true" /> : <s.icon aria-hidden strokeWidth={2} />}
                <span>{s.name}</span>
                {'detail' in s && <span className="ns-sched-d">{s.detail}</span>}
              </li>
            ))}
          </ul>
        </div>
        <ul className="ns-rules" {...revealGroup()}>
          {RULES.map((r, i) => (
            <li key={r.title} className="ns-rule" {...revealItem(i)}>
              <HexDot kind="ice" size={8} className="ns-rule-hex" />
              <div>
                <h3 className="ns-rule-t">{r.title}</h3>
                <p className="ns-rule-x">{r.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
