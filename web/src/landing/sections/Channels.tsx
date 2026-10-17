/* 05 · WAYS IN - once the reader knows where the agent lives (04), the next question is how to reach it.
 * Three ways in, one queue, one Logs: the app (Create, with its plan checkpoints), the reader's own AI
 * (Claude over MCP, writing a test and putting it on a clock - the QA team's favourite) and the phone
 * (Telegram, a voice note checking a backup - IT away from the desk). It names the channels the use-case
 * deck (06) then shows at work, so 06 needs no explanation.
 *
 * THREE CARDS FROM ONE RECIPE. Each is an <article> with a real heading: a kicker, a GlassCell glyph, the
 * H3, a short body, and a small thread in a tile - honest product UI in the page's own glass, no third
 * party's logo or colour. From 1200px the cards share a subgrid, so their headings, bodies and demo tiles
 * line up across the row; the demos sit on one baseline and are as tall as the tallest.
 *
 * WHO PLAYS THE THREADS (see Channels/useWide.ts). One under another, each tile is its own one-shot demo
 * that plays when half of it is in view. Side by side they arrive together, so the row is ONE demo with the
 * threads 350ms apart - three demos would meet the engine's two-at-a-time rule and the first would sit
 * frozen. Either way a thread plays once, shows Replay in its tile's corner, and plays again when the
 * reader comes back after it has fully left the screen. Every thread ends within 5s, so none needs a Pause.
 *
 * Honey appears once here: the running dot in Create's "Run it on finance-pc" (a run being driven).
 */
import { useRef, type ReactNode, type RefObject } from 'react';
import { GlassCell } from '@/components/brand/GlassCell';
import { revealGroup, revealItem, useTimeline, type Timeline, type TimelineOptions } from '../motion';
import { DemoFrame, Grad, Panel, ReplayButton, Section } from './kit';
import { ComposerGlyph, ConnectorGlyph, PlaneGlyph } from './Channels/glyphs';
import { AppThread, McpThread, TgThread, appTimes, mcpTimes, tgTimes, type AppCopy, type McpCopy, type TgCopy } from './Channels/threads';
import { useWide } from './Channels/useWide';
import './Channels.css';

/* ── copy ─────────────────────────────────────────────────────────────────────────────────────────── */

type WayId = 'app' | 'mcp' | 'tg';

interface Way {
  id: WayId;
  kicker: string;
  title: string;
  body: string;
  /** The demo's meaning, for screen readers (the tile itself is aria-hidden). */
  caption: string;
  glyph: ReactNode;
}

const WAYS: readonly Way[] = [
  {
    id: 'app',
    kicker: 'The app · Create (Beta)',
    title: 'Type it. Plan it. Run it anywhere.',
    body: 'Type a goal, press Plan it for three to six checkpoints, then run it on this computer or any machine on the account. The steps stream back in words while it works.',
    caption: 'Example: a goal planned in Create and run on finance-pc, waiting at a checkpoint.',
    glyph: <ComposerGlyph />,
  },
  {
    id: 'mcp',
    kicker: 'Claude · over MCP',
    title: 'Your AI writes the test and runs it.',
    body: 'Connect Claude or any MCP client. Twelve tools let it run goals, write tests, put them on a clock, pick a machine by name and read last night’s results.',
    caption: 'Example: Claude turns a skill into a test with one check and schedules it for weeknights.',
    glyph: <ConnectorGlyph />,
  },
  {
    id: 'tg',
    kicker: 'Telegram · bot and Mini App',
    title: 'A voice note is a command.',
    body: 'Send a task as text or voice, approve the plan, and the outcome comes back to the chat. /machines gives every machine its own card, and the feed reports every run.',
    caption: 'Example: a voice note in Telegram checks last night’s backup on backup-pc.',
    glyph: <PlaneGlyph />,
  },
];

const APP: AppCopy = {
  goal: 'Export the Q3 sheet as a PDF into Reports',
  planIt: 'Plan it',
  plan: 'Plan',
  run: 'Run it on finance-pc',
  checkpoints: ['The Q3 sheet is open', 'The PDF is saved in Reports', 'The file is there'],
  steps: ['Click the “Q3” sheet tab', 'Click “File”, then “Export”', 'Name it “Q3” and save it in “Reports”'],
  waiting: 'waiting',
  gate: { where: 'Waiting at checkpoint 2', what: 'The PDF is saved in Reports' },
  note: 'It’s a claim, not a fact. Nothing moves until you answer.',
  buttons: ['Carry on', 'Stop here', 'Look at the screen'],
};

const MCP: McpCopy = {
  connector: 'mouseflow connector · 12 tools',
  input: 'Reply to Claude…',
  you: { before: 'Make a test from the skill ', skill: 'Add the Blue mug', after: ': the total must contain $12.00. Run it every weeknight.' },
  who: 'Claude',
  tools: [
    {
      name: 'mouseflow_case',
      arg: '1 check',
      input: [
        ['skill', 'Add the Blue mug'],
        ['check', '“Total” contains $12.00'],
      ],
    },
    {
      name: 'mouseflow_schedule',
      arg: '02:00 weekdays',
      input: [['test', 'Cart total is right']],
    },
  ],
  answer: {
    before: 'Done. ',
    test: 'Cart total is right',
    after: ' checks that “Total” contains $12.00 and runs at 02:00 on weekdays. Ask me in the morning and I’ll read you its row of nights.',
  },
};

