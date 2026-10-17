/* THE EIGHT JOBS - five QA, three IT - that 06 replays as run cards. Each one is a scenario the product
 * really runs today (see the product notes): a goal in words, what the agent did on the screen, the checks
 * the MACHINE decided (tree on the desktop, dom in Chrome) and the verdict in the product's own words.
 * Three of them end red or mixed on purpose: an honest deck sells better than a brochure.
 *
 * Plain data, so the card is one recipe for all eight and the server renders every word of it.
 */
import type { Tier } from '../kit';

export type Area = 'qa' | 'it';

/** How a run ended, as one colour: the card's top edge and its dot in the deck's row of nights. */
export type Tone = 'pass' | 'fail' | 'mixed';

/** A step's mark once it is done: a tick, a refusal (grey hollow hex), a wait (the model was busy) or a note. */
export type StepKind = 'done' | 'refused' | 'wait' | 'note';

export type Icon = 'desktop' | 'chrome' | 'fleet' | 'claude' | 'telegram' | 'long' | 'schedule';

export interface Step {
  text: string;
  kind?: StepKind;
}

export interface Check {
  outcome: 'pass' | 'fail';
  tier: Tier;
  /** What must be true, as the check says it. */
  statement: string;
  /** A mono chip before the statement: a count or the machine it ran on. */
  kind?: string;
  /** What was actually there (red under a FAIL). */
  evidence?: string;
  /** The moment the check is bound to - "When?" in the product. Empty means at the end. */
  when?: string;
}

export interface VerdictChipSpec {
  kind: 'pass' | 'fail' | 'grey';
  text: string;
}

export interface UseCase {
  id: string;
  area: Area;
  icon: Icon;
  tag: string;
  meta: string;
  title: string;
  goal: string;
  did: Step[];
  checks: Check[];
  tone: Tone;
  verdict: VerdictChipSpec[];
  /** The verdict's one sentence. */
  says: string;
  /** Show the test's row of nights gaining one more green dot (the nightly regression). */
  nights?: boolean;
}

