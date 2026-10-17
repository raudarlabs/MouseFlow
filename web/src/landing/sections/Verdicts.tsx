/* 02 · PROOF, NOT OPINION - the QA buyer's first objection ("an AI marked it green, so why believe it?")
 * answered with the product's strictest idea: the same test the reader just watched in 01, "Invoice total is
 * right" on qa-vm-1, on three nights - passed (the only green), no verdict (grey: Billing asked to sign in
 * and the bee never types passwords) and failed a check (red: the total was wrong, a real defect found) -
 * with the rules that make those colours mean something beside it.
 *
 * THE CONSOLE is Logs' run view, distilled: the row of nights, the three nights as tabs, and one sheet per
 * night (Verdicts/Sheet.tsx). One one-shot timeline (Verdicts/script.ts) plays Monday, Tuesday and
 * Wednesday in order - lines ticking in, checks spinning and resolving, the verdict landing, a 5s hairline
 * before the next night - and stops on Wednesday's red, which is what 03's morning report then names.
 * Pausing, a tab, a night's hex, or a click anywhere in the console stops the advance until Play; a chosen
 * night replays at double speed so it feels run. With reduced motion the console opens on Wednesday and the
 * tabs swap instantly; without a script all three sheets are on the page, one under another.
 *
 * BESIDE IT: the two-questions card (Logs never folds "did the agent finish?" and "did the product pass?"
 * into one chip) under the console, where Wednesday's "ok · 1 check failed" leaves the reader, and the four
 * rules in their own column (Verdicts/Rules.tsx). No honey in the sheets - the verdict colours own this
 * section; the only warm light is the "running" dot while a night plays.
 */
import { useEffect, useRef, useState } from 'react';
import { reveal, useTimeline } from '../motion';
import { DemoFrame, Grad, HexDot, Panel, PanelBar, PlayToggle, Section, StatusChip } from './kit';
import { NightTabs } from './Verdicts/NightTabs';
import { Nights } from './Verdicts/Nights';
import { Rules, TwoQuestions } from './Verdicts/Rules';
import { Sheet } from './Verdicts/Sheet';
import { ACTS, DURATION, NIGHTS, nightOf } from './Verdicts/script';
import './Verdicts.css';

const FIGURE =
  'Example: the same test on three nights — passed on Monday, no verdict on Tuesday when Billing asked to sign in, and failed a check on Wednesday when the total was 1,204.00.';
const CAPTION = 'Illustration of the test’s run view in Logs, played about 8× faster.';

const tabId = (i: number) => `proof-tab-${i}`;
const panelId = (i: number) => `proof-night-${i}`;

export function Verdicts() {
  const panel = useRef<HTMLDivElement>(null);
  /* A night picked by hand replays at double speed; back to 1× once Play hands the console its advance. */
  const [manual, setManual] = useState(false);
  const tl = useTimeline(panel, { duration: DURATION, acts: ACTS, rate: manual ? 2 : 1 });
  const current = nightOf(tl.act);
  const enhanced = tl.enhanced;
  const advancing = tl.motion && !tl.paused && !tl.ended;

  useEffect(() => {
    if (!tl.paused) setManual(false);
  }, [tl.paused]);

  const select = (i: number) => {
    setManual(true);
    tl.goToAct(i * 2);
  };

  /* A click or tap anywhere else in the console (reading, selecting a line) means somebody is looking: the
     advance stops until Play. A click, not pointerdown - a finger that starts a scroll on the console is
     only passing by. The tabs, the night hexes and Pause do their own thing. */
  const latest = useRef(tl);
  latest.current = tl;
  useEffect(() => {
    const el = panel.current;
    if (!el) return undefined;
    const down = (e: MouseEvent) => {
      const t = latest.current;
      if ((e.target as Element).closest('[data-tl-control], .vd-tab, .vd-dot--btn')) return;
      if (t.motion && !t.paused && !t.ended) t.toggle();
    };
    el.addEventListener('click', down);
    return () => el.removeEventListener('click', down);
  }, []);

  return (
    <Section
      id="proof"
      index="02"
      label="Proof, not opinion"
      head="split"
      pool="left"
      title={
        <>
          Green means proven. <Grad>Nothing else is green.</Grad>
        </>
      }
      lead="The agent drives; it never grades its own work. Every check names its evidence, the verdict is computed from what was recorded, and anything that couldn’t be proven stays grey — so a red is a check that really didn’t hold."
    >
      <div className="vd-grid">
        <div className="vd-main">
          <div className="vd-console-wrap" {...reveal('panel', 0)}>
            <DemoFrame label={FIGURE} caption={CAPTION} className="vd-figure">
              <Panel ref={panel} className="vd-console">
                <PanelBar
                  className="vd-bar"
                  title={
                    <>
                      <HexDot kind="ice" size={10} />
                      <span className="vd-bar-k">Test</span>
                      <span className="vd-bar-name">“Invoice total is right”</span>
                    </>
                  }
                  end={
                    <>
                      <StatusChip size="sm" className="vd-bar-chip">
                        qa-vm-1 · by itself, 02:00
                      </StatusChip>
                      <PlayToggle timeline={tl} />
                    </>
                  }
                />
                <div className="vd-body">
                  <div className="vd-controls">
                    <Nights enhanced={enhanced} current={current} onSelect={select} panelId={panelId} />
                    {enhanced && (
                      <NightTabs tl={tl} current={current} advancing={advancing} onSelect={select} tabId={tabId} panelId={panelId} />
                    )}
                  </div>
                  <div className="vd-sheets" data-enhanced={enhanced ? '' : undefined}>
                    {NIGHTS.map((n) => (
                      <Sheet
                        key={n.day}
                        night={n}
                        enhanced={enhanced}
                        place={n.i < current ? 'before' : n.i === current ? 'current' : 'after'}
                        id={panelId(n.i)}
                        tabId={tabId(n.i)}
                      />
                    ))}
                  </div>
                </div>
              </Panel>
            </DemoFrame>
          </div>
        </div>
        <div className="vd-side">
          <div className="vd-q-wrap" {...reveal('panel', 1)}>
            <TwoQuestions />
          </div>
          <Rules from={2} />
        </div>
      </div>
    </Section>
  );
}
