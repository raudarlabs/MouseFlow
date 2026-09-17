# Where MouseFlow stands — 2026-09-17

A handover, written to be read on a machine that has never seen this project. It says what is true now,
what to do next, and what only the owner can supply.

**Live right now:** app `https://mouseflowapp.vercel.app` (commit `024a60a`), docs site
`https://mouse-flow.vercel.app`, agents at **0.29.0**. Whole suite green (`npm test`, zero FAIL),
`tsc --noEmit` clean, `web/` builds, `npm run build:extension` builds.

**Where the work is now.** The QA roadmap is closed (§3). The **memory of applications** is built and live
behind a flag that is now on (§2a). The current work is the **split into two products**, and it has its own
document — read it before doing anything to the product's shape.

**The five planning documents, and which to read when:**

| | |
|---|---|
| **this file** | where things are, what is next, and how to start on a new machine |
| [`SPLIT-PLAN.md`](SPLIT-PLAN.md) | **the current work.** Two products from one engine: what divides, what must not, and the sequence. Its §4.1 carries two corrections found while executing it — read those, they are the shape of the problem |
| [`QA-ROADMAP.md`](QA-ROADMAP.md) | the eight-item QA direction, closed. **Section 0 is the house rules — read it before touching anything** |
| [`MEMORY-PLAN.md`](MEMORY-PLAN.md) | skills as a tiered artifact, and the memory of applications (built — see its §4 progress notes). Also holds the shell/tooling notes section 0 of the roadmap lacks |
| [`SITE-DEBT.md`](SITE-DEBT.md) | what the public site owes the product. **Sites are deliberately untouched until the split lands** (owner, 2026-09-17) |

---

## 1. Starting on a new machine

Two repositories, both on `D:` by convention:

```bash
git clone https://github.com/Aborsen/MouseFlow.git     # the app  → poc/mouse-flow
git clone https://github.com/Aborsen/MouseLanding.git  # the site → D:/MouseLanding
```

**The app repo was renamed `Mouse` → `MouseFlow` at some point, and this checkout's remote still says the
old name.** It works only because GitHub 301-redirects a renamed repository; `git remote -v` on the machine
this was written from still prints `Aborsen/Mouse.git`, and so did the push output that produced the wrong
URL in the first draft of this file. Use `MouseFlow`. If you keep an old checkout,
`git remote set-url origin https://github.com/Aborsen/MouseFlow.git` stops it depending on a redirect.

**`MouseLanding` is private**, so cloning it needs credentials — a GitHub login in the credential manager,
or `gh auth login`. The app repo is public. (An unauthenticated API request for `MouseLanding` answers 404,
which is what a private repository looks like from outside; the repo is there.)

The site's working branch is **`codex/mouseflow-landing`**, not `main`. Then `npm install` in the app root,
in `web/`, and in the site.

### Three things the clone does not carry, and only the owner can

1. **`.env.local` in the app root.** Gitignored, holds `DATABASE_URL` and the rest of the Neon connection.
   Get it from the Vercel or Neon dashboard (or copy it from the old machine). Nothing works against real
   data without it: `npm run migrate -- --list`, the read-only probes, and the local MCP server all read it.
   **Never paste key values into a file that is tracked, and never into a chat.**
2. **The agent, installed and running.** Open the app → **Connect** and use the command it prints; it pipes
   the script straight into a scriptblock, so there is no file to unblock. The page shows the running
   version — it must say **0.29.0**, because the fixes from 9–11 September are agent-side, `clickname`
   among them.
