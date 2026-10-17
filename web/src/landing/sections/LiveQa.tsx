/* 01 · HOW IT TESTS - the QA promise as one loop you can watch: a test written in words (act 1), run by a
 * live agent on qa-vm-1's real screen in the in-house Billing app (act 2), judged by the machine (act 3) -
 * the page's Run Theater, whole.
 *
 * It answers the first question after the hero, "what does it actually do?", and introduces what the rest of
 * the page keeps using: qa-vm-1 (the Windows 11 test VM tagged in the hero's hive), the test "Invoice total
 * is right" in an in-house desktop app browser tools can't reach, and the theater itself. The loop ends on a
 * green verdict and one more dot in the row of nights; the foot link asks the question every QA lead asks
 * next - why trust that green? - which 02 answers.
 *
 * Every word in the side pane is the product's: a goal, its inputs, up to eight checks each with what it
 * proves and when it is made, Nightly at 02:00 on weekdays, the run's steps as Logs writes them, checks read
 * from the accessibility tree (tier "tree"), the verdict computed from them, a kept frame. The screen is a
 * drawing (the caption says so) played about six times faster than a real run (34s of run in 5.6s).
 *
 * THE POSTER. The server renders the finished demo: the steps as an ordered list, all three acts one under
 * another with their labels, the screen at rest after the run. The timeline (13.2s, three acts, looping)
 * takes it over once the script runs and motion is allowed; with reduced motion the Judge act shows and the
 * steps switch between finished acts instantly. Times live in LiveQa/script.ts, the screen in LiveQa/Desk.tsx.
 */
import { useRef, type ReactNode, type Ref } from 'react';
import { cue, reveal, TimelineContext, useTimeline } from '../motion';
import {
  ArrowLink,
  BILLING,
  BillingWindow,
  ClockDigits,
  CueSwap,
  DemoFrame,
  FrozenFrame,
  Grad,
  HexDot,
  Lines,
  LogLine,
  PlayToggle,
  Section,
  StatusChip,
  Theater,
  TheaterBar,
  TierTag,
  Tile,
  TypeText,
  VerdictBar,
} from './kit';
import { Desk } from './LiveQa/Desk';
import { Steps, type Step } from './LiveQa/Steps';
import { useFrameFlight } from './LiveQa/useFrameFlight';
import { ACTS, CLOCK, DURATION, GOAL, J, R, W } from './LiveQa/script';
import './LiveQa.css';

/* ── the words ─────────────────────────────────────────────────────────────────────────────────────── */

const STEPS: Step[] = [
  {
    n: '01',
    label: 'Write',
    title: 'Write it like a test case',
    body: 'A goal in plain words, the values it needs and up to eight checks, each with the sentence it proves. Nothing to record, no selectors to keep alive.',
  },
  {
    n: '02',
    label: 'Run',
    title: 'A live agent runs it',
    body: 'On a real Windows or Mac desktop it reads the screen and the accessibility tree and decides one step at a time — in your in-house app, in Outlook or Excel, or in your own signed-in Chrome.',
  },
  {
    n: '03',
    label: 'Judge',
    title: 'The machine decides',
    body: 'Each check is read from the app itself, never from the model’s opinion, and comes back PASS, FAIL or CANNOT CHECK — with what was actually there.',
  },
];

const TEST = 'Invoice total is right';

const INPUTS = [
  { k: 'customer', v: 'ACME' },
  { k: 'hours', v: '4' },
  { k: 'rate', v: '310' },
];

const CHECKS = [
  { n: 1, kind: 'value is', statement: '“Total” holds 1,240.00', proves: 'the total is hours × rate', when: 'the hours and rate are typed' },
  { n: 2, kind: 'present', statement: '“Invoice saved” is there', proves: 'the invoice was stored', when: 'Save has been pressed' },
  { n: 3, kind: 'absent', statement: '“Error” is not there', proves: 'saving raised nothing', when: 'at the end' },
];

interface Entry {
  time: string;
  at: number;
  done: number;
  text: ReactNode;
  check?: { n: number; note?: string };
}

