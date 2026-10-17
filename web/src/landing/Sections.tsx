/* The rest of the page: what the hive is for, explained in the order a visitor asks it.
 *
 * The hero says what Hivelink is; the three cards say what it does. A visitor who has never seen a
 * computer-use agent still leaves asking "how would I start?", "what would I use it for?", "how do I know
 * it did it?", "can it run without me?" and "does it work with my AI?" - so each of those gets a section,
 * in that order, and then the questions people ask out loud. Every section ends in the same call, and the
 * call goes to the ONE form (call-waitlist.ts): a second form would split the list and the attention.
 *
 * All of it is real text, rendered on the server with the rest of the page, so it is what a search engine
 * reads. Nothing here is a claim about anybody's numbers: the runs, machines and apps are examples, said
 * as examples. Windows and macOS only - those are the agents that exist.
 *
 * Built from the same parts as the rest of the landing and the admin: the vendored Card, Badge, Typography
 * and Button styles, the brand GlassCell, and colours only through tokens.
 */
import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { Badge } from '@insightis/ui/Badge';
import { buttonVariants } from '@insightis/ui/Button';
import { Card } from '@insightis/ui/Card';
import { Typography } from '@insightis/ui/Typography';
import { cn } from '@insightis/ui/cn';
import { GlassCell, GlassCellAccent, GlassCellCore, GlassCellPanel } from '@/components/brand/GlassCell';
import { callWaitlist } from './call-waitlist';

/** The call every section ends with: the system's primary button, as a link to the one form. */
export function JoinCta({ label = 'Join the waitlist', note }: { label?: string; note?: string }) {
  return (
    <div className="landing-sec-cta">
      <a
        href="#waitlist"
        onClick={callWaitlist}
        className={buttonVariants({ variant: 'primary', size: 'xl', rounded: 'full', className: 'landing-cta landing-cta-link' })}
      >
        {label}
        <ArrowRight aria-hidden strokeWidth={2.2} className="size-[18px]" />
      </a>
      {note && <span className="landing-sec-note">{note}</span>}
    </div>
  );
}

function Head({ eyebrow, title, lead, id }: { eyebrow: string; title: ReactNode; lead?: ReactNode; id: string }) {
  return (
    <div className="landing-props-head">
      <p className="landing-eyebrow font-mono">{eyebrow}</p>
      <Typography variant="h2" id={id} className="landing-h2">
        {title}
      </Typography>
      {lead && <Typography className="landing-props-lead">{lead}</Typography>}
    </div>
  );
}

/* ---------- 1. How the hive forms ---------- */

const STEPS = [
  {
    num: '01',
    title: 'Add a bee',
    body: 'Install the small agent on a Windows PC or a Mac with one line in PowerShell or Terminal, or attach it with a short code from your account. No sign-in on that machine.',
    chip: <><span className="landing-chip-k">attach code</span> 7Q4-K9P</>,
    glyph: (
      <>
        <GlassCellPanel d="M3 5.5A1.5 1.5 0 0 1 4.5 4h15A1.5 1.5 0 0 1 21 5.5v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 15.5Z" />
        <GlassCellAccent d="M12 7.5v6M9 10.5h6M8 20h8" />
      </>
    ),
  },
  {
    num: '02',
    title: 'Name its cell',
    body: 'Each machine gets its own name, finance-pc, mac-studio, office-3, and joins your hive. You see at a glance which bees are online and which are asleep.',
    chip: <><span className="landing-chip-p">●</span> finance-pc <span className="landing-chip-k">·</span> online</>,
    glyph: (
      <>
        <GlassCellPanel d="M12 2.8 19.8 7.3v9.4L12 21.2 4.2 16.7V7.3Z" />
        <GlassCellAccent d="M8.5 10.5h7M8.5 13.5h4.5" />
      </>
    ),
  },
  {
    num: '03',
    title: 'Hand out the work',
    body: 'Type the goal in plain words and pick one bee, a few, or the whole swarm. Each one does it on its own screen and reports back to the hive.',
    chip: <><span className="landing-chip-p">›</span> --on finance-*</>,
    glyph: (
      <>
        <GlassCellCore cx={12} cy={12} r={3} />
        <GlassCellAccent d="M6.3 7.3 9.6 10.2M17.7 7.3l-3.3 2.9M6.3 16.7l3.3-2.9M17.7 16.7l-3.3-2.9" />
      </>
    ),
  },
];