3. **The Chrome extension — BUILT, then loaded unpacked.** This said "select the `extension/` folder",
   and that is the wrong folder: `extension/` is the source, and what Chrome loads is **`extension/dist`**
   — built by `npm run build:extension` in `web/`, gitignored, so a fresh clone does not have it at all.
   Load the source folder and you get the old hand-written popup, no side panel, and a manifest pointing at
   a `sidepanel.html` that only exists in the build.

   ```
   npm run build:extension        # from the repo root; writes extension/dist
   ```

   From the **root**, not from `web/` — the root script exists precisely so nobody has to `cd` first. And
   with no `&&`: the usual shell here is Windows PowerShell 5.1, where `&&` is a parse error, not a
   separator. If you do want two commands, PowerShell joins them with `;`.

   Then `chrome://extensions` → developer mode → **Load unpacked** → select **`extension/dist`**. Its id is
   derived from the folder path, so it differs on every machine; that is expected and the app handles it.
   Rebuild after any change to the extension — Chrome loads the build, not the source.

### Verify the machine before starting work

```bash
npm test
```

Expect zero FAIL. `check-swift` prints `0 passed, 0 failed` — that is correct on Windows, `swiftc` does not
exist there; on a Mac it compiles the Swift agent for real, and `check-csharp` is the text proxy in the
other direction. Then `npx tsc --noEmit -p web/tsconfig.json`, `npm run build` in `web/`, and
`npm run build:extension` from the root.

**Do not count the checks against a number written in a document** — every suite prints its own total, the
`npm test` line you see last belongs to `mcp/test-mcp.mjs` alone, and a remembered grand total is the kind
of fact that rots quietly. Zero FAIL is the condition.