/* The run as Logs writes it: a line when a step starts, its tick when the next one does. */
const LOG: Entry[] = [
  { time: '02:00:00', at: R.start, done: 4350, text: <>qa-vm-1 took “{TEST}” — by itself, from a schedule</> },
  { time: '02:00:04', at: 4350, done: R.toNew, text: <>Switch to Billing — it is already open</> },
  { time: '02:00:09', at: R.toNew, done: R.toCustomer, text: <>Click “New invoice”</> },
  { time: '02:00:15', at: R.toCustomer, done: R.check1.at, text: <>Type ACME, 4 and 310 into “Customer”, “Hours” and “Rate”</> },
  { time: '02:00:21', at: R.check1.at, done: R.check1.resolve, text: <>“Total” holds 1,240.00</>, check: { n: 1 } },
  { time: '02:00:26', at: R.toSave, done: R.check2.at, text: <>Click “Save”</> },
  {
    time: '02:00:27',
    at: R.check2.at,
    done: R.check2.resolve,
    text: <>“Invoice saved” is there</>,
    check: { n: 2, note: 'made at its moment, before the message faded' },
  },
  { time: '02:00:31', at: R.check3.at, done: R.check3.resolve, text: <>“Error” is not there</>, check: { n: 3 } },
  { time: '02:00:34', at: R.finish, done: R.finish + 300, text: <>Finish — “Created the ACME invoice and saved it.”</> },
];

const EVIDENCE = [
  { n: 1, text: 'Edit “Total” = “1,240.00”' },
  { n: 2, text: 'Text “Invoice saved”, caught at its moment' },
  { n: 3, text: '“Error” not found' },
];

const CAPTION = 'Illustration of one nightly run, played about 6× faster.';
const FIGURE =
  'Example: the test “Invoice total is right” is written in words at 17:40, run by itself on qa-vm-1 at 02:00, and judged passed by three checks read from the accessibility tree.';

/* ── small parts ───────────────────────────────────────────────────────────────────────────────────── */

