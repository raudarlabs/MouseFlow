/* WHO LIVES IN THE HIVE: one name and one last job per machine cell, keyed like hive-geometry.ts DEVICES.
 *
 * The drawing says "every machine, one hive"; pointing at a cell is where the page proves it by example -
 * each machine got a job in plain words, did it on its own screen, in its own apps, and left its own proof.
 * So every entry is a different kind of work (files, a spreadsheet, mail, a CRM, a support queue), on the
 * OS that machine would really run, and not all of them ended well: a run that could not finish says why,
 * in the same words the app's Logs use, because a hive that only ever shows green is a brochure.
 *
 * Illustrative, not data: no counts here are claims about anybody's fleet. Windows and macOS only - those
 * are the agents that exist. The three tagged machines (hive-geometry.ts TAGS) keep their names.
 */
export type RunOutcome = 'ok' | 'running' | 'could not finish';

export interface HiveMachine {
  name: string;
  os: 'Windows' | 'macOS';
  /** The goal as somebody typed it. */
  job: string;
  outcome: RunOutcome;
  /** "ok in 2 min 10 s", "step 3 of 4", "stopped at step 2" - short, it shares a line with the outcome. */
  took: string;
  /** What it did on its own screen, three short lines. */
  steps: [string, string, string];
  /** The check that decided the colour, or why it stopped. */
  verdict: string;
}

export const HIVE_MACHINES: Record<string, HiveMachine> = {
  '-2,2': {
    name: 'finance-pc',
    os: 'Windows',
    job: 'file the September invoices in Finance',
    outcome: 'ok',
    took: '2 min 10 s',
    steps: ['opened Explorer → Finance › 2026', 'moved 14 invoices from Downloads', 'named them INV-2026-09-01…14'],
    verdict: 'check: 14 files in September — passed',
  },
  '2,-2': {
    name: 'mac-studio',
    os: 'macOS',
    job: 'add September to the Invoices sheet',
    outcome: 'ok',
    took: '1 min 48 s',
    steps: ['opened Numbers → Invoices 2026', 'added 14 rows for September', 'saved and closed the sheet'],
    verdict: 'check: totals match the bank — passed',
  },
  '1,2': {
    name: 'office-3',
    os: 'Windows',
    job: 'reply to Ann that the invoice is approved',
    outcome: 'ok',
    took: '58 s',
    steps: ['opened Outlook → Inbox', 'found Ann’s message about INV-0914', 'replied “Approved — thanks!”'],
    verdict: 'check: reply is in Sent Items — passed',
  },
  '-1,0': {
    name: 'laptop-ann',
    os: 'macOS',
    job: 'export this week’s timesheet to PDF',
    outcome: 'ok',
    took: '1 min 05 s',
    steps: ['opened Excel → Timesheet W42', 'chose File › Export › PDF', 'saved it to Desktop › Timesheets'],
    verdict: 'check: Timesheet-W42.pdf exists — passed',
  },
  '1,-1': {
    name: 'ops-mini',
    os: 'macOS',
    job: 'rename the Q3 sheet and save it',
    outcome: 'running',
    took: 'step 2 of 3',
    steps: ['opened Numbers → Q3 report', 'renamed the sheet to “Q3 final”', 'saving…'],
    verdict: 'checks run when it finishes',
  },
  '0,1': {
    name: 'support-desk',
    os: 'Windows',
    job: 'close the tickets marked “resolved”',
    outcome: 'ok',
    took: '3 min 21 s',
    steps: ['opened the helpdesk in Edge', 'filtered by status “resolved”', 'closed 9 tickets one by one'],
    verdict: 'check: no resolved tickets open — passed',
  },
  '-1,-2': {
    name: 'reception-pc',
    os: 'Windows',
    job: 'book the Thursday standup room',
    outcome: 'could not finish',
    took: 'stopped at step 2',
    steps: ['opened the room calendar', 'Thursday 10:00 is already taken', 'stopped and asked what to do'],
    verdict: 'nothing booked — screenshots in Logs',
  },
  '2,0': {
    name: 'sales-laptop',
    os: 'Windows',
    job: 'copy new leads from the form into the CRM',
    outcome: 'ok',
    took: '2 min 37 s',
    steps: ['opened the form responses', 'pasted 6 new leads into the CRM', 'tagged them “October”'],
    verdict: 'check: 6 leads tagged October — passed',
  },
  '-3,2': {
    name: 'archive-pc',
    os: 'Windows',
    job: 'zip last month’s scans and move them',
    outcome: 'ok',
    took: '1 min 12 s',
    steps: ['opened Explorer → Scans › September', 'zipped 212 files', 'moved the zip to Archive › 2026'],
    verdict: 'check: zip is in Archive › 2026 — passed',
  },
  '0,-2': {
    name: 'design-mac',
    os: 'macOS',
    job: 'export the launch banners for the web',
    outcome: 'ok',
    took: '2 min 02 s',
    steps: ['opened Figma → Launch banners', 'exported 4 frames as PNG @2x', 'dropped them into Shared › Web'],
    verdict: 'check: 4 files in Shared › Web — passed',
  },
};