Read [`MEMORY-PLAN.md`](MEMORY-PLAN.md) §0 next: it holds the shell quirks (the Bash tool needs its `PATH`
set on every call; heredocs with backticks break; how to compile the agent's C# for real) that cost time
before they were written down. Then [`SPLIT-PLAN.md`](SPLIT-PLAN.md) §0 and §9 — that is the work in
progress, and §4.1 is where it currently stands.

**The database is live on this account and both recent migrations are applied** (022, 023). A machine with
`.env.local` can read it; `npm run migrate -- --list` should show 23 files, all `applied`. **`MEMORY_LIVE`
is `true`** (`api/_memory.mjs`), so the memory block reaches a live turn on the browser-driven path — one
`taught` fact exists on the owner's account, and nothing about it has been measured yet.

---

## 2. What shipped on 9–11 September

Twenty commits over three days. Eight closed roadmap items; the rest were defects found by *playing recordings back on a real
desktop*, which is the pattern worth keeping — none of them were visible from reading the code.

| commit | what |
|---|---|
| `bcdb9ae` | **Roadmap item 8**: web QA through the extension — `dom`-tier checks, frames, cases Chrome can claim |
| `58e10c6` | **Roadmap item 3**: a recorded click carries its window and element rectangles, and a replay puts the point back inside the window before the agent aims by name |
| `71d1246` | A replay raises the window the **clicks** name, not the sampler's first (which is always MouseFlow); the press that stopped a recording is no longer in it |
| `e240a3d` | "Nothing was captured" is decided by what can be **played**, not by list length — a real recording came back holding one `Focus` note |
| `10c02ff` | The stop trim finds the press or removes **nothing** — the first version stripped trailing movement unconditionally and would have cut 12 of 27 events from a chat-stopped recording |
| `28a20b6` | A **minimised** window is the one to raise; a window that is not open raises nothing and says so |
| `8cb0819` | A `Focus` note written *after* the stop press no longer hides it — this was why the stop was still in the recording after two fixes |
| `339790d` | A taskbar press replays as "show that window"; a replay's finish releases only the buttons it **held** (a bare right-button release was opening a context menu at the end of every replay) |
| `53fb0a4` | [`MEMORY-PLAN.md`](MEMORY-PLAN.md) |
| `4e9f017` | **Roadmap item 5-v2**: a case's check can name the moment it belongs to |
| `6711318` | **Roadmap item 6, lever 1**: the turn's unchanging prefix is cached; two of the item's five levers dropped on measurement |
| `86aed7e` | **Roadmap item 6, lever 2**: `click_named` — one action where "find the button, then click it" was two turns. Agents at 0.28.0 |
| `0600b31` | …and it may go **second** in a turn, so "type the value, then click Save" is one turn too. The batch rule's one pressing exception |
| `045a4f4` | **`mouseflow.skill/2`**, tiers 0 and 1: a skill carries a **procedure in words**, so it can say what it does instead of only being able to do it |
| `c6b4ba1` | **A web recording no longer dies with the worker holding it** — the reported fault, reproduced and fixed |
| `da714b4` | **Roadmap item 7, part 1**: the agent can demand a pairing key; only `/health` answers without it. Agents at 0.29.0 |
| `ae315ca` | **Roadmap item 7, parts 2–3**: a case can name the machine it belongs to, and the QA-machine recipe |
| `e807605` | **The built extension had an import into nothing, and had since item 8** — plus the closure check that will not let it happen again |
| `741985c` | The build command in this file was written for the wrong shell |

### The two things worth carrying forward from that work

**Replaying recorded coordinates is a losing game, and the evidence is four fixes in one day.** Every one
was correct and every one uncovered the next: which window to raise, minimised windows, the taskbar toggle,
the button release. A recorded point is a claim about a screen that no longer exists, and the list of "what
the click actually meant" has no end. **Decision: coordinate replay is frozen, not deleted** — it keeps
working, it keeps its docs page, it stops being invested in and comes off the headline.

**A turn costs the same whatever it does.** Measured over ninety days: median model decision **5,035 ms**,
and it barely moves between actions (`click` 5,238 · `press_key` 5,848 · `type_text` 5,504). The screenshot
is **196 ms**. So the cost is the unchanging prefix re-sent every turn, and the only two levers worth pulling
were caching it and **removing whole turns** — both now done, and everything that chased the 196 ms was
dropped instead of built. The general form of the lesson, which outlives this item: **measure before
optimising, and be willing to delete a planned task on the measurement.** Two of five levers here were
worth more struck than shipped.

---

## 2a. What shipped on 11–17 September — the memory of applications, and the split's first repairs

Ten commits, `d091ddc … 024a60a`. The memory plan's §5 rows 2–5 are done; the split has begun.

| commit | what |
|---|---|
| `d091ddc` | **Memory row 2**: `api/_memory.mjs` — keys, redaction, budget/eviction, the four `builtin` lines. Pure, no DB, no caller yet |
| `a065585` | **Row 3**: `derived` over recordings (`api/_memory-derive.mjs`). Run once against the owner's real 61 recordings and it **found a real redaction gap**: one event's `context.control` held an email address — an accessibility tree sometimes hands back typed content as "the name". §4.5 of the memory plan predicted exactly this. `redactionProblem` now refuses an email in `body` or `name` |
| `7ff19ba` | **Row 4**: `screenMessage()` takes a fifth argument; both drivers call one `memoryForOpen`, so neither writes its own flag check. Pins: the words live in the brain; `_case.mjs`/`_expect.mjs` never import the memory module (§4.8 — memory acts, never judges) |
| `d12b9f9` | **Row 5**: `db/023_app_memory.sql`, `api/memory.js` (list/teach/forget), and the fourth Activity card, *What MouseFlow has learned* |
| `dc05bc2` | **Migrations 022 and 023 applied**, by the owner's word. `npm run migrate -- --list` shows all 23 `applied` |
| `caac044` | `MEMORY_LIVE = true`, and the web driver actually reads `app_memory` — once per run, before the wave loop |
| `9bdc923` | **`web:<origin>` memory reaches a run, through the extension.** The desktop agent sees a browser *window*, never the address inside it; only the extension can. `fitBlock`/`webKeyFor` moved to `extension/memory.js`, re-exported by `api/_memory.mjs` — the `checksOf` pattern |
| `5255f56` | [`SPLIT-PLAN.md`](SPLIT-PLAN.md) — written from the code, not from the pitch |
| `b436d71` | Split step 0, and the first correction: step 1 rested on a false premise |
| `024a60a` | Split step 1a: a written skill carries a procedure too |

**One fact was taught and is live**, so the memory is not an empty feature: `web:outlook.office.com` →
*"The stable part of the title is the trailing " - Outlook"…"*, verified end to end over real HTTP against
the deployment. **Nothing is measured yet** — §4.13 of the memory plan wants turns-per-successful-run
before and after, and one row is not a measurement.

**The two things worth carrying forward from that work**

**A plan can be wrong in a way only execution finds, twice in a row.** Both of the split's first corrections
came from starting the work, not from reading: `procedure` turned out to live only on the kind of skill a
case refuses, and then `procedureFrom` turned out to read extension events while created skills come from
desktop recordings. Both are written into [`SPLIT-PLAN.md`](SPLIT-PLAN.md) §4.1 rather than quietly worked
around. Keep doing that — the document is worth more than the tidy story.

**A pin asserting yesterday's truth is a pin somebody will silence.** `db/022`'s header still said "НЕ
ПРИМЕНЕНА" six days after it was applied, and a pin asserted that word. The pin moved with the fact — to
assert that the status is *stated at all*, which is what it was really guarding — and was proven by mutation
in both directions.

## 3. The QA roadmap now

| item | state |
|---|---|
| 1 · `expect` | done |
| 2 · artifacts (kept frames) | done |
| 3 · anchored recording | done (`58e10c6`) |
| 4 · hybrid replay | **parked.** It was the bridge between coordinates and the model; with replay frozen the bridge is not needed. [`MEMORY-PLAN.md`](MEMORY-PLAN.md) proposes an application memory instead. **Not struck — the owner's call** |
| 5-v1 · a case as an entity | done |
| 5-v2 · checks bound to a step | done (`4e9f017`), **not as specified** — see below |
| 6 · speed | levers 1 and 2 done; **3 and 5 dropped on measurement**; only lever 4 is left, and it is small. The item's done-condition is a *measurement* — re-run it in October, see below |
| 7 · isolation | **done.** Loopback key in both agents (off by default, on with -RequireKey), a case pinned to a machine, and the QA-machine recipe. Three of the item's own premises were wrong and are corrected in it |
| 8 · web QA via the extension | done (`bcdb9ae`) |

**Three places the roadmap was wrong, now corrected in it:**

- **5-v2 could not be built as written.** It said `expects[i].after` would be a checkpoint *title* "bound to
  the plan's checkpoints". Checkpoints reach the browser driver as a parameter from the Create wizard; a
  **saved skill carries none**, and the unattended cloud driver is handed `toolsFor(false, …)` — no
  `reached_checkpoint` at all, because a checkpoint stops the run until a person answers and on that path
  there is nobody. A number would have pointed at nothing. So the moment is a **sentence** the case's author
  writes, and whoever sees the screen decides when it has come.
- **Item 6's premise was a guessed number.** "~8 s a step" was never measured; it is 5,035 ms. And two of
  its five levers chase the 196 ms screenshot — under 4 % of a turn — so they were dropped rather than done.
- **The next free migration number** was recorded as 019. It is **022**.

---

## 4. What to do next

**The QA roadmap has nothing open left.** Items 1, 2, 3, 5, 6, 7 and 8 are done; 4 is parked as superseded.
Two small things remain *of that plan*, and neither blocks anything:

- **Item 6, lever 4** — `claude-haiku-4-5-20251001` for the wave hand-off and the plan preview. Small, and
  last on purpose: a cheaper model must not be anywhere near a decision that aims a click.
- **The October measurement.** Item 6's done-condition is the median `model` ms under 4,000, and it cannot
  be read yet — the thirty-day window still holds mostly runs decided before prompt caching and before
  `click_named`. Re-run the query in [`QA-ROADMAP.md`](QA-ROADMAP.md) §6 in October, and read **two**
  numbers: the median (where caching shows) and **steps per successful run** (where `click_named` shows).

### The real queue, in order — all of it now lives in [`SPLIT-PLAN.md`](SPLIT-PLAN.md) §9

**Pick it up at step 1b.** The sequence there is numbered and each row carries its own done-condition;
what follows is only the shape of it, so a fresh session knows where it is standing.

1. **Step 1b — the case flow fills `verification`.** Step 1a gave a written skill a procedure, so the field
   finally has somewhere to live on the kind of skill a case accepts. Nothing writes it yet.
   `extension/procedure.js` names the writer it expects, in its own words: *"the field exists to be FILLED —
   by the author, or by the case flow, in the `expects` shape from `api/_case.mjs`"*. So: seed a case's
   checks from the skill when the caller passed none, and write the case's checks back onto the skill, so
   the next case — and anyone who installs it from the gallery — starts from them.
2. **Steps 2 and 3 — the two files that answer for both products.** `api/mcp.js` is 2 628 lines holding
   product 2's tool catalogue *and* product 1's whole worker protocol; `api/insights.js` computes both
   "what the person did" and "how the agent performed" in one transaction. Both are pure refactors, both
   are prerequisites for everything after, and neither needs a decision.
3. **Steps 4–8 — the split proper**: the product axis, cutting Skills and the Dashboard in half, restoring
   `/docs` and `/chat`, and serving each product its own subset of MCP tools.
4. **Steps 9–12** — a `--record-only` agent, dictation outside the app, the spend partition, the docs set.

**Two things the owner asked for on 2026-09-17, both planned and neither started:** dictation through
OpenAI rather than the browser's own recogniser ([`SPLIT-PLAN.md`](SPLIT-PLAN.md) §7 — and note what it
reverses), and speaking into a phone while the computer works (§7.1 — this needs no new architecture; a
phone is one more thing that inserts a queue row).