/** The When? chip's clock glyph. */
const ClockGlyph = () => (
  <svg className="lqa-when-ico" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
    <circle cx="6" cy="6" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.2" />
    <path d="M6 3.6V6l1.7 1.1" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Act 1 · the test as the product's editor shows it. */
function WritePane() {
  return (
    <div data-act-pane="0" className="lqa-pane lqa-write">
      <span className="hl-act-label">Written</span>
      <div className="lqa-test">
        <StatusChip kind="accent" size="sm">
          Test
        </StatusChip>
        <span className="lqa-test-name">{TEST}</span>
        <span className="lqa-test-sub">made from the skill Create an invoice</span>
      </div>

      <Tile className="lqa-goal">
        <span className="lqa-k">Goal</span>
        <p className="lqa-goal-text">
          <span className="lqa-prompt" aria-hidden="true">
            ›
          </span>
          <TypeText text={GOAL} at={W.goal} />
        </p>
        <span className="lqa-k lqa-inputs-k">Inputs</span>
        <div className="lqa-inputs">
          {INPUTS.map((x, i) => (
            <span key={x.k} className="lqa-input" {...cue(W.inputs + i * 60, 'pop')}>
              <span className="lqa-input-k">{x.k}</span> {x.v}
            </span>
          ))}
        </div>
      </Tile>

      <p className="lqa-k lqa-must">
        What must be true ·{' '}
        <CueSwap
          kind="roll"
          className="lqa-count"
          values={[
            { at: 0, node: '0 of 8' },
            ...W.checks.map((at, i) => ({ at, node: `${i + 1} of 8` })),
          ]}
        />
      </p>
      <ol className="lqa-checks">
        {CHECKS.map((c, i) => {
          const at = W.checks[i]!;
          return (
            <li key={c.n} className="lqa-crow" {...cue(at, 'rise-lg')}>
              <span className="lqa-crow-body">
                <span className="lqa-crow-s">
                  <span className="hl-check-n">
                    <span className="sr-only">Check </span>
                    {c.n}
                  </span>
                  <span className="hl-check-kind">{c.kind}</span>
                  {c.statement}
                </span>
                <span className="lqa-crow-meta">
                  <span className="lqa-crow-why" {...cue(at + 120)}>
                    <span className="lqa-crow-k">What it proves</span> {c.proves}
                  </span>
                  <span className="lqa-when" {...cue(at + 240, 'pop')}>
                    <ClockGlyph />
                    <span className="lqa-when-k">When?</span> {c.when}
                  </span>
                </span>
              </span>
            </li>
          );
        })}
      </ol>

      <div className="lqa-sched">
        <span className="lqa-switch" aria-hidden="true">
          <i className="lqa-switch-on" {...cue(W.nightly)} />
          <i className="lqa-switch-knob" {...cue(W.nightly, 'none')} />
        </span>
        <span className="lqa-sched-x">
          <span className="lqa-nightly-l">Nightly</span>
          <span className="lqa-nightly-when">02:00 · weekdays · your time zone</span>
          <span className="lqa-next" {...cue(W.nextRun, 'left')}>
            <StatusChip size="sm">Next run · tonight, 02:00</StatusChip>
          </span>
        </span>
        <span className="hl-pill lqa-testnow" aria-hidden="true">
          Test now
        </span>
      </div>
    </div>
  );
}

/** Act 2 · the run as Logs writes it, line by line. */
function RunPane() {
  return (
    <div data-act-pane="1" className="lqa-pane lqa-run">
      <span className="hl-act-label">Running</span>
      <div className="lqa-pane-head">
        <span className="lqa-pane-title">{TEST}</span>
        <CueSwap
          kind="slide"
          values={[
            {
              at: R.start,
              node: (
                <StatusChip kind="live" size="sm">
                  running
                </StatusChip>
              ),
            },
            {
              at: R.ok,
              node: (
                <StatusChip kind="pass" size="sm">
                  ok
                </StatusChip>
              ),
            },
          ]}
        />
      </div>
      <Lines className="lqa-log" label="The run, step by step">
        {LOG.map((e) =>
          e.check ? (
            <LogLine key={e.time} time={e.time} mark="pass" at={e.at} doneAt={e.done} className="lqa-logcheck">
              <i className="lqa-logcheck-bar" aria-hidden="true" {...cue(e.done)} />
              <span className="lqa-logcheck-s">
                Check {e.check.n} · {e.text}
              </span>{' '}
              <span className="lqa-logcheck-tags">
                <span {...cue(e.done, 'pop')}>
                  <StatusChip kind="pass" size="sm">
                    PASS
                  </StatusChip>
                </span>
                <TierTag tier="tree" />
              </span>
              {e.check.note && (
                <span className="lqa-logcheck-note" {...cue(e.done + 120, 'rise')}>
                  {e.check.note}
                </span>
              )}
            </LogLine>
          ) : (
            <LogLine key={e.time} time={e.time} at={e.at} doneAt={e.done}>
              {e.text}
            </LogLine>
          ),
        )}
      </Lines>
      {/* The row Logs keeps for it: who asked (the schedule, not a person), which machine, how long - the
          columns a QA lead filters by the next morning. */}
      <p className="lqa-runfoot" {...cue(R.ok + 120, 'rise')}>
        <span className="lqa-k">In Logs</span>
        <span className="lqa-runfoot-v">
          <span className="lqa-crow-k">source</span>schedule
        </span>
        <span className="lqa-runfoot-v">
          <span className="lqa-crow-k">machine</span>qa-vm-1
        </span>
        <span className="lqa-runfoot-v">
          <span className="lqa-crow-k">took</span>34 s
        </span>
      </p>
    </div>
  );
}

/** Act 3 · the verdict the machine computed, its evidence, the kept frame, and the row of nights. */
function JudgePane({ thumbRef }: { thumbRef: Ref<HTMLSpanElement> }) {
  return (
    <div data-act-pane="2" className="lqa-pane lqa-judge">
      <span className="hl-act-label">Judged</span>
      <div className="lqa-pane-head">
        <span className="lqa-pane-title">{TEST}</span>
        <span className="lqa-k">Verdict</span>
      </div>
      <VerdictBar verdict="pass" chip="passed" at={J.verdict} className="lqa-verdict">
        3 held · 0 did not · 0 could not be checked
      </VerdictBar>
      <div className="lqa-evid">
        <span className="lqa-k" id="qa-evidence">
          Evidence · read from the app
        </span>
        {/* Each line pairs what was actually there with the sentence the check was written to prove in
            act 1 - the same words a red report leads with, so the green reads as the test's own claim held. */}
        <ol className="lqa-evidence" aria-labelledby="qa-evidence">
          {EVIDENCE.map((e, i) => (
            <li key={e.n} className="lqa-ev" {...cue(J.evidence[i]!, 'rise')}>
              <span className="hl-check-n">
                <span className="sr-only">Check </span>
                {e.n}
              </span>
              <span className="lqa-ev-x">{e.text}</span>
              <TierTag tier="tree" />
              <span className="lqa-ev-why">
                <span className="lqa-crow-k">proved</span> {CHECKS[i]!.proves}
              </span>
            </li>
          ))}
        </ol>
      </div>
      <div className="lqa-kept">
        <span className="lqa-kept-frame" ref={thumbRef} {...cue(J.kept, 'fade')}>
          <FrozenFrame status="pass" label="what it proved" lens={BILLING.total}>
            <BillingWindow toast={false} />
          </FrozenFrame>
        </span>
        <span className="lqa-kept-x" {...cue(J.kept + 70, 'rise')}>
          <span className="lqa-kept-t">Frame kept</span>
          <span className="lqa-kept-sub">The screen the moment its checks held — private to the account, kept 30 days.</span>
        </span>
      </div>
      <div className="lqa-row">
        <span className="lqa-row-head">
          <span className="lqa-k">Row of nights</span>
          <span className="lqa-row-hint" aria-hidden="true">
            oldest on the left
          </span>
        </span>
        <span className="sr-only">Last 10 nights, oldest first: all 10 passed, tonight the newest.</span>
        <span className="lqa-nights" aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => (
            <HexDot key={i} kind="pass" size={12} />
          ))}
          <span className="lqa-night-new" {...cue(J.night, 'pop')}>
            <HexDot kind="pass" size={12} />
          </span>
          <span className="lqa-tonight" {...cue(J.night + 120, 'left')}>
            tonight
          </span>
        </span>
        <span className="lqa-row-line" {...cue(J.line, 'rise')}>
          One more green night.
        </span>
      </div>
    </div>
  );
}

