# 26 — Logs

`/logs` (also `/activity`, the old path, which redirects — it was live and was linked from chats and from
schedule mail).

What your machine is doing now, what it is about to do, and everything it has done — on one page, with the
one thing each of them can have done to it where the thing is.

![Logs: running, waiting, and everything that ran](../img/activity.png)

> The screenshot predates the table below and shows the history as a list of plates.

**Renamed 2026-09-18, the owner's decision.** "Activity" described the page while it was one of eight; in
the first product — four screens — it is *the log*, the place you go to find out what happened and why.

## The history is a table, and that reverses an earlier decision

The first version of this page drew the history as a full-width table and moved away from it: at 1920px the
goal stretched the width of the screen, and the two card-shaped sections beside it made the page read as two
different pages. Both halves of that objection have been answered rather than forgotten, so the table is
back:

- **The goal is still clamped.** In the table its cell is `w-full max-w-0` with `truncate`: the column asks
  for nothing and takes whatever the service columns leave. A `max-w-[42rem]` was tried first and measured
  wrong — in a table a max width reads as a *request*, so the column took its 672px and the table overflowed
  its own container by 49px. The plates in the cards above still use the rem clamp, because there are no
  columns there for it to starve.
- **There are three neighbours now, not eight screens**, and the page is called Logs. In a log, named
  columns are the point: "14:02 · 1m 20s · schedule" puts three values side by side and names none of them.