function HowItWorks() {
  return (
    <section className="landing-sec" aria-labelledby="how-title">
      <Head
        id="how-title"
        eyebrow="How the hive forms"
        title="From one command to a working hive."
        lead="No servers to run, no scripts to write. Put a bee on each computer, give it a name, and start handing out work the way you would to a colleague."
      />
      <div className="landing-cards landing-steps">
        {STEPS.map((s) => (
          <Card key={s.num} variant="outline" rounded="xl" fullWidth className="landing-card">
            <div className="landing-card-top">
              <GlassCell className="landing-cell-ico">{s.glyph}</GlassCell>
              <span className="font-mono landing-num">{s.num}</span>
            </div>
            <Typography variant="h3" className="landing-h3">
              {s.title}
            </Typography>
            <Typography className="landing-card-body">{s.body}</Typography>
            <span className="landing-chip font-mono">{s.chip}</span>
          </Card>
        ))}
      </div>
      <JoinCta note="Early access opens soon." />
    </section>
  );
}

/* ---------- 2. Use cases ---------- */

const USES = [
  { team: 'Finance', goal: 'file the September invoices and fill in the totals', apps: 'Explorer · Excel', os: 'Windows' },
  { team: 'Office & admin', goal: 'reply to Ann that the invoice is approved', apps: 'Outlook', os: 'Windows' },
  { team: 'Sales', goal: 'copy new form leads into the CRM and tag them October', apps: 'Browser · CRM', os: 'Windows' },
  { team: 'Support', goal: 'close every ticket marked ‘resolved’', apps: 'Helpdesk in Edge', os: 'Windows' },
  { team: 'Operations', goal: 'zip last month’s scans and move them to the archive, on every office PC', apps: 'Explorer · Finder', os: 'Windows + macOS' },
  { team: 'Reporting', goal: 'export this week’s timesheet to PDF, every Friday at 17:00', apps: 'Excel · Numbers', os: 'macOS' },
];

const APPS = ['Excel', 'Outlook', 'Explorer', 'Finder', 'Numbers', 'Chrome', 'Edge', 'your CRM', 'the helpdesk', 'that one old desktop app'];

function UseCases() {
  return (
    <section className="landing-sec" aria-labelledby="uses-title">
      <Head
        id="uses-title"
        eyebrow="Use cases"
        title="What a hive gets done in a day."
        lead="The jobs that eat an afternoon: the same clicks in the same apps, on more than one computer. Say them once; the bees do the clicking."
      />
      <div className="landing-uses">
        {USES.map((u) => (
          <Card key={u.team} variant="outline" rounded="xl" fullWidth className="landing-card landing-use">
            <div className="flex items-center justify-between gap-3">
              <Badge variant="secondary" rounded="full" className="landing-use-team">
                {u.team}
              </Badge>
              <span className="font-mono landing-num">{u.os}</span>
            </div>
            <p className="landing-use-goal">
              <span className="landing-chip-p font-mono" aria-hidden="true">›</span> “{u.goal}”
            </p>
            <p className="landing-use-apps font-mono">{u.apps}</p>
          </Card>
        ))}
      </div>
      <div className="landing-apps" aria-label="Apps the agent can work in">
        <span className="landing-apps-k font-mono">works in any window:</span>
        {APPS.map((a) => (
          <span key={a} className="landing-apps-chip">
            {a}
          </span>
        ))}
      </div>
      <JoinCta label="Put your hive to work" />
    </section>
  );
}

/* ---------- 3. Proof and control ---------- */