/* ── the section ───────────────────────────────────────────────────────────────────────────────────── */

export function LiveQa() {
  const root = useRef<HTMLDivElement>(null);
  const theater = useRef<HTMLDivElement>(null);
  const thumb = useRef<HTMLSpanElement>(null);
  const ghost = useRef<HTMLSpanElement>(null);
  const tl = useTimeline(root, { duration: DURATION, acts: ACTS, loop: true, pauseOn: theater });
  useFrameFlight(tl, J.flight, J.flightMs, { root, from: theater, to: thumb, ghost });

  const panelId = 'qa-run-panel';
  const enhanced = tl.enhanced;

  return (
    <Section
      id="qa"
      index="01"
      label="How it tests"
      head="split"
      pool="right"
      title={
        <>
          Write the test in words. <Grad>Watch a live agent run it.</Grad>
        </>
      }
      lead="Not a recorder and not a script. The agent decides every step from a fresh look at the screen, so it reaches the desktop apps browser tools can’t — and when it’s done, the machine reads the app itself to settle every check."
      foot={<ArrowLink href="#proof">Why you can trust the green</ArrowLink>}
    >
      <TimelineContext.Provider value={tl}>
        <div ref={root} className="lqa-demo">
          <div className="lqa-steps-row" {...reveal('up', 0)}>
            <Steps steps={STEPS} tl={tl} acts={ACTS} duration={DURATION} panelId={panelId} idBase="qa" label="How a test runs" />
          </div>
          <div className="lqa-figure" {...reveal('panel', 1)}>
            <DemoFrame label={FIGURE} caption={CAPTION}>
              <Theater
                ref={theater}
                className="lqa-theater"
                bar={
                  <TheaterBar
                    status={
                      <CueSwap
                        className="lqa-status"
                        values={[
                          { at: 0, node: <HexDot kind="ice" size={11} /> },
                          { at: R.start, node: <HexDot kind="live" size={11} /> },
                          { at: J.start, node: <HexDot kind="ice" size={11} /> },
                        ]}
                      />
                    }
                    machine="qa-vm-1"
                    platform="Windows 11 VM"
                    chips={
                      <CueSwap
                        kind="slide"
                        className="lqa-source"
                        values={[
                          {
                            at: 0,
                            node: (
                              <StatusChip kind="accent" size="sm">
                                Test · {TEST}
                              </StatusChip>
                            ),
                          },
                          { at: R.start, node: <StatusChip size="sm">by itself · from a schedule</StatusChip> },
                        ]}
                      />
                    }
                    clock={<ClockDigits values={CLOCK} className="lqa-clock" />}
                    control={<PlayToggle timeline={tl} />}
                  />
                }
                screen={<Desk />}
              >
                <div
                  className="hl-acts lqa-acts"
                  data-enhanced={enhanced ? '' : undefined}
                  id={panelId}
                  role={enhanced ? 'tabpanel' : undefined}
                  aria-labelledby={enhanced ? `qa-tab-${tl.act}` : undefined}
                  tabIndex={enhanced ? 0 : undefined}
                >
                  <WritePane />
                  <RunPane />
                  <JudgePane thumbRef={thumb} />
                </div>
              </Theater>
            </DemoFrame>
          </div>
          <span ref={ghost} className="lqa-ghost" aria-hidden="true" />
        </div>
      </TimelineContext.Provider>
    </Section>
  );
}
