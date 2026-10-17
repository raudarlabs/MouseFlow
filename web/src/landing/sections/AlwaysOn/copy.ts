/* 04 · For IT - every word the section shows, as typed constants, in one place.
 *
 * The section is the IT side of the same agent, told truthfully: what is shipped (Devices, one command to
 * many machines, the enrolment code, the tray switch the account cannot override, dial-out only) and what it
 * needs (a signed-in, unlocked desktop; a person's one-time Mac permissions). Product words are the
 * product's: "ok · 1 check failed", "refused — paused", "Taking work from your account — click to stop",
 * "Let My AI Act On This Mac". The tray and the menu bar still say "MouseFlow agent", so the mocks do too.
 */

export type Platform = 'ps' | 'mac';
export type MachineStatus = 'online' | 'paused' | 'offline';

/* ── Devices: one command, four machines ── */

export const DEVICES = {
  bar: 'Devices · 6 machines · 4 online',
  composer: 'Give a command',
  segments: ['A goal in words', 'A skill'] as const,
  placeholder: 'Say what it should do, in words',
  to: 'To',
  goal: 'Open the VPN client and make sure it says Connected',
  send: 'Send to 4 machines',
  columns: ['Machine', 'Platform', 'Status', 'Now'] as const,
  idle: 'nothing running',
  queued: 'queued',
  running: 'running',
  summary: {
    counts: [
      { kind: 'neutral', text: '4 sent' },
      { kind: 'pass', text: '2 held' },
      { kind: 'fail', text: '1 check failed' },
      { kind: 'grey', text: '1 refused' },
    ] as const,
    note: 'Each one is a row in Logs, with its machine.',
  },
  sr: 'Example: one plain-words command sent to four office PCs — two held, one failed its check, one refused because it was paused.',
  caption: 'Illustration of the Devices screen, played faster than a real run.',
} as const;

/** One row of Devices. `role` says what the command does to it: the busy machine keeps its own test, three
    run the command, the paused one refuses it, the offline Mac never hears of it. */
interface RowBase {
  name: string;
  platform: string;
  status: MachineStatus;
  /** The agent version Devices reports; an older one carries the product's "update" mark. */
  agent: string;
  update?: boolean;
}

export type DeviceRow =
  | (RowBase & { role: 'busy'; test: string })
  | (RowBase & { role: 'target'; result: 'held' | 'failed'; reason?: string })
  | (RowBase & { role: 'refused'; reason: string })
  | (RowBase & { role: 'away'; seen: string });

export const ROWS: DeviceRow[] = [
  { role: 'busy', name: 'qa-vm-1', platform: 'Windows 11 VM', status: 'online', agent: '0.29.0', test: '“Outlook still sends”' },
  { role: 'target', name: 'front-desk-1', platform: 'Windows 11', status: 'online', agent: '0.29.0', result: 'held' },
  { role: 'target', name: 'front-desk-2', platform: 'Windows 11', status: 'online', agent: '0.29.0', result: 'held' },
  {
    role: 'target',
    name: 'front-desk-3',
    platform: 'Windows 10',
    status: 'online',
    agent: '0.29.0',
    result: 'failed',
    reason: '“Connected” is not on the window',
  },
  { role: 'refused', name: 'reception-pc', platform: 'Windows 11', status: 'paused', agent: '0.29.0', reason: 'paused, so it takes no work' },
  { role: 'away', name: 'mac-studio', platform: 'macOS', status: 'offline', agent: '0.28.1', update: true, seen: 'last seen 2 h ago' },
];

export const RESULT_TEXT = { held: 'ok · “Connected” held', failed: 'ok · 1 check failed' } as const;

/* ── Add machines: one code, one line ── */

export const ENROL = {
  title: 'Add machines',
  sub: 'One code, as many machines as you say',
  code: ['HL', '7Q4K9', 'P2XW8'] as const,
  codeSr: 'Enrolment code HL-7Q4K9-P2XW8',
  meta: 'for 12 machines · valid 3 days · shown once',
  tabsLabel: 'Install on',
  caption: 'Illustration of the one-line install, played faster than a real install.',
  pollLabel: 'asks for work · outbound only',
  pollOff: 'no calls · switched off on the machine',
  inDevices: 'In Devices now',
  online: 'online',
  notTaking: 'not taking work',
} as const;