**Two things now parked, not forgotten:** `mouseflow.skill/2` **tier 2** (the recording as a pointer rather
than a copy — [`MEMORY-PLAN.md`](MEMORY-PLAN.md) §3 holds the hazard: `mouseflow_run` answers `body: null,
goal: false` the moment a `/2` skill stops carrying events, and must refuse **with words** instead), and
**the site pass** ([`SITE-DEBT.md`](SITE-DEBT.md)), which the owner deferred until the split has landed.

### The extension is being narrowed, not grown

**Owner's decision, 2026-09-11: the extension is a tool for recording skills, not a second application.**
Part of it will be cut. Do not add screens to it. Two consequences for whoever picks this up:

- The **side panel** is the right surface for what remains, and it already exists — a popup closes the
  moment you click the page, and recording a flow *is* clicking the page. It needed no work, only a build.
- The recording path is the part that survives the cut, which is why `c6b4ba1` was worth doing properly
  rather than patching.

## 5. Open questions that need the owner, not code

1. **Is roadmap item 4 struck?** Everything above assumes it is superseded. Say so and it comes out of the
   roadmap; say no and it goes back in the queue.
2. **Which of the two products leads?** It decides whose vocabulary gets the site's front page — and the
   answer shapes the site pass in [`SITE-DEBT.md`](SITE-DEBT.md) §2. **Seven more questions the split
   itself raises are in [`SPLIT-PLAN.md`](SPLIT-PLAN.md) §11**, and one of them — §11.8, which side of the
   `verification` wall moves — was answered on 2026-09-17 and is half-built; the rest are open.
