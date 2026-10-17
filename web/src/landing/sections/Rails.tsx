/* 07 · SAFE HANDS - after watching a live agent drive real apps on real machines, every reader asks whether
 * it is safe to let it. The answer, in three parts:
 *
 *   the Ask-first demo   the one rail the reader can feel: it stops before Send and waits for THEM
 *   six rails            the limits written into both agents and the model's instructions
 *   what it doesn't do   said plainly, so the last objections are gone before the FAQ and the form
 *
 * Phone first: the demo, then the rails as rows of one panel, then the honest list. From 768 the rails
 * become a 2-column grid of cards; from 1200 the demo takes columns 1-5 beside them and the list spans the
 * page underneath. Every word is in the server HTML; the demo is a poster of the finished run until its
 * script takes it over (Rails/AskFirstDemo.tsx).
 */
import type { ReactNode } from 'react';
import { GlassCell } from '@/components/brand/GlassCell';
import { Reveal, revealGroup, revealItem } from '../motion';
import { Grad, HexDot, Panel, Section, StatusChip, Tile } from './kit';
import { AskFirstDemo } from './Rails/AskFirstDemo';
import { RAIL_GLYPHS } from './Rails/glyphs';
import './Rails.css';

interface Rail {
  title: string;
  body: string;
  glyph: keyof typeof RAIL_GLYPHS;
  /** The rail the demo beside it plays. */
  demo?: boolean;
}

const RAILS: Rail[] = [
  {
    title: 'It never types a password',
    body: 'Passwords, card numbers, one-time codes: it stops and hands that part back to you, every time.',
    glyph: 'key',
  },
  {
    title: 'One-way steps go slow',
    body: 'Send, submit, delete, pay: a turn of its own after a fresh look. In Ask first it waits for your yes.',
    glyph: 'oneway',
    demo: true,
  },
  {
    title: 'Screen text is never an order',
    body: 'What it reads on screen is information, not instruction. A goal allows what it says, nothing more.',
    glyph: 'speech',
  },
  {
    title: 'Nothing reaches in',
    body: 'The agent dials out to ask for work. There’s no open port, and a revoked token switches it off.',
    glyph: 'out',
  },
  {
    title: 'Your switch wins',
    body: 'The tray or menu-bar switch stops it taking work. Your account can’t turn it back on, only you can.',
    glyph: 'switch',
  },
  {
    title: 'Stop anywhere, see everything',
    body: 'Stop it from the app, Telegram or Claude. A border lights up while it drives, and Logs keep every step.',
    glyph: 'watch',
  },
];

/* What it doesn't do yet: the thing in ink, the plain fact after it in muted ink. */
const NOT_YET: { lead: ReactNode; rest?: ReactNode }[] = [
  { lead: 'Linux, headless servers or a locked screen.', rest: 'It needs a real, unlocked desktop on Windows or macOS; a VM is fine.' },
  { lead: 'Shell commands or scripts.', rest: 'Its commands are jobs in plain words.' },
  { lead: 'Phone apps, or browsers other than Chrome.' },
  { lead: 'Screenshot or pixel comparison.', rest: 'Checks read the app, not the picture.' },
  { lead: 'Self-healing tests, or two jobs at once on one machine', rest: '— add a machine instead.' },
  {
    lead: 'Apps that name almost nothing,',
    rest: (
      <>
        like many Electron and canvas apps: their checks come back{' '}
        <StatusChip kind="cannot" size="sm" className="rl-cannot">
          CANNOT CHECK
        </StatusChip>
        , never a false pass.
      </>
    ),
  },
];

export function Rails() {
  return (
    <Section
      id="trust"
      index="07"
      label="Safe hands"
      head="split"
      pool="left"
      stageClassName="rl-stage"
      title={
        <>
          It drives a real mouse. <Grad>So the rails are built in.</Grad>
        </>
      }
      lead="The limits are written into both agents and into the instructions the model works under — not left to good intentions. Try the one that matters most: it won’t send until you say so."
    >
      <Reveal kind="panel" index={0} className="rl-demo-col">
        <AskFirstDemo />
      </Reveal>

      {/* One panel of rows on a phone; from 768 every rail is its own card. */}
      <Panel className="rl-rails-panel">
        <ul className="rl-rails" {...revealGroup()}>
          {RAILS.map((r, i) => (
            <li key={r.glyph} className="rl-rail-li" {...revealItem(i, 'panel')}>
              <Panel as="article" card hover className="rl-rail">
                <span className="rl-cell" aria-hidden="true">
                  <GlassCell>
                    <g className="rl-glyph">{RAIL_GLYPHS[r.glyph]}</g>
                  </GlassCell>
                </span>
                <span className="rl-rail-n" aria-hidden="true">
                  {r.demo && (
                    <span className="rl-rail-try">
                      the demo <i className="rl-try-up">↑</i>
                      <i className="rl-try-left">←</i>
                      <span className="rl-rail-dot">·</span>
                    </span>
                  )}
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="hl-h3 rl-rail-title">{r.title}</h3>
                <p className="hl-body rl-rail-body">{r.body}</p>
              </Panel>
            </li>
          ))}
        </ul>
      </Panel>

      <Tile className="rl-notyet" {...revealGroup()}>
        <div className="rl-notyet-head" {...revealItem(0, 'fade')}>
          <h3 className="hl-h3 rl-notyet-title">What it doesn’t do — yet</h3>
          <p className="rl-notyet-sub">Said plainly, so you can plan around it.</p>
        </div>
        <ul className="rl-notyet-list">
          {NOT_YET.map((n, i) => (
            <li key={i} className="rl-notyet-item" {...revealItem(i + 1, 'fade')}>
              <HexDot kind="empty" size={9} className="rl-notyet-hex" />
              <p>
                <b>{n.lead}</b>
                {n.rest && <> {n.rest}</>}
              </p>
            </li>
          ))}
        </ul>
      </Tile>
    </Section>
  );
}
