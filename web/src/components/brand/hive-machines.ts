/* WHO LIVES IN THE HIVE: one name and one last job per machine cell, keyed like hive-geometry.ts DEVICES.
 *
 * The drawing says "every machine, one hive"; pointing at a cell is where the page proves it by example -
 * each machine got a job in plain words, did it on its own screen, in its own apps, and left its own proof.
 * So every entry is a different kind of work (a test, files, a spreadsheet, a CRM, a support queue), on the
 * OS that machine would really run, and not all of them ended well: a run that could not finish says why,
 * in the same words the app's Logs use, because a hive that only ever shows green is a brochure.
 *
 * TRUE TO THE PRODUCT, line by line. Every verdict is a check in the product's grammar - `check "X" is
 * there — PASS · tree` (· dom in Chrome) - something the machine reads from the app, never the model's
 * opinion and never a count on the desktop (counting is the web's alone). Web work happens in Chrome, the
 * one browser the agent drives. A run that stopped says "could not finish" and keeps its frame; nothing
 * "stops and asks". Who started it is said too: you, or the machine by itself from a schedule.
 *
 * qa-vm-1 is the page's main character: the hero, 01, 02 and 03 all follow its one test, "Invoice total is
 * right". Illustrative, not data: no counts here are claims about anybody's fleet. Windows and macOS only -
 * those are the agents that exist. The three tagged machines (hive-geometry.ts TAGS) keep their names.
 */
export type RunOutcome = 'ok' | 'running' | 'could not finish';

export interface HiveMachine {
  name: string;
  os: 'Windows' | 'macOS';
  /** The goal as somebody typed it (or a test's name, "test: …"). */
  job: string;
  /** Who started it: a person, or the machine by itself from a schedule. */
  by: 'you' | 'schedule';
  outcome: RunOutcome;
  /** "2 min 10 s", "step 2 of 3" - short, it shares a line with the outcome. */
  took: string;
  /** What it did on its own screen, three short lines. */
  steps: [string, string, string];
  /** The check that decided the colour, in the check grammar - or why it could not finish. */
  verdict: string;
}

export const HIVE_MACHINES: Record<string, HiveMachine> = {
  '-2,2': {
    name: 'finance-pc',
    os: 'Windows',
    job: 'file the September invoices in Finance',
    by: 'you',
    outcome: 'ok',
    took: '2 min 10 s',
    steps: ['opened Explorer → Finance › 2026', 'moved the invoices from Downloads', 'named them INV-2026-09-01…14'],
    verdict: 'check “INV-2026-09-14.pdf” is there — PASS · tree',
  },
  '2,-2': {
    name: 'mac-studio',
    os: 'macOS',
    job: 'add September to the Invoices sheet',
    by: 'you',
    outcome: 'ok',
    took: '1 min 48 s',
    steps: ['opened Numbers → Invoices 2026', 'added the rows for September', 'saved and closed the sheet'],
    verdict: 'check “September” row is there — PASS · tree',
  },
  '1,2': {
    name: 'qa-vm-1',
    os: 'Windows',
    job: 'test: Invoice total is right',
    by: 'schedule',
    outcome: 'ok',
    took: 'passed · 3 held · by itself, 02:00',
    steps: ['switch to Billing → New invoice', 'type ACME · 4 · 310 → Save', 'read “Total” and “Invoice saved”'],
    verdict: 'check “Total” holds 1,240.00 — PASS · tree',
  },
  '-1,0': {
    name: 'laptop-ann',
    os: 'macOS',
    job: 'export this week’s timesheet to PDF',
    by: 'you',
    outcome: 'ok',
    took: '1 min 05 s',
    steps: ['opened Excel → Timesheet W42', 'chose File › Export › PDF', 'saved it to Desktop › Timesheets'],
    verdict: 'check “Timesheet-W42.pdf” is there — PASS · tree',
  },
  '1,-1': {
    name: 'ops-mini',
    os: 'macOS',
    job: 'rename the Q3 sheet and save it',
    by: 'you',
    outcome: 'running',
    took: 'step 2 of 3',
    steps: ['opened Numbers → Q3 report', 'renamed the sheet to “Q3 final”', 'saving…'],
    verdict: 'checks are made at their moment',
  },
  '0,1': {
    name: 'support-desk',
    os: 'Windows',
    job: 'close the tickets marked “resolved”',
    by: 'you',
    outcome: 'ok',
    took: '3 min 21 s',
    steps: ['opened the helpdesk in Chrome', 'filtered by status “resolved”', 'closed the tickets one by one'],
    verdict: 'check “No resolved tickets” is there — PASS · dom',
  },
  '-1,-2': {
    name: 'reception-pc',
    os: 'Windows',
    job: 'book the Thursday standup room',
    by: 'you',
    outcome: 'could not finish',
    took: 'ended at step 2',
    steps: ['opened the room calendar', 'Thursday 10:00 is already taken', 'ended there and said why'],
    verdict: 'could not finish · Thursday 10:00 is already taken · frame kept',
  },
  '2,0': {
    name: 'sales-laptop',
    os: 'Windows',
    job: 'copy new leads from the form into the CRM',
    by: 'you',
    outcome: 'ok',
    took: '2 min 37 s',
    steps: ['opened the form responses', 'pasted the new leads into the CRM', 'tagged them “October”'],
    verdict: 'check “October” is there — PASS · tree',
  },
  '-3,2': {
    name: 'archive-pc',
    os: 'Windows',
    job: 'zip last month’s scans and move them',
    by: 'schedule',
    outcome: 'ok',
    took: '1 min 12 s',
    steps: ['opened Explorer → Scans › September', 'compressed the folder', 'moved September.zip to Archive › 2026'],
    verdict: 'check “September.zip” is there — PASS · tree',
  },
  '0,-2': {
    name: 'design-mac',
    os: 'macOS',
    job: 'export the launch banners for the web',
    by: 'you',
    outcome: 'ok',
    took: '2 min 02 s',
    steps: ['opened Figma → Launch banners', 'exported the frames as PNG @2x', 'opened Shared › Web in Finder'],
    verdict: 'check “banner-1@2x.png” is there — PASS · tree',
  },
};