export interface PlatformCopy {
  tab: string;
  /** The pane's heading on the page without a script, where both platforms show, one under the other. */
  paneLabel: string;
  prompt: string;
  command: string;
  log: readonly string[];
  /** The name the machine joins as - the log's third line and its new row in Devices. */
  machine: string;
  os: string;
}

export const PLATFORMS: Record<Platform, PlatformCopy> = {
  ps: {
    tab: 'PowerShell',
    paneLabel: 'Windows · PowerShell',
    prompt: 'PS>',
    /* Straight quotes: this is code someone could select and paste. */
    command: '& ([scriptblock]::Create((irm …/install-windows.ps1))) -Enroll HL-7Q4K9-P2XW8 -Name "front-desk-4"',
    log: [
      'Installed for this user · starts at every logon',
      'Traded the code for its own device token',
      'Joined your hive as front-desk-4',
      'Asking for work every few seconds · nothing reaches in',
    ],
    machine: 'front-desk-4',
    os: 'Windows 11',
  },
  mac: {
    tab: 'Terminal',
    paneLabel: 'macOS · Terminal',
    prompt: '$',
    command: 'curl -fsSL …/install-mac.sh | bash -s -- --enroll HL-7Q4K9-P2XW8 --name "mac-mini-2"',
    log: [
      'Built the agent on this Mac · a login item from now on',
      'Accessibility ✓ · Screen Recording ✓ — allowed by you, once',
      'Joined your hive as mac-mini-2',
      'Asking for work every few seconds · a watchdog checks on it every 5 minutes',
    ],
    machine: 'mac-mini-2',
    os: 'macOS',
  },
};

/* ── The switch on the machine ── */

export const SWITCH = {
  title: 'The switch on the machine',
  sub: 'The agent’s own menu, word for word.',
  ps: {
    paneLabel: 'Windows · the tray',
    header: 'MouseFlow agent 0.29.0',
    /* The button keeps one name and says on/off with aria-pressed (the toggle pattern); the visible line is
       the agent's own, which changes with the state. */
    name: 'Taking work from your account',
    on: 'Taking work from your account — click to stop',
    off: 'Not taking work — click to start',
    quit: 'Quit MouseFlow Agent',
    clock: '09:41',
  },
  mac: {
    paneLabel: 'macOS · the menu bar',
    header: 'MouseFlow Agent 0.29.0',
    name: 'Let My AI Act On This Mac',
    on: 'Let My AI Act On This Mac',
    off: 'Let My AI Act On This Mac',
    quit: 'Quit and Turn Off Start at Login',
    clock: 'Fri 09:41',
  },
  lineOn: 'On: it asks your account for work every few seconds.',
  lineOff: 'Switched off on this machine — it makes no calls at all, and your account can’t switch it back on.',
  lineBack: 'Back on — because someone at this machine said so.',
  caption: 'Illustration of the agent’s own menu. Try it — nothing is sent.',
} as const;

/* ── The four points ── */

export type PointGlyph = 'power' | 'out' | 'key' | 'list';

export const POINTS: { glyph: PointGlyph; title: string; body: string }[] = [
  {
    glyph: 'power',
    title: 'Starts at logon',
    body: 'From the Startup folder on Windows, with no admin rights; as a login item on a Mac, with a watchdog that revives it.',
  },
  {
    glyph: 'out',
    title: 'Asks. Never listens.',
    body: 'No inbound port. The machine dials out for work, and with its switch off it makes no calls at all.',
  },
  {
    glyph: 'key',
    title: 'One code, up to 50 machines',
    body: 'No browser and no sign-in on each one. A code lasts from a day to a week and can be withdrawn.',
  },
  {
    glyph: 'list',
    title: 'Every machine accounted for',
    body: 'Online, paused or offline, what it’s doing now, Pause, Stop and Remove. Logs records which machine did what, and who asked.',
  },
];

/* ── The fine print ── */

export const FINE = {
  label: 'Fine print',
  items: [
    'Needs a signed-in, unlocked desktop on Windows 10/11 or macOS — a VM is fine.',
    'A Mac asks a person to allow Accessibility and Screen Recording once.',
    'Commands are jobs in plain words, done through the screen the way a person would — not shell scripts.',
    'No Linux, no headless servers.',
  ],
} as const;

export const FOOT = { href: '#channels', text: 'Give it commands from anywhere' } as const;
