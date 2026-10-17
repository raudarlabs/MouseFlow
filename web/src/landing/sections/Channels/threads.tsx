/* 05 · Ways in - the three small threads, one per way in: Create in the app, Claude over MCP, the
 * Telegram bot. Each is a few lines of real product UI drawn in the page's own glass, and each plays once:
 * someone asks, the agent's side answers, and the thread ends where the product's own story does - at a
 * checkpoint waiting for you, at a test on a clock, at a check that passed.
 *
 * POSTER FIRST. Every element is rendered at its final frame and carries the moment it arrives (cue()):
 * the server HTML, reduced motion and ?still show the finished thread, and while a timeline owns the tile
 * the engine reveals the cues in order. Every bubble is laid out from the start - arriving is opacity and
 * a short slide only - so a tile's height is its final height and never changes while it plays.
 *
 * The cue times are relative: `lead` shifts a whole thread, which is how three threads side by side start
 * 350ms apart on one timeline (Channels.tsx). The timings live beside the markup (appTimes …) so the
 * timeline's acts and duration are computed from the same numbers the cues use.
 *
 * Everything here is decoration: the tile is aria-hidden and its figure's caption says what it shows. The
 * buttons are glass pills (spans), never controls.
 */
import type { ReactNode } from 'react';
import { cn } from '@insightis/ui/cn';
import { cue } from '../../motion';
import { CueSwap, HexDot, HexSpinner, LiveDot, StatusChip, Tick, TypeText, typeDuration } from '../kit';

/* ── shared parts ─────────────────────────────────────────────────────────────────────────────────── */

/** Three dots in an opacity wave - the other side is about to answer. Mid-thread only (transient); as a
    bubble it is layered over the slot of the message it announces, so it takes no room of its own. */
function Typing({ at, out, bubble }: { at: number; out: number; bubble?: boolean }) {
  return (
    <span className={cn('hl-typing hl-transient', bubble && 'ch-typing--bubble')} {...cue(at, bubble ? 'left' : undefined, out)}>
      <i />
      <i />
      <i />
    </span>
  );
}

/** A decorative glass button. With `at` it is pressed then: a .97 press and a short ice flash, so the
    reader sees which button made the next thing happen. */
function Pill({ at, className, children }: { at?: number; className?: string; children: ReactNode }) {
  return (
    <span className={cn('hl-pill ch-btn', at !== undefined && 'hl-press', className)} {...(at !== undefined ? cue(at, 'none') : {})}>
      {children}
    </span>
  );
}

/** The chat's input at the foot of the tile - empty, as it is once a message has gone. Its button is
    pressed at `at`, the moment the next message of yours is sent. */
function ChatInput({ placeholder, icon, at }: { placeholder: string; icon: 'send' | 'mic'; at: number }) {
  return (
    <div className="ch-input">
      <span className="ch-input-ph">{placeholder}</span>
      <span className="ch-input-btn hl-press" {...cue(at, 'none')}>
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          {icon === 'send' ? (
            <path d="M8 12.5v-9M4.2 7.2 8 3.4l3.8 3.8" />
          ) : (
            <path d="M8 2.6a2 2 0 0 1 2 2v3.2a2 2 0 0 1-4 0V4.6a2 2 0 0 1 2-2ZM4.4 7.6a3.6 3.6 0 0 0 7.2 0M8 11.2v2.2" />
          )}
        </svg>
      </span>
    </div>
  );
}

/** A hex spinner that turns into a tick when the call comes back. At rest, just the tick. */
function Resolve({ at, done }: { at: number; done: number }) {
  return (
    <span className="hl-mark ch-resolve">
      <HexSpinner className="hl-transient" at={at} out={done} />
      <span {...cue(done)}>
        <Tick />
      </span>
    </span>
  );
}

/* ── A · the app: Create ──────────────────────────────────────────────────────────────────────────── */

