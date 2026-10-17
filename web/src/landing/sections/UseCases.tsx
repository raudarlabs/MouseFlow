/* 06 · USE CASES - the page's showpiece and its synthesis. Everything above - tests in words, checks the
 * machine decides, Nightly, the fleet, Claude, Telegram - comes back as eight concrete jobs from one week in
 * the hive, five QA and three IT, each a pocket run report that replays its own mini-run when it comes to
 * the middle of the deck. Red endings stay in: they are the product doing its job.
 *
 * It turns an understood product into a wanted one, so it carries the second CTA - and hands over to 07,
 * with the reader asking whether letting it drive is safe.
 *
 * The deck, its arithmetic and the card live in ./UseCases/ (Deck.tsx, ring.ts, CaseCard.tsx); the eight
 * jobs are data in ./UseCases/cases.ts. Styles: UseCases.css.
 */
import { Grad, JoinCta, Section } from './kit';
import { Deck } from './UseCases/Deck';
import './UseCases.css';

export function UseCases() {
  return (
    <Section
      id="use-cases"
      index="06"
      label="Use cases"
      head="split"
      pool="center"
      title={
        <>
          Real jobs. Real screens. <Grad>Honest verdicts.</Grad>
        </>
      }
      lead="Eight jobs from a week in the hive: the regressions it guards overnight, the bugs it catches, and the errands IT hands it before the doors open. Each card replays its run."
      stageClassName="uc-stage"
      foot={<JoinCta label="Put your hive to work" />}
    >
      <Deck />
    </Section>
  );
}
