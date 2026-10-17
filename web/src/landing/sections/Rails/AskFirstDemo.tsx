/* THE ASK-FIRST DEMO - the one rail the reader can feel. The agent drafts an email to Bob on mac-studio,
 * reaches for Send, and stops: the gate asks, and the page itself does not move on until the reader answers
 * Continue or Stop. There is no auto-press.
 *
 * FOUR PHASES, ONE CLOCK. The timeline (../../motion) runs four acts on one time axis -
 *
 *   drive  [0, 3000)       steps tick in, the draft types, the cursor glides towards Send and stops short
 *   wait   [3000, 10000)   the gate is open; at 9000 the nudge; the run HOLDS at 9999 until an answer
 *   stop   [10000, 14000)  played only when the reader presses Stop
 *   go     [14000, 17000)  played only when the reader presses Continue: Send, the check, the result
 *
 * - and go is LAST on purpose: the final frame, which the server renders and a one-shot demo already on
 * screen at hydration keeps, is "Sent — after your yes". The drive plays by itself; when it reaches the wait
 * this component turns autoplay off (goToAct(wait)), so the clock holds at the gate, and an interruption
 * (scrolled away, tab hidden) resumes at the gate rather than replaying the drive. Continue and Stop are
 * goToAct(go | stop): manual navigation, played once and held.
 *
 * WHAT A PHASE SHOWS is a data-phase attribute this component writes on the root - by DOM, from the clock,
 * no React render per frame - and CSS keyed to it (.rl-v[data-v~="go"] …). Within a phase, cues time the
 * entrances as everywhere else. The gate and the bar's pill are NOT cues: a goToAct jump sets data-seek,
 * which kills cue transitions, and the gate's 260ms exit must still play when the reader answers.
 *
 *   no JS          no data-phase: the go layers only - the finished run, with the gate as a static line
 *   reduced / still  the phase follows the act the reader chose; it starts at the gate (posterAct 1) and
 *                  Continue / Stop swap instantly - the gate is an interaction, not motion
 *   motion         the phase follows the clock
 *
 * It moves on its own for 3s at a time (the drive, then the go), so it needs no Pause button; and it does
 * not pause on hover, because the reader's pointer is exactly what must reach the gate - a hover pause would
 * restart the drive under it. The result is announced (polite) only after the reader's choice.
 */
import { useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@insightis/ui/Button';
import { cue, useTimeline, useTimelineFrame } from '../../motion';
import {
  BeeCursor,
  CheckLine,
  CueSwap,
  DemoFrame,
  DriveBorder,
  HexDot,
  HexSpinner,
  Lens,
  Lines,
  Ripple,
  Screen,
  StatusChip,
  StepLine,
  Theater,
  TheaterBar,
  Tick,
  centre,
} from '../kit';
import { MAIL, MailWindow, SentToast, TO_CLICK } from './MailWindow';

/* The script, in ms. */
const T = {
  border: 60,
  cursor: 60,
  row1: 300,
  row2: 900,
  toGlide: 600,
  toClick: 1160,
  to: 1200,
  subject: 1320,
  body: 1560,
  body2: 1740,
  row2Done: 2400,
  toSend: 2440,
  gate: 3000,
  hold: 3100,
  nudge: 9000,
  stop: 10000,
  stopLine: 10150,
  stopCheck: 10450,
  stopResult: 10750,
  go: 14000,
  goBorder: 14050,
  goGlide: 14100,
  goLine: 14150,
  sendClick: 14700,
  sendDone: 15050,
  toast: 14950,
  check: 15150,
  checkDone: 15650,
  done: 16000,
  goResult: 16300,
  lensOut: 16400,
  end: 17000,
} as const;

const ACT = { drive: 0, wait: 1, stop: 2, go: 3 } as const;
const ACTS = [0, T.gate, T.stop, T.go];

type Phase = 'drive' | 'wait' | 'stop' | 'go';
const ACT_PHASE: Phase[] = ['wait', 'wait', 'stop', 'go'];
const phaseAt = (t: number): Phase => (t < T.gate ? 'drive' : t < T.stop ? 'wait' : t < T.go ? 'stop' : 'go');

/* Where the cursor parks: just under Send, short of it - over nothing it could press. */
const SHORT = { x: 18.5, y: 41 };
const SEND = centre(MAIL.send);

const SAID = {
  go: 'Sent — after your yes. 1 check passed.',
  stop: 'Stopped by you — nothing was sent.',
};

/** A step's mark: a tick, or a hex spinner that turns into one at `done`; or the gate's pause. */
function Mark({ at, done, hold }: { at?: number; done?: number; hold?: boolean }) {
  if (hold)
    return (
      <span className="hl-mark rl-mark rl-mark--hold">
        <svg viewBox="0 0 10 10" aria-hidden="true" focusable="false">
          <path d="M3.4 2.2v5.6M6.6 2.2v5.6" />
        </svg>
      </span>
    );
  return (
    <span className="hl-mark rl-mark">
      {done !== undefined && <HexSpinner className="hl-transient" at={at ?? 0} out={done} />}
      <span {...(done !== undefined ? cue(done) : {})}>
        <Tick />
      </span>
    </span>
  );
}

function Pill() {
  return (
    <span className="rl-pill">
      <span className="rl-v" data-v="drive">
        <StatusChip kind="live">being driven</StatusChip>
      </span>
      <span className="rl-v" data-v="wait">
        <StatusChip kind="live" className="rl-chip-wait">
          waiting for you
        </StatusChip>
      </span>
      <span className="rl-v" data-v="stop">
        <StatusChip kind="grey">stopped by you</StatusChip>
      </span>
      <span className="rl-v" data-v="go">
        <CueSwap
          values={[
            { at: T.go, node: <StatusChip kind="live">being driven</StatusChip> },
            { at: T.done, node: <StatusChip kind="pass">done</StatusChip> },
          ]}
        />
      </span>
    </span>
  );
}

export function AskFirstDemo() {
  const root = useRef<HTMLDivElement>(null);
  const tl = useTimeline(root, { duration: T.end, acts: ACTS, posterAct: ACT.wait, pauseOnHover: false });
  const tlNow = useRef(tl);
  tlNow.current = tl;
  const phase = useRef<Phase | null>(null);
  const goBtn = useRef<HTMLButtonElement>(null);
  const result = useRef<HTMLDivElement>(null);
  const focusGate = useRef(false);
  const [said, setSaid] = useState('');

  /* Write the phase on the root. Arriving at the gate by the clock turns autoplay off there (deferred: we
     are inside the engine's tick), and brings focus to Continue only if it was already inside the demo. */
  const show = (next: Phase, byClock: boolean) => {
    const el = root.current;
    if (!el || phase.current === next) return;
    const prev = phase.current;
    phase.current = next;
    el.dataset.phase = next;
    if (next !== 'wait') return;
    if (byClock && prev === 'drive') queueMicrotask(() => tlNow.current.goToAct(ACT.wait));
    if (focusGate.current || el.contains(document.activeElement)) {
      focusGate.current = false;
      focusContinue(6);
    }
  };

  /* Focus lands only once the gate is visible, which can be a frame or two after its phase is written;
     try on the next few frames until it takes. */
  const focusContinue = (tries: number) =>
    requestAnimationFrame(() => {
      const btn = goBtn.current;
      btn?.focus({ preventScroll: true });
      if (btn && document.activeElement !== btn && tries > 1) focusContinue(tries - 1);
    });

  useTimelineFrame((t) => {
    if (!tl.motion) return;
    show(phaseAt(t), true);
    /* The border settles to a steady .35 a beat after the halt - after the jump's two seek frames, which
       would otherwise snap it. */
    root.current?.toggleAttribute('data-holding', t >= T.hold && t < T.stop);
  }, tl);

  useEffect(() => {
    if (!tl.enhanced || tl.motion) return;
    root.current?.removeAttribute('data-holding');
    show(ACT_PHASE[tl.act] ?? 'wait', false);
  }, [tl.enhanced, tl.motion, tl.act]);

  const answer = (go: boolean) => {
    const inside = !!root.current?.contains(document.activeElement);
    setSaid(go ? SAID.go : SAID.stop);
    tl.goToAct(go ? ACT.go : ACT.stop);
    if (inside) result.current?.focus({ preventScroll: true });
  };

  /* Replay hides the button that was pressed: a keyboard reader waits on the demo's slot through the drive,
     and the gate takes focus when it opens. */
  const replay = () => {
    focusGate.current = !!root.current?.contains(document.activeElement);
    if (focusGate.current) result.current?.focus({ preventScroll: true });
    setSaid('');
    if (tl.motion) tl.replay();
    else tl.goToAct(ACT.wait);
  };

  const replayBtn = tl.enhanced && (
    <Button type="button" variant="ghost" size="sm" rounded="full" className="hl-textbtn rl-replay" leftSlot={<RotateCcw aria-hidden strokeWidth={2.2} />} onClick={replay}>
      Replay
    </Button>
  );

  return (
    <DemoFrame
      className="rl-figure"
      label="Example: in Ask first mode the agent drafts an email to Bob on mac-studio and waits before Send until a person answers."
      caption="Illustration of Ask first mode, played faster than a real run. In the product you answer in the app or in Telegram."
    >
      <Theater
        ref={root}
        variant="stacked"
        className="rl-demo"
        sideClassName="rl-side"
        bar={<TheaterBar status="online" machine="mac-studio" platform="macOS" chips={<StatusChip kind="accent">Ask first</StatusChip>} control={<Pill />} />}
        screen={
          <Screen className="rl-screen">
            <MailWindow
              typeAt={{ to: T.to, subject: T.subject, body: T.body, body2: T.body2 }}
              toast={
                <span className="hl-screen-layer rl-v" data-v="go">
                  <SentToast cues={cue(T.toast, 'rise')} />
                </span>
              }
            />
            <DriveBorder at={T.border} out={T.stop} className="rl-drive-wait" />
            <DriveBorder at={T.goBorder} out={T.done} />
            <BeeCursor
              timeline={tl}
              out={T.stop}
              path={[
                { at: T.cursor, x: 62, y: 66 },
                { at: T.toGlide, ...TO_CLICK },
                { at: T.toSend, ...SHORT },
              ]}
            />
            <BeeCursor
              timeline={tl}
              out={T.done}
              path={[
                { at: T.go, ...SHORT },
                { at: T.goGlide, ...SEND },
                { at: T.sendDone, x: SEND.x + 9, y: SEND.y + 30 },
              ]}
            />
            <Ripple at={T.toClick} {...TO_CLICK} />
            <Ripple at={T.sendClick} {...SEND} />
            <Lens rect={MAIL.toast} tag="“Sent” · tree" result="pass" at={T.check} resolveAt={T.checkDone} out={T.lensOut} above />
          </Screen>
        }
      >
        <Lines className="rl-feed" label="What the agent did">
          <StepLine at={T.row1} mark={<Mark />}>
            copy the Q3 total from “Finance.xlsx”
          </StepLine>
          <StepLine at={T.row2} mark={<Mark at={T.row2} done={T.row2Done} />}>
            open Mail → “New message” → type the recipient and the body
          </StepLine>
        </Lines>

        {/* What comes after the first two steps shares one cell: the gate while it waits, then what Stop or
            Continue made of it, each with its result - so the panel is as tall as the tallest and never jumps
            when the reader answers. */}
        <div className="rl-slot" ref={result} tabIndex={-1}>
          {/* While it drives, the gate is armed but quiet: the same card, dashed and in ice, saying what it
              will do. At the halt it hands over to the lit gate in its place. */}
          {tl.enhanced && (
            <div className="rl-v rl-armed" data-v="drive">
              <div className="rl-armed-card" {...cue(T.row1, 'rise')}>
                <p className="rl-armed-title">
                  <Mark hold />
                  Ask first is on
                </p>
                <p className="rl-armed-body">It stops before anything that can’t be undone: send, submit, delete, pay.</p>
              </div>
            </div>
          )}
          {/* Stop is a branch only a reader can take: not in the server's page, which is the finished run. */}
          {tl.enhanced && (
            <div className="rl-v rl-layer" data-v="stop">
              <Lines className="rl-feed" label="After you pressed Stop">
                <StepLine at={T.stopLine} tone="muted" mark={<Mark hold />}>
                  waited before Send · you pressed Stop
                </StepLine>
                <CheckLine n={1} statement="“Sent” is there" outcome="notmade" tier="tree" at={T.stopCheck} />
              </Lines>
              <div className="hl-verdict hl-verdict--grey rl-res" {...cue(T.stopResult, 'rise')}>
                <HexDot kind="grey" size={10} />
                <p className="rl-res-x">
                  <b>Stopped by you</b> <span className="rl-res-n">— nothing was sent.</span>
                </p>
                {replayBtn}
              </div>
            </div>
          )}
          <div className="rl-v rl-layer" data-v="go">
            <Lines className="rl-feed" label="After you pressed Continue">
              <StepLine at={T.goLine} mark={<Mark hold />}>
                waited before Send · you pressed Continue
              </StepLine>
              <StepLine at={T.sendClick} mark={<Mark at={T.sendClick} done={T.sendDone} />}>
                click “Send” — a turn of its own, after a fresh look
              </StepLine>
              <CheckLine n={1} statement="“Sent” is there" outcome="pass" tier="tree" at={T.check} resolveAt={T.checkDone} />
            </Lines>
            <div className="hl-verdict hl-verdict--pass rl-res" {...cue(T.goResult, 'rise')}>
              <HexDot kind="pass" size={10} />
              <p className="rl-res-x">
                <b>Sent — after your yes.</b> <span className="rl-res-n">1 check passed.</span>
              </p>
              {replayBtn}
            </div>
          </div>
          {tl.enhanced && (
            <div className="rl-v rl-gate" data-v="wait" role="group" aria-label="Ask first — demo">
              <span className="rl-gate-glow" aria-hidden="true" {...cue(T.nudge, 'none')} />
              <p className="rl-gate-title">
                <HexDot kind="honey" size={10} />
                Waiting before: Send
              </p>
              <p className="rl-gate-body">It’s about to do something that can’t be undone: send the email to Bob. Nothing moves until you answer.</p>
              <div className="rl-gate-actions">
                <Button ref={goBtn} type="button" variant="secondary" rounded="full" className="rl-gate-btn rl-gate-go" onClick={() => answer(true)}>
                  Continue
                </Button>
                <Button type="button" variant="ghost" rounded="full" className="rl-gate-btn rl-gate-stop" onClick={() => answer(false)}>
                  Stop
                </Button>
              </div>
              <p className="rl-gate-nudge" {...cue(T.nudge, 'rise')}>
                Your turn — the demo waits too.
              </p>
            </div>
          )}
        </div>
        <p className="sr-only" aria-live="polite">
          {said}
        </p>
      </Theater>
    </DemoFrame>
  );
}
