/* WHY THE COLOURS CAN BE TRUSTED - the two pieces beside the console.
 *
 * TwoQuestions answers the objection Wednesday raises ("so the bot failed?"): Logs asks two questions and
 * never folds them into one chip. Its chips are the product's own Logs chips, so it visibly matches the
 * admin. Rules are the three rules behind every verdict, in a list with hairlines; rule 3 draws the evidence
 * ladder (dom > tree > picture) as three static bars in the tier tags' own colours.
 *
 * Static content: no timeline. They reveal with the stage, and only brighten under a fine pointer.
 */
import type { ReactNode } from 'react';
import { ChartNoAxesColumnDecreasing, CircleDashed, ScanEye, type LucideIcon } from 'lucide-react';
import { cn } from '@insightis/ui/cn';
import { reveal, revealGroup, revealItem } from '../../motion';
import { Panel, StatusChip, TierTag, type Tier } from '../kit';

export function TwoQuestions({ className }: { className?: string }) {
  return (
    <Panel as="article" card pad className={cn('vd-q', className)} aria-labelledby="proof-q-title">
      <div className="vd-q-head">
        <h3 className="hl-h3 vd-q-title" id="proof-q-title">
          Two questions. Never one chip.
        </h3>
        <span className="vd-q-ref" aria-hidden="true">
          Logs · Wed 02:00
        </span>
      </div>
      <dl className="vd-q-list">
        <div className="vd-q-row">
          <dt>Did the agent finish?</dt>
          <dd>
            <StatusChip kind="pass">ok</StatusChip>
          </dd>
        </div>
        <div className="vd-q-row">
          <dt>Did the product pass?</dt>
          <dd>
            <StatusChip kind="fail">1 check failed</StatusChip>
          </dd>
        </div>
      </dl>
      <p className="vd-q-cap">That isn’t the automation failing. That’s the agent doing its job and finding a bug.</p>
    </Panel>
  );
}

const LADDER: { tier: Tier; what: string }[] = [
  { tier: 'dom', what: 'the real page, in Chrome' },
  { tier: 'tree', what: 'the accessibility tree, on the desktop' },
  { tier: 'picture', what: 'the model’s look — a note, never a green' },
];

function Ladder() {
  return (
    <ol className="vd-ladder" aria-label="Evidence, strongest first">
      {LADDER.map((r) => (
        <li key={r.tier} className={cn('vd-rung', `vd-rung--${r.tier}`)}>
          <span className="vd-rung-bar" aria-hidden="true">
            <i />
          </span>
          <TierTag tier={r.tier} />
          <span className="vd-rung-x">{r.what}</span>
        </li>
      ))}
    </ol>
  );
}

interface Rule {
  icon: LucideIcon;
  title: string;
  body: ReactNode;
  extra?: ReactNode;
  tone?: 'cannot';
}

const RULES: Rule[] = [
  {
    icon: ScanEye,
    title: 'The model looks. The machine reads.',
    body: 'The model picks each step from a screenshot. PASS and FAIL come only from the app’s own answer: its accessibility tree or page.',
  },
  {
    icon: CircleDashed,
    tone: 'cannot',
    title: 'CANNOT CHECK, never a guess',
    body: 'A window that won’t say, a name that matches twice, a password field: CANNOT CHECK. Never a pass.',
  },
  {
    icon: ChartNoAxesColumnDecreasing,
    title: 'Evidence has a rank',
    extra: <Ladder />,
    body: 'A test made only of picture checks is exploration, not regression.',
  },
];

/** The hex glyph in front of a rule: a 32px outline, the rule's icon inside. */
function Glyph({ icon: Icon, tone }: { icon: LucideIcon; tone?: 'cannot' }) {
  return (
    <span className={cn('vd-glyph', tone && `vd-glyph--${tone}`)} aria-hidden="true">
      <svg viewBox="0 0 32 36" focusable="false">
        <polygon points="16,1 31,9.5 31,26.5 16,35 1,26.5 1,9.5" />
      </svg>
      <Icon strokeWidth={1.75} />
    </span>
  );
}

export function Rules({ from }: { from: number }) {
  return (
    <div className="vd-rules-col">
      <p className="hl-kicker vd-rules-k" {...reveal('up', from)}>
        Three rules behind every colour
      </p>
      <ul className="vd-rules" {...revealGroup()}>
        {RULES.map((r, k) => (
          <li key={r.title} className="vd-rule" {...revealItem(from + 1 + k)}>
            <Glyph icon={r.icon} tone={r.tone} />
            <div className="vd-rule-x">
              <h3 className="vd-rule-t">{r.title}</h3>
              {r.extra}
              <p className="vd-rule-b">{r.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
