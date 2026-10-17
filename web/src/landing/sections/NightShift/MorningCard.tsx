/* 9 A.M. - the answer from Claude. A two-bubble chat in glass: the question on the right, the tool Claude
 * called (a mono chip), and the answer on the left - the failed check from 02 in the test's own words, drawn
 * as the same red CheckLine, then the rest of the night in one breath.
 *
 * Static text for every reader: the card is not aria-hidden, only its two buttons are, because they are a
 * picture of the product's buttons - not controls on this page - and the keyboard should never stop on a
 * fake one.
 *
 * NEVER AN EMPTY CARD. On the section's timeline the card, the question and the tool chip are there from
 * the first frame; while the night plays the tool's dots think and the answer's box holds pending lines
 * (both transient - no poster shows them), and at `answer` the words arrive in that box and the dots turn
 * into a tick. In every poster the answer is simply there.
 */
import type { ReactNode, Ref } from 'react';
import { Check, ImageIcon, MessageSquareText, Play, Wrench } from 'lucide-react';
import { cue, reveal } from '../../motion';
import { CheckLine, Lines, Panel } from '../kit';

export interface MorningCopy {
  kicker: string;
  ask: string;
  tool: string;
  /** Before the check: "One thing. “Invoice total is right” failed check 1 on qa-vm-1:". */
  lead: ReactNode;
  check: { statement: string; evidence: string; proves: string };
  /** After the check: the frame, the two that passed, the miss. */
  rest: ReactNode;
  actions: [string, string];
  note: string;
}

export interface MorningTimes {
  /** When the answer's words land and the tool is done. */
  answer: number;
  /** When the product's two buttons and the note fade in under it. */
  actions: number;
}

export function MorningCard({ copy, at, colRef }: { copy: MorningCopy; at: MorningTimes; colRef?: Ref<HTMLDivElement> }) {
  return (
    <div className="ns-morning-col" ref={colRef} {...reveal('panel', 2)}>
      <Panel as="article" pad className="ns-morning" aria-label="The morning answer">
        <p className="ns-m-kicker">
          <MessageSquareText aria-hidden strokeWidth={2} />
          {copy.kicker}
        </p>

        <p className="ns-m-you">
          <span className="sr-only">You: </span>
          {copy.ask}
        </p>

        <p className="ns-m-tool">
          <Wrench aria-hidden strokeWidth={2} />
          <span className="ns-m-tool-n">{copy.tool}</span>
          <span className="ns-m-tool-st" aria-hidden="true">
            <span className="ns-m-wait hl-typing hl-transient" {...cue(0, 'none', at.answer)}>
              <i />
              <i />
              <i />
            </span>
            <span className="ns-m-done" {...cue(at.answer, 'fade')}>
              <Check strokeWidth={2.4} />
            </span>
          </span>
        </p>

        <div className="ns-m-answer">
          {/* The answer's shape before its words: a line, the check's tile, four lines. */}
          <span className="ns-m-pending hl-transient" aria-hidden="true" {...cue(0, 'none', at.answer)}>
            <i />
            <b />
            <i />
            <i />
            <i />
            <i />
          </span>
          <div className="ns-m-answer-in" {...cue(at.answer, 'rise')}>
            <p>{copy.lead}</p>
            <Lines className="ns-m-check" label="The check that failed">
              <CheckLine n={1} kind="value is" statement={copy.check.statement} outcome="fail" tier="tree" evidence={copy.check.evidence} proves={copy.check.proves} />
            </Lines>
            <p>{copy.rest}</p>
          </div>
        </div>

        <div className="ns-m-acts" aria-hidden="true" {...cue(at.actions, 'fade')}>
          <span className="hl-pill ns-m-act">
            <ImageIcon strokeWidth={2} />
            {copy.actions[0]}
          </span>
          <span className="hl-pill ns-m-act">
            <Play strokeWidth={2} />
            {copy.actions[1]}
          </span>
        </div>
        <p className="ns-m-note" {...cue(at.actions, 'fade')}>
          {copy.note}
        </p>
      </Panel>
    </div>
  );
}