const TG: TgCopy = {
  day: 'Today',
  input: 'Message',
  use: '/use backup-pc',
  useReply: 'Tasks from this chat go to backup-pc.',
  voice: { label: 'Voice note', length: '0:04' },
  heard: { label: 'Heard:', words: 'check that last night’s backup finished' },
  plan: { machine: 'backup-pc', text: 'open the Backup console, check “Completed” is there' },
  buttons: ['Approve', 'Change', 'Cancel'],
  done: { lead: 'Done on backup-pc', chip: '1 check passed', tail: 'last backup completed 02:14' },
};

/* ── timing ───────────────────────────────────────────────────────────────────────────────────────── */

const APP_T = appTimes(APP);
const MCP_T = mcpTimes(MCP);
const TG_T = tgTimes();

/** The quiet after a thread's last cue, before it counts as ended and offers Replay. */
const REST = 500;

/** Side by side, the threads start 350ms apart, left to right. */
const WIDE_LEAD: Record<WayId, number> = { app: 0, mcp: 350, tg: 700 };
const NO_LEAD: Record<WayId, number> = { app: 0, mcp: 0, tg: 0 };

/* A one-shot that plays when half of it is in view and again after it has fully left. Its acts are the
   thread's beats: a thread interrupted by scrolling away resumes from the start of its beat, not from the
   middle of a sentence and not from the very beginning.
   It does NOT pause under the pointer, unlike the page's longer demos. The row fills the screen, and a
   reader who scrolls with the cursor resting on it would hover it before it ever started - the threads
   would never play. They are under 5s and end on their finished frame, which is the frame to read. */
const once = (duration: number, acts: number[]): TimelineOptions => ({
  duration,
  acts,
  threshold: 0.5,
  replayOnReenter: true,
  pauseOnHover: false,
});

const ROW = once(Math.max(APP_T.end + WIDE_LEAD.app, MCP_T.end + WIDE_LEAD.mcp, TG_T.end + WIDE_LEAD.tg) + REST, [0, 1500, 3000]);
const APP_TL = once(APP_T.end + REST, [0, APP_T.planPress, APP_T.runPress]);
const MCP_TL = once(MCP_T.end + REST, [0, MCP_T.tool(0), MCP_T.answer]);
const TG_TL = once(TG_T.end + REST, [0, TG_T.think, TG_T.approve]);

/** The ref a timeline gets while another one owns its cues: no element, so no demo. */
const NONE: RefObject<HTMLElement | null> = { current: null };

/* ── the section ──────────────────────────────────────────────────────────────────────────────────── */

export function Channels() {
  const wide = useWide();
  const rowRef = useRef<HTMLUListElement>(null);
  const appRef = useRef<HTMLDivElement>(null);
  const mcpRef = useRef<HTMLDivElement>(null);
  const tgRef = useRef<HTMLDivElement>(null);

  const row = useTimeline(wide ? rowRef : NONE, ROW);
  const app = useTimeline(wide ? NONE : appRef, APP_TL);
  const mcp = useTimeline(wide ? NONE : mcpRef, MCP_TL);
  const tg = useTimeline(wide ? NONE : tgRef, TG_TL);

  const lead = wide ? WIDE_LEAD : NO_LEAD;
  const parts: Record<WayId, { tl: Timeline; ref: RefObject<HTMLDivElement | null>; thread: ReactNode }> = {
    app: { tl: wide ? row : app, ref: appRef, thread: <AppThread copy={APP} lead={lead.app} /> },
    mcp: { tl: wide ? row : mcp, ref: mcpRef, thread: <McpThread copy={MCP} lead={lead.mcp} /> },
    tg: { tl: wide ? row : tg, ref: tgRef, thread: <TgThread copy={TG} lead={lead.tg} /> },
  };

  return (
    <Section
      id="channels"
      index="05"
      label="Ways in"
      head="split"
      pool="right"
      title={
        <>
          Hand it work <Grad>from wherever you are.</Grad>
        </>
      }
      lead="Every command becomes a job in one queue, and every result lands in one Logs — whoever asked, from wherever they asked."
    >
      <ul ref={rowRef} className="ch-ways" {...revealGroup()}>
        {WAYS.map((way, i) => {
          const part = parts[way.id];
          return (
            <li key={way.id} className="ch-way" {...revealItem(i, 'panel')}>
              <Panel as="article" pad hover className={`ch-card ch-card--${way.id}`} aria-labelledby={`ch-${way.id}-title`}>
                <div className="ch-top">
                  <p className="hl-kicker ch-kicker">{way.kicker}</p>
                  <GlassCell className="ch-cell">{way.glyph}</GlassCell>
                </div>
                <h3 id={`ch-${way.id}-title`} className="hl-h3 ch-h3">
                  {way.title}
                </h3>
                <p className="hl-body ch-body">{way.body}</p>
                <DemoFrame label={way.caption} className="ch-demo">
                  <div ref={part.ref} className={`hl-tile ch-tile ch-tile--${way.id}`}>
                    <div className="ch-thread" aria-hidden="true">
                      {part.thread}
                    </div>
                    <ReplayButton timeline={part.tl} className="ch-replay" />
                  </div>
                </DemoFrame>
              </Panel>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