3. **The name.** `MouseFlow` describes the mechanism rather than the outcome, and there is an established
   product called Mouseflow (mouseflow.com, behaviour analytics — worth verifying) whose adjacency is a real
   collision for the documentation product. Cheap to change now, expensive later.
4. **The web memory key — half answered by building it, on 2026-09-11.** `web:<origin>` for the page is
   live: the extension reads it (`extension/memory.js`, `notesFor` in `background.js`), because it is the
   only part of MouseFlow that ever sees the address inside a browser window — a desktop agent sees the
   window, never the URL. `win32:chrome` for the browser shell itself was **not** built — nothing yet asks
   for a fact about the shell rather than the page, so there was nothing to wire it to. Still open if that
   tier is wanted.
5. **Both `db/022_queue_machine.sql` and `db/023_app_memory.sql` were applied on 2026-09-11**, from a Mac
   session that had `.env.local` — `npm run migrate` ran both in one pass (022 had never run either, on
   any machine), `npm run migrate -- --list` confirms all 23 as `applied`. Pinning a case to a machine and
   `app_memory` are both live now; nothing further needed here.

   **The memory plan's own migration was renumbered 022 → `023_app_memory.sql`** because item 7 took 022.
   Never reuse a number: `migrate.mjs` walks the files in name order and records what it ran by name, so
   two files sharing one means the second silently never runs.