export const CASES: UseCase[] = [
  {
    id: 'outlook',
    area: 'qa',
    icon: 'desktop',
    tag: 'QA · Desktop',
    meta: 'Classic Outlook · Windows 11 VM · nightly 02:00',
    title: 'Outlook still sends',
    goal: 'Reply to Ann that the invoice is approved',
    did: [
      { text: 'qa-vm-1 takes it by itself, from a schedule' },
      { text: 'click “Reply” on Ann’s “Invoice” thread' },
      { text: 'type “Hi Ann, the invoice is approved.” → Ctrl+Enter' },
    ],
    checks: [
      { outcome: 'pass', tier: 'tree', statement: '“Sent Items” is there', when: 'the message has been sent' },
      { outcome: 'pass', tier: 'tree', statement: '“Re: Invoice” is there' },
    ],
    tone: 'pass',
    verdict: [{ kind: 'pass', text: 'passed' }],
    says: '2 held, 0 did not. One more green dot in the row of nights.',
    nights: true,
  },
  {
    id: 'cart',
    area: 'qa',
    icon: 'chrome',
    tag: 'QA · Chrome',
    meta: 'staging web shop · your signed-in Chrome',
    title: 'The cart total is wrong',
    goal: 'On staging, add the Blue mug to the cart and open the cart',
    did: [
      { text: 'open staging.shop.test → “Blue mug” → “Add to cart”' },
      { text: 'click “Cart”' },
      { text: 'read the cart in the session you’re already signed in to' },
    ],
    checks: [
      { outcome: 'pass', tier: 'dom', statement: 'the address contains /cart' },
      { outcome: 'pass', tier: 'dom', statement: 'exactly 1 “Blue mug”' },
      { outcome: 'fail', tier: 'dom', statement: '“Total” contains “$12.00”', evidence: '“Total” holds “$0.00”, which doesn’t contain “$12.00”' },
    ],
    tone: 'fail',
    verdict: [{ kind: 'fail', text: 'failed a check' }],
    says: 'The agent finished (ok); the product didn’t. The frame shows the $0.00 cart.',
  },
  {
    id: 'updates',
    area: 'it',
    icon: 'fleet',
    tag: 'IT · Fleet',
    meta: 'Windows Settings · 5 office PCs · from Devices',
    title: 'Five office PCs, one update check',
    goal: 'Open Windows Update and make sure it says you’re up to date',
    did: [
      { text: 'Devices → tick 5 machines → Send to 5 machines' },
      { text: 'reception-pc refuses at once: paused, so it takes no work', kind: 'refused' },
      { text: 'the other four each open Settings → Windows Update on their own screen' },
    ],
    checks: [
      { outcome: 'pass', tier: 'tree', kind: '3 ×', statement: '“You’re up to date” is there', evidence: 'finance-pc · office-1 · office-3' },
      { outcome: 'fail', tier: 'tree', kind: 'office-2', statement: '“You’re up to date” is there', evidence: '“Restart required” showed instead' },
    ],
    tone: 'mixed',
    verdict: [
      { kind: 'pass', text: '3 ok' },
      { kind: 'fail', text: '1 check failed' },
      { kind: 'grey', text: '1 refused' },
    ],
    says: 'Every machine is its own row in Logs, so you know which PC to visit.',
  },
  {
    id: 'rename',
    area: 'qa',
    icon: 'chrome',
    tag: 'QA · Chrome',
    meta: 'internal admin · your signed-in Chrome',
    title: 'Saved, then still saved',
    goal: 'In the admin panel, rename the project Apollo to Atlas',
    did: [{ text: 'click “Apollo” → “Rename”' }, { text: 'type “Atlas” → “Save”' }, { text: 'reload the page' }],
    checks: [
      { outcome: 'pass', tier: 'dom', statement: '“Saved” is there', when: 'the new name has been saved' },
      { outcome: 'pass', tier: 'dom', statement: '“Project name” holds Atlas' },
    ],
    tone: 'pass',
    verdict: [{ kind: 'pass', text: 'passed' }],
    says: 'The toast was checked at its moment, before it faded — not at the end.',
  },
  {
    id: 'testrail',
    area: 'qa',
    icon: 'claude',
    tag: 'QA · Claude',
    meta: 'Claude over MCP → desktop CRM on qa-vm-2',
    title: 'TestRail C1234, run from Claude',
    goal: 'Run TestRail case C1234 on qa-vm-2 and tell me if it passed',
    did: [
      { text: 'Claude sends the steps, the expected results and ref “TestRail C1234”' },
      { text: 'on qa-vm-2: start the CRM → “New contact”' },
      { text: 'type “Ann Lee” → “Save”' },
    ],
    checks: [
      { outcome: 'pass', tier: 'tree', statement: '“Ann Lee” is there' },
      { outcome: 'fail', tier: 'tree', statement: '“Status” holds “Active”', evidence: '“Status” holds “Draft”, not “Active”' },
    ],
    tone: 'fail',
    verdict: [{ kind: 'fail', text: 'failed a check' }],
    says: 'Claude gets every check on its own line and can write the result back through its own TestRail connector. Nothing is stored in Hivelink.',
  },
  {
    id: 'scans',
    area: 'it',
    icon: 'telegram',
    tag: 'IT · Telegram',
    meta: 'Telegram → File Explorer on finance-pc',
    title: 'Zip last month’s scans, from your phone',
    goal: 'Zip last month’s scans and move them to the Archive folder',
    did: [
      { text: '/machines → finance-pc · online · nothing running → Give a task' },
      { text: 'a voice note → “Heard: zip last month’s scans…” → Approve' },
      { text: 'Scans › September → compress → move September.zip to Archive' },
    ],
    checks: [{ outcome: 'pass', tier: 'tree', statement: '“September.zip” is there' }],
    tone: 'pass',
    verdict: [{ kind: 'pass', text: 'done · 1 check passed' }],
    says: 'The outcome comes back to the same chat.',
  },
  {
    id: 'customers',
    area: 'qa',
    icon: 'long',
    tag: 'QA · Long run',
    meta: 'desktop CRM · Windows 11 VM · qa-vm-1',
    title: 'Forty test customers, one run',
    goal: 'Enter the 40 test customers from customers.csv into the CRM and check the last one saved',
    did: [
      { text: 'customers.csv attached to the goal → Run it on qa-vm-1' },
      { text: 'each row: paste → “Save”, one turn each' },
      { text: '“The model service is overloaded right now; waiting 10 s and asking again.” — the step isn’t counted', kind: 'wait' },
    ],
    checks: [{ outcome: 'pass', tier: 'tree', statement: '“Customer 40” is there' }],
    tone: 'pass',
    verdict: [{ kind: 'pass', text: 'ok · 1 check held' }],
    says: 'About 120 steps, with a handover note every 24 decisions. A busy model is waited out, not a dead run.',
  },
  {
    id: 'export',
    area: 'it',
    icon: 'schedule',
    tag: 'IT · Schedule',
    meta: 'File Explorer · finance-pc · weekdays 09:00',
    title: 'Did the overnight export land?',
    goal: 'Check that today’s orders export landed in Reports and note its size',
    did: [
      { text: '09:00 on a weekday: finance-pc takes it from its schedule' },
      { text: 'File Explorer → Reports → find “orders-2026-10-17.csv”' },
      { text: 'note: 2.4 MB, modified 02:14', kind: 'note' },
    ],
    checks: [{ outcome: 'pass', tier: 'tree', statement: '“orders-2026-10-17.csv” is there' }],
    tone: 'pass',
    verdict: [{ kind: 'pass', text: 'ok · 1 check held' }],
    says: 'Asleep at 09:00? It’s marked missed — never run hours late.',
  },
];

export type Filter = 'all' | Area;

export const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'qa', label: 'QA' },
  { id: 'it', label: 'IT' },
];

export const subsetOf = (f: Filter): UseCase[] => (f === 'all' ? CASES : CASES.filter((c) => c.area === f));