const RUNS: { what: string; machine: string; outcome: string; tone: 'ok' | 'bad' | 'off'; took: string }[] = [
  { what: 'file the September invoices in Finance', machine: 'finance-pc', outcome: 'ok', tone: 'ok', took: '2 min 10 s' },
  { what: 'book the Thursday standup room', machine: 'reception-pc', outcome: 'could not finish', tone: 'bad', took: 'asked you' },
  { what: 'rename the Q3 sheet and save it', machine: 'ops-mini', outcome: 'stopped by you', tone: 'off', took: '40 s' },
  { what: 'close the tickets marked ‘resolved’', machine: 'support-desk', outcome: 'ok', tone: 'ok', took: '3 min 21 s' },
];

const PROMISES = [
  { title: 'Every run is written down', body: 'What was asked, every step it took on screen, and how it ended. Open any run and see it.' },
  { title: 'You can stop any bee', body: 'Stop what is running, cancel what is waiting, relaunch what failed, from one list.' },
  { title: 'Unsure means it asks', body: 'When the screen is not what it expected, the bee stops and asks instead of guessing.' },
  { title: 'Checks decide the colour', body: 'Green when what must be true held, red when it did not, grey when nothing was proven.' },
];

function Proof() {
  return (
    <section className="landing-sec" aria-labelledby="proof-title">
      <div className="landing-split">
        <div>
          <Head
            id="proof-title"
            eyebrow="Proof, not promises"
            title="You see every move. You can stop any of them."
            lead="An agent you cannot check is an agent you cannot trust with real work. So every bee brings back evidence, and you hold the stop button."
          />
          <ul className="landing-promises">
            {PROMISES.map((p) => (
              <li key={p.title}>
                <b>{p.title}.</b> {p.body}
              </li>
            ))}
          </ul>
        </div>
        <Card variant="outline" rounded="xl" fullWidth className="landing-card landing-logs" aria-label="Example: the Logs list">
          <div className="landing-logs-head font-mono">
            <span>Logs</span>
            <span className="landing-chip-k">example · last runs</span>
          </div>
          <ul>
            {RUNS.map((r) => (
              <li key={r.what} className="landing-log">
                <i className={cn('landing-log-dot', 'landing-log-' + r.tone)} aria-hidden="true" />
                <span className="landing-log-what">
                  {r.what}
                  <span className="landing-log-meta font-mono">
                    {r.machine} · {r.took}
                  </span>
                </span>
                <span className={cn('landing-log-out font-mono', 'landing-log-' + r.tone)}>{r.outcome}</span>
              </li>
            ))}
          </ul>
          <div className="landing-logs-check font-mono">
            <span className="landing-log-ok">✓</span> check: 14 files in September · passed
          </div>
        </Card>
      </div>
      <JoinCta />
    </section>
  );
}

/* ---------- 4. Skills and schedules ---------- */

const HONEY = [
  { k: 'Run', t: 'Ask once', b: 'A goal in plain words, done on one machine or many.' },
  { k: 'Skill', t: 'Keep the honey', b: 'A run that worked is saved as a skill you can run again with one click.' },
  { k: 'Schedule', t: 'Let it run by itself', b: 'Every Friday at 17:00, while that computer is awake. Missed runs are marked, not run hours late.' },
  { k: 'Checks', t: 'Make it a test', b: 'Add what must be true afterwards, and each run is judged green, red or grey.' },
];

function Skills() {
  return (
    <section className="landing-sec" aria-labelledby="skills-title">
      <Head
        id="skills-title"
        eyebrow="Make honey"
        title="Ask once. It runs again, on schedule, and proves it still works."
        lead="The best work is the work you never ask for twice. Turn a good run into a skill, put it on a clock, and let checks tell you the day it stops working."
      />
      <ol className="landing-honey">
        {HONEY.map((h, i) => (
          <li key={h.k} className="landing-honey-step">
            <span className="landing-honey-k font-mono">
              {String(i + 1).padStart(2, '0')} · {h.k}
            </span>
            <b className="font-display">{h.t}</b>
            <span>{h.b}</span>
          </li>
        ))}
      </ol>
      <JoinCta />
    </section>
  );
}