6. **`.mmmacro` compatibility** — asked and **answered on 2026-09-11: leave it alone for now**, and revisit
   it with the site pass rather than as an engineering cleanup. The analysis is in
   [`SITE-DEBT.md`](SITE-DEBT.md)'s neighbourhood: storage is already JSON, there is exactly one parser, and
   the five-column wire earns its keep. Two findings from it are still open — `exportMacro` silently drops
   `role`, `subrole`, `in`, `inName`, `url`, `side` and `near` that `flowBody` sends, so an
   export→import round trip is lossy today; and the growing `#ctx` sidecar, not Mini Mouse Macro, is the
   actual design smell.

---

## 6. Conventions that will bite a fresh session

All of these are load-bearing here, and all were learned the hard way:

- **Push when green, without being asked.** Green means `npm test` with zero FAIL, `tsc --noEmit` clean,
  `npm run build` in `web/` ok. Then wait for the deploy — `/build.json` shows the commit — and tell the
  owner **one concrete thing to check**. Not green: do not push, and say what failed.
- **A pin that was never seen failing is not a pin.** Break the rule it guards, watch it FAIL, restore.
  Every pin added on 9–10 September was proven this way.
- **No false greens.** Success is *claimed* and, where possible, checked. `blocked` is never collapsed into
  `fail`; absence is never rendered as a negative fact.
- **One implementation, many readers.** When a rule is added, it is added once and imported — the brain is
  shared by two drivers, `_case.mjs` by three readers.
- **A step's name is `step.tool || step.name`.** The extension writes one, both desktop drivers write the
  other. Reading a single field silently returns zero on web runs; that was a real defect, fixed in
  `4e9f017`.
- **Commits here and in MouseLanding are authored as `raudar.aborsen@gmail.com`.**
- **The shell here is Windows PowerShell 5.1, and `&&` is a parse error in it** — not a chain. Join with
  `;`, or use two lines. This cost a round trip on 2026-09-11 because a command in this very file was
  written in bash. Where a root-level npm script exists, use it rather than `cd`-ing: `build:extension`
  exists at the root precisely so nobody has to.
- **Chrome loads `extension/dist`, never `extension/`.** The source folder is the hand-written half plus a
  legacy popup; the panel and the bundled UI only exist after `npm run build:extension`. `extension/dist`
  is gitignored, so a fresh clone has none of it. **Rebuild after every extension change** — Chrome is
  running the build, not the files you edited.
- **The extension build copies its hand-written half BY NAME** (`COPY` in `web/vite.extension.config.ts`).
  A new file that an already-copied file imports is otherwise shipped nowhere, and it fails in Chrome at
  module load rather than at build time — which had been true of `checks.js` since roadmap item 8 shipped,
  meaning the built worker did not start at all. A closure check in `extension/check-extension.mjs` now
  fails `npm test` if any copied file imports something the build would leave out. Add the name when you
  add the file.
- **Read Swift edits twice; compile the C# for real.** `swiftc` does not exist on Windows, so the macOS
  agent is guarded by text pins only — a second read found a genuine compile error on 2026-09-11
  (a top-level `var` used above its declaration, which `main.swift` refuses). The Windows agent's C# *can*
  be compiled, and should be for any non-trivial edit — see [`MEMORY-PLAN.md`](MEMORY-PLAN.md) §0.
- **A pin that passes with and without the fix is not a pin.** One was written on 2026-09-11 to guard a
  race the harness cannot reproduce (the old module instance never dies, so the message goes to the old
  worker either way). It was **removed and replaced by a source pin that says why**, rather than left green
  for appearance. Two others were caught matching their own explanatory comments — check code, not prose
  about code.