export interface AppCopy {
  goal: string;
  planIt: string;
  plan: string;
  run: string;
  checkpoints: readonly [string, string, string];
  /** The run's steps in words, as Create streams them: the first reaches checkpoint 1, the other two
      checkpoint 2. */
  steps: readonly [string, string, string];
  waiting: string;
  gate: { where: string; what: string };
  note: string;
  buttons: readonly string[];
}

/** Typed (22ms a character) → Plan it → the plan, its three checkpoints ticking in → Run it on the
    machine → a step, checkpoint 1 reached → two more steps → waiting at checkpoint 2, the gate last. */
export function appTimes(c: AppCopy) {
  const type = 200;
  const planPress = type + typeDuration(c.goal, 'person') + 150;
  const plan = planPress + 150;
  const planDone = plan + 400;
  const line = (i: number) => planDone + 60 + i * 120;
  const runPress = line(c.checkpoints.length - 1) + 320;
  const running = runPress + 80;
  const step0 = running + 200;
  const cp1 = step0 + 420;
  const step1 = cp1 + 120;
  const step2 = step1 + 400;
  const cp2 = step2 + 380;
  const gate = cp2 + 100;
  const step = (i: number) => [step0, step1, step2][i] ?? step2;
  return { type, planPress, plan, planDone, line, runPress, running, step, cp1, cp2, gate, end: gate + 300 };
}

export function AppThread({ copy: c, lead }: { copy: AppCopy; lead: number }) {
  const t = appTimes(c);
  const at = (ms: number) => lead + ms;
  /* Each checkpoint's mark: an empty hex until the run gets there, a spinner while it works towards it,
     then reached (a tick) - or, for the one it stops at, "waiting". */
  const marks: ReactNode[] = [
    <CueSwap
      key="0"
      values={[
        { at: 0, node: <HexDot kind="empty" size={10} /> },
        { at: at(t.running), node: <HexSpinner /> },
        { at: at(t.cp1), node: <Tick /> },
      ]}
    />,
    <CueSwap
      key="1"
      values={[
        { at: 0, node: <HexDot kind="empty" size={10} /> },
        { at: at(t.cp1), node: <HexSpinner /> },
        {
          at: at(t.cp2),
          node: (
            <StatusChip kind="accent" size="sm">
              {c.waiting}
            </StatusChip>
          ),
        },
      ]}
    />,
    <HexDot key="2" kind="empty" size={10} />,
  ];
  return (
    <>
      <div className="ch-composer">
        <p className="ch-field">
          <TypeText text={c.goal} at={at(t.type)} />
        </p>
        <Pill at={at(t.planPress)}>{c.planIt}</Pill>
      </div>

      <div className="ch-plan" {...cue(at(t.plan), 'rise')}>
        <div className="ch-plan-head">
          <span className="ch-plan-title">
            <Resolve at={at(t.plan)} done={at(t.planDone)} />
            {c.plan}
          </span>
          <Pill at={at(t.runPress)} className="ch-btn--run">
            <CueSwap
              className="ch-run-dot"
              values={[
                { at: 0, node: <HexDot kind="online" size={9} /> },
                { at: at(t.running), node: <LiveDot /> },
              ]}
            />
            {c.run}
          </Pill>
        </div>
        <ol className="ch-cps">
          {c.checkpoints.map((text, i) => (
            <li key={text} className="ch-cp" {...cue(at(t.line(i)), 'rise')}>
              {i === 1 && <i className="ch-cp-hi" {...cue(at(t.cp2))} />}
              <span className="ch-cp-n">{String(i + 1).padStart(2, '0')}</span>
              <span className="ch-cp-x">{text}</span>
              <span className="ch-cp-m">{marks[i]}</span>
            </li>
          ))}
        </ol>
      </div>

      <ol className="ch-steps">
        {c.steps.map((text, i) => (
          <li key={text} className="ch-step" {...cue(at(t.step(i)), 'rise')}>
            <span className="ch-step-m">›</span>
            {text}
          </li>
        ))}
      </ol>

      <div className="ch-gate" {...cue(at(t.gate), 'rise-lg')}>
        <p className="ch-gate-t">
          <b>{c.gate.where}</b> — {c.gate.what}
        </p>
        <p className="ch-gate-n">{c.note}</p>
        <div className="ch-gate-b">
          {c.buttons.map((b, i) => (
            <Pill key={b} className={i === 0 ? 'ch-btn--go' : undefined}>
              {b}
            </Pill>
          ))}
        </div>
      </div>
    </>
  );
}