/* ---------- 5. Your own AI ---------- */

function YourAi() {
  return (
    <section className="landing-sec" aria-labelledby="ai-title">
      <div className="landing-split">
        <div>
          <Head
            id="ai-title"
            eyebrow="Bring your own AI"
            title="Let Claude run your hive."
            lead="Connect Claude, or any MCP client, and your own AI can hand work to your machines, read what they did and rerun your skills. Same hive, same proof, driven from the chat you already use."
          />
          <JoinCta label="Join the waitlist" note="MCP works from day one." />
        </div>
        <Card variant="outline" rounded="xl" fullWidth className="landing-card landing-chat" aria-label="Example: a chat with Claude">
          <p className="landing-chat-you">Ask finance-pc to file the September invoices, then tell me if anything is missing.</p>
          <div className="landing-chat-tool font-mono">
            <span className="landing-chip-p">⌁</span> hivelink · do --on finance-pc
            <span className="landing-chip-k"> → ok · 2 min 10 s</span>
          </div>
          <p className="landing-chat-ai">
            Done on finance-pc: 14 invoices moved into Finance › 2026 › September and renamed. The check passed, nothing is
            missing. The run is in Logs with screenshots.
          </p>
        </Card>
      </div>
    </section>
  );
}

/* ---------- 6. Questions ---------- */

export const FAQ: { q: string; a: string }[] = [
  {
    q: 'What is Hivelink?',
    a: 'A small AI agent you put on each of your computers, and one account that sees them all. You tell a machine, or many, what to do in plain words; each does it on its own screen and logs proof of every run.',
  },
  { q: 'Which computers does it run on?', a: 'Windows and macOS. Each machine runs its own agent and gets its own name in your hive.' },
  {
    q: 'Does it only work in the browser?',
    a: 'No. The agent works from a picture of the screen, so it can use Excel, Outlook, Explorer, Finder and any desktop window, not only a browser tab.',
  },
  {
    q: 'How do I know it actually did the job?',
    a: 'Every run is logged: what was asked, what it did and how it ended. Add checks to a skill and each run is judged green, red or grey.',
  },
  {
    q: 'Can it run while I am away?',
    a: 'Yes. Save a run that worked as a skill and put it on a schedule; it runs by itself while that computer is awake, and a missed run is marked as missed.',
  },
  { q: 'When can I try it?', a: 'Early access opens soon. Join the waitlist and we will email you once, when the hive opens.' },
];

function Faq() {
  return (
    <section className="landing-sec" aria-labelledby="faq-title">
      <div className="landing-split landing-faq-split">
        <Head
          id="faq-title"
          eyebrow="Questions"
          title="Asked around the hive."
          lead="Short answers to what people ask first. The rest we will show you in the hive."
        />
        <div className="landing-faq">
          {FAQ.map((f) => (
            <details key={f.q} className="landing-faq-item">
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- 7. The last call ---------- */

function FinalCall() {
  return (
    <section className="landing-sec" aria-labelledby="final-title">
      <Card variant="outline" rounded="xl" fullWidth className="landing-card landing-final">
        <p className="landing-eyebrow font-mono justify-center">The hive opens soon</p>
        <Typography variant="h2" id="final-title" className="landing-h2 landing-final-h">
          Every machine. One hive. Yours first.
        </Typography>
        <Typography className="landing-props-lead landing-final-lead">
          Leave your email and be among the first to put a bee on every computer you run.
        </Typography>
        <JoinCta label="Join the waitlist" note="One email when the hive opens. No spam, ever." />
      </Card>
    </section>
  );
}

export function MoreSections() {
  return (
    <>
      <HowItWorks />
      <UseCases />
      <Proof />
      <Skills />
      <YourAi />
      <Faq />
      <FinalCall />
    </>
  );
}