The shape follows the audit log in our own MCPGateway (the owner's reference, 2026-09-18): a filter strip
with its own ground, a sticky header, a row that expands underneath itself, a failed row tinted, and Export
CSV / Refresh on the right of the filters.

**What was deliberately not copied.** There, an expanded row shows the request and response JSON. Here it
shows the steps in words, the check verdicts and the frames that were kept. That is not the same thing
dressed differently: JSON answers *what went to the model*, a frame answers *what was on the screen*, and in
a product whose promise is evidence the second one is the evidence.

**Export is of what is shown**, with the filters as they stand — somebody who set three filters and pressed
Export is asking for those rows. The file carries the goal **in full** plus the error, which the table
truncates and omits: a file is opened to do what the screen cannot, and a truncated goal makes it useless
for exactly that. CSV is written to RFC 4180 with a BOM, and `web/src/lib/csv.ts` says why each of those
three details is not optional.

**An expansion with nothing in it says so.** Found by looking at the live page: a run with no steps, no
words and no summary opened a 25px stripe with not one letter in it, which reads as a broken control rather
than as "there was nothing to record". Runs from older builds kept no steps at all, so this is the ordinary
case and not an edge. The wording says only what is known — *nothing was recorded for this run* — not *the
run did nothing*, which is a claim about the machine that the log cannot support.

## Why a page

A run set itself a one-off every quarter hour and ran all night. The person watching asked the obvious
question — *how do I cancel this?* — and the honest answer was scattered across three places: the one-off
schedule was a row on **Skills → Runs by itself**; the queued work was visible only to `mouseflow_status`;
the history was the panel on the right of **Create**, and only while Create was open. None of the three
answered the question whole, and none had a button beside the thing being asked about.

## Three cards, shaped like the Skills page

The first version drew the history as a full-width table, and on a 1920-pixel screen a run's goal stretched
across most of it; the page read as a stranger's. It is now three cards of the same shape as the library and
*Ready to become a skill*: each in its own border, a gap between them, rows as the same rounded plates,
**a window and then a scrollbar** — the Skills page's gap (`gap-1.5`) with this page's own measured row
height (44 px; a single-line row here is shorter than a library row, and borrowing the library's 58.3 px
fitted eight rows into a window meant for seven). *Running now* and *Waiting* are seven rows tall;
**History is ten**, because its rows open.

The goal is capped at about seventy characters and truncated; the whole of it is in the tooltip and in the
expanded row.

**The window keeps its ceiling when a row opens.** It did not at first: an open row dropped the cap
(`maxHeight: open ? undefined`) so the detail would have room, and the whole of a thirty-day history —
eighty-five rows on the machine that found it — poured down the page, and the card stopped being a card.
The cap now holds always, the window is ten rows deep so the opened detail has somewhere to be, and opening
a row scrolls it into view with `block: 'nearest'` — the least movement that makes it visible, in the inner
scroller rather than the page.

**Filters are three independent axes**, not one segmented control: *status* (any / ok / ok · a check failed
/ could not finish / stopped by you / cancelled · never ran / set aside), *source* (you / schedule / chat /
extension) and *period* (24 hours / 7 days / 30 days / all), plus a search by name. "Failed" and "by itself"
are different questions, and one control forced a choice between them.

**Relaunch** sits on every finished row that has a goal. It goes through the same door as *Ask again* in the
Create page's history panel — the goal is placed in the Create composer and the person presses Run — rather
than queueing behind their back: a queue waits for a machine that may be asleep, and somebody who pressed
Relaunch is looking at the screen and wants to watch it go. The goal travels through `sessionStorage`, read
once and cleared, because a multi-line goal does not belong in a URL and a composer that still holds
yesterday's goal an hour later is a composer that fills itself in.

## Three sections, each of which collapses honestly

| Section | Holds | Action | When empty |
|---|---|---|---|
| **Running now** | the job a machine has claimed, with its last steps live | **Stop** | one line — and it says whether that is because nothing was asked or because *no agent is listening on this computer* |
| **Waiting** | queued jobs, and schedules whose next run is set | **Cancel** a queued job; **Cancel** a one-off schedule; **Pause** a repeating one | not drawn at all |
| **History** | every run, plus queue rows that never became a run | expand: steps, checks, kept frames | "Nothing has run yet." |

Repeating schedules are *paused* here, never removed: deleting a rule that lives on the Skills page from
another page with one button is too easy; the trash is where the rule lives.

## The history is the journal plus the queue

`user_run` holds what **happened**. A job cancelled before a machine took it, or one that failed at the fence
(*the skill was deleted between the ask and the run*), never became a run and is not in the journal — yet the
person asking *what became of my request from the chat* has to see it. So the page reads
`GET /api/mcp?live=1&days=30` and merges: a queue row whose id has a `user_run` (`client_id = run_queue.id`)
contributes only its source; a row without one stands for itself as *cancelled · never ran* or *could not
start*. Thirty days, because that is how long kept frames live and further back there is nothing to
diagnose with.

## The vocabulary

One file (`web/src/features/activity/status.ts`), and **two questions never share a chip**: *did the agent
finish* and *did the product pass*. A run can carry `ok` and, beside it, `1 check failed` — that is a found
bug, not a contradiction ([25 — Checks and tests](25-tests.md)).

| Chip | Means | Action |
|---|---|---|
| `running` | a machine has it now | Stop |
| `queued` | waits for a free machine — one mouse at a time | Cancel |
| `scheduled` | starts at a named time, if the machine is awake then | Cancel (one-off) · Pause (repeating) |
| `ok` | the agent finished what was asked | — |
| `ok` + `N checks failed` | finished, and the product did not do what it should | open the frame |
| `set aside → 10:47` | the goal named a later time and became a one-off schedule | — |
| `could not finish` | the agent gave up, with its reason — not a verdict on the product | — |
| `stopped by you` | a person pressed Stop part-way | — |
| `cancelled · never ran` | removed from the queue before it started | — |
| `could not start` | failed at the fence before any step | — |

Words, not state names: *could not finish*, never `failed`; *stopped by you*, never `stopped`. A person
reading the page at nine in the morning should not have to translate.

**Source** is a second axis and is never folded into the status: *you* · *schedule* · *chat* (MCP) ·
*extension*. The **By itself** filter is schedule + chat.

## One poll for the whole app

`web/src/lib/live.ts` asks `/api/mcp?live=1` every five seconds **while anything is listening**, and both
the page and the sidebar read the same answer — the sidebar's count beside *Activity* is running + queued,
never the history. Two polls would be twice the load on a route with one ceiling per account, and two
pictures that disagree for a second.

## A run started from Create is a queue row too

The first live test found the hole at once: a run started on the **Create** page, the green frame around
the screen, the agent acting — and Activity said *Nothing is running*, with nothing to cancel. The person
had to kill the agent from the tray. A run driven from the page goes past the cloud entirely (the model
through `/api/claude`, the actions over loopback), so it had never been a `run_queue` row, and Activity knows
only the queue.

So the page **announces** its run. `POST /api/mcp?live=start` puts a row in straight away as `claimed`
(`tool_name = 'page'`, `flow_id = '#page'`) — nothing for an agent to take, since a claim reads only
`queued`; `?live=step` sets the row's steps at most every three seconds so Activity shows them as they
happen, and its answer carries the row's state; `?live=end` closes it. **Stop** on Activity is the same
`?cancel=` as for any row, and the page hears it two ways — the state in the next `step` answer, and the
five-second poll it already runs — then stops the loop at the next action, exactly as its own Stop button
does. The same `dr_…` id names the queue row, the journal row, the kept frames and the skill made from the
run, computed once.

Two things fall out for free: a run from the page now makes the machine *busy*, so a schedule that comes
due while somebody is working yields its tick rather than fighting for the mouse; and `mouseflow_status` and
`mouseflow_stop` see it like any other work.

## Cancelling one thing

`POST /api/mcp?cancel=<jobId>` — the page's door, with a session cookie. `mouseflow_stop` cancels
*everything* and arrives with a token; a person on this page needs a button beside one row. Same SQL as the
stop, narrowed to an id: a queued job disappears; a claimed one stops at the next step the machine checks
(`?worker=state`). A foreign id and a missing one get the same answer — *nothing to cancel* — for the reason
every other route here does that.

## A fourth card: what MouseFlow has learned

Names of controls, the stable part of a title, where an unnamed press lands — accumulated per application
rather than re-discovered every run. **Applied only on the path that acts, never on the path that judges**:
a nightly regression proves something only because the case it checks did not change between being set and
being run, and memory touching a check or a verdict would make that proof worthless.

Four kinds of fact, shown differently because they are earned differently:

- **built in** — four platform facts (a Windows taskbar button toggles; a bare right-click release opens a
  context menu; a minimised window's rectangle is a placeholder; MouseFlow is its own front window when
  Record is pressed) that are code, not data, and are shown read-only for the same reason a constant is not
  an input field.
- **derived** — computed from recordings already on the account (the most-pressed named control per
  application, the part of a window's title that never changes), recomputed rather than stored stale.
- **taught** — a person's own correction, added and edited on this card. The form's refusal is the same
  rule that keeps a coordinate, a password field, a query string or an email address out of a recording in
  the first place — said back in words, not silently swallowed.
- **learned** — the model's own finding at the end of a run, held for a person to approve or reject before
  it is trusted. Not built yet: nothing here writes a `learned` fact, so none show up.

Nothing here is used yet: the block reaches a live turn only behind a flag, off until a measurement (steps
per successful run, before and after) says the extra reading is worth its tokens. Until then, this card is
truthful about doing nothing rather than pretending to.

## Where the reasoning is written

| | |
|---|---|
| `web/src/features/activity/ActivityView.tsx` | the three run-tracking sections and why each collapses the way it does |
| `web/src/features/activity/Memory.tsx` | the fourth card — the four kinds of fact, and why only `taught` has edit/delete |
| `web/src/features/activity/status.ts` | the vocabulary, and why two questions never share a chip |
| `web/src/lib/live.ts` | one poll, shared |
| `api/mcp.js` → `?live=1&days=`, `?cancel=` | the queue's history window, and cancelling one |
| `api/memory.js` | list/teach/forget, session-cookie scoped, redaction from `_memory.mjs` |
| `api/_memory.mjs`, `docs/MEMORY-PLAN.md` §4 | the module the form and the live turn both call into |