/* ── B · your AI: Claude over MCP ─────────────────────────────────────────────────────────────────── */

export interface McpCopy {
  /** The chat's own first line: the connector it has (static - the frame of the chat, not a message). */
  connector: string;
  /** The empty input under the chat. */
  input: string;
  you: { before: string; skill: string; after: string };
  who: string;
  /** Each call as the chat shows it: the tool, what came back (right), and what it was given - so the
      reader sees the sentence become a check and the check go on a clock. */
  tools: readonly { name: string; arg: string; input: readonly (readonly [string, string])[] }[];
  answer: { before: string; test: string; after: string };
}

/** You ask → it thinks → two tool calls, each a spinner over its inputs (they arrive line by line) that
    comes back as a tick → the answer rises and the test's name pops. */
export function mcpTimes(c: McpCopy) {
  const you = 200;
  const think = 650;
  const tool = (i: number) => 1250 + i * 700;
  const input = (i: number, j: number) => tool(i) + 140 + j * 120;
  const toolDone = (i: number) => tool(i) + 520;
  const answer = toolDone(c.tools.length - 1) + 220;
  const chip = answer + 220;
  return { you, think, tool, input, toolDone, answer, chip, end: chip + 250 };
}

export function McpThread({ copy: c, lead }: { copy: McpCopy; lead: number }) {
  const t = mcpTimes(c);
  const at = (ms: number) => lead + ms;
  return (
    <>
      <p className="ch-sys">{c.connector}</p>
      <p className="ch-msg ch-msg--you" {...cue(at(t.you), 'right')}>
        {c.you.before}
        <b>{c.you.skill}</b>
        {c.you.after}
      </p>
      <div className="ch-ai">
        <p className="ch-who" {...cue(at(t.think))}>
          <HexDot kind="ice" size={8} />
          {c.who}
          <Typing at={at(t.think)} out={at(t.tool(0))} />
        </p>
        {/* The calls one under another, joined by a rail: the order is the story (write the test, then put
            it on the clock). Each is a head - the tool and what came back - over what it was given. */}
        <ol className="ch-tools">
          {c.tools.map((tool, i) => (
            <li key={tool.name} className="ch-tool" {...cue(at(t.tool(i)), 'rise')}>
              <p className="ch-tool-head">
                <Resolve at={at(t.tool(i))} done={at(t.toolDone(i))} />
                <span className="ch-tool-name">{tool.name}</span>
                <span className="ch-tool-a" {...cue(at(t.toolDone(i)))}>
                  {tool.arg}
                </span>
              </p>
              <dl className="ch-args">
                {tool.input.map(([k, v], j) => (
                  <div key={k} className="ch-arg" {...cue(at(t.input(i, j)))}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ol>
        <p className="ch-answer" {...cue(at(t.answer), 'rise')}>
          {c.answer.before}
          <span className="ch-pop" {...cue(at(t.chip), 'pop')}>
            <StatusChip kind="accent" size="sm" wrap>
              {c.answer.test}
            </StatusChip>
          </span>
          {c.answer.after}
        </p>
      </div>
      <ChatInput placeholder={c.input} icon="send" at={at(t.you - 120)} />
    </>
  );
}

/* ── C · the phone: the Telegram bot ──────────────────────────────────────────────────────────────── */

export interface TgCopy {
  /** Telegram's date chip at the top of the chat (static, the chat's frame). */
  day: string;
  /** The empty input under the chat; its mic is what sent the voice note. */
  input: string;
  use: string;
  useReply: string;
  voice: { label: string; length: string };
  heard: { label: string; words: string };
  plan: { machine: string; text: string };
  buttons: readonly string[];
  done: { lead: string; chip: string; tail: string };
}

/** /use → the bot's answer → a voice note → the bot types → what it heard and its plan, with the inline
    buttons → Approve is pressed → the outcome comes back, its check chip popping last. */
export function tgTimes() {
  const use = 200;
  const reply = 650;
  const voice = 1150;
  const think = 1650;
  const plan = 2200;
  const approve = 2900;
  const done = 3250;
  const chip = done + 200;
  return { use, reply, voice, think, plan, approve, done, chip, end: chip + 250 };
}

/** A voice note's waveform: twelve still bars (they never move; only the unplayed dot pulses). */
const WAVE = [5, 9, 13, 8, 11, 15, 10, 6, 12, 8, 5, 9];

function Wave() {
  return (
    <svg className="ch-wave" viewBox={`0 0 ${WAVE.length * 5 - 2} 16`} aria-hidden="true" focusable="false">
      {WAVE.map((h, i) => (
        <rect key={i} x={i * 5} y={(16 - h) / 2} width="3" height={h} rx="1.5" />
      ))}
    </svg>
  );
}

export function TgThread({ copy: c, lead }: { copy: TgCopy; lead: number }) {
  const t = tgTimes();
  const at = (ms: number) => lead + ms;
  return (
    <>
      <p className="ch-sys">{c.day}</p>
      <p className="ch-msg ch-msg--you ch-cmd" {...cue(at(t.use), 'right')}>
        {c.use}
      </p>
      <p className="ch-msg ch-msg--them" {...cue(at(t.reply), 'left')}>
        {c.useReply}
      </p>
      <div className="ch-msg ch-msg--you ch-voice" {...cue(at(t.voice), 'right')}>
        <span className="ch-voice-play">
          <svg viewBox="0 0 10 10" aria-hidden="true" focusable="false">
            <path d="M3 1.8v6.4L8.4 5Z" />
          </svg>
        </span>
        <span className="ch-voice-body">
          <Wave />
          <span className="ch-voice-meta">
            {c.voice.label} · {c.voice.length}
            <i className="ch-voice-dot" {...cue(at(t.voice), 'none')} />
          </span>
        </span>
      </div>
      <div className="ch-slot">
        <Typing bubble at={at(t.think)} out={at(t.plan)} />
        <div className="ch-bot" {...cue(at(t.plan), 'left')}>
          <div className="ch-msg ch-msg--them">
            <p>
              <span className="ch-heard">{c.heard.label}</span> “{c.heard.words}”
            </p>
            <p className="ch-tg-plan">
              <span className="ch-machine">{c.plan.machine}:</span> {c.plan.text}
            </p>
          </div>
          <div className="ch-keys">
            {c.buttons.map((b, i) => (
              <Pill key={b} at={i === 0 ? at(t.approve) : undefined} className={i === 0 ? 'ch-btn--go' : undefined}>
                {b}
              </Pill>
            ))}
          </div>
        </div>
      </div>
      <div className="ch-msg ch-msg--them ch-done" {...cue(at(t.done), 'rise')}>
        <p className="ch-done-head">
          <b>{c.done.lead}</b>
          <span className="ch-pop" {...cue(at(t.chip), 'pop')}>
            <StatusChip kind="pass" size="sm">
              {c.done.chip}
            </StatusChip>
          </span>
        </p>
        <p className="ch-done-x">— {c.done.tail}</p>
      </div>
      <ChatInput placeholder={c.input} icon="mic" at={at(t.voice - 120)} />
    </>
  );
}
