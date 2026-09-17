# Two products, one engine — the split, in enough detail to be executed

Written 2026-09-17 from the code at `9bdc923`, for whoever picks this up next in a fresh session. Read
[`STATUS.md`](STATUS.md) for where things stand and [`QA-ROADMAP.md`](QA-ROADMAP.md) §0 for how to work in
this repository before touching anything.

**The sites are deliberately out of scope.** The owner's instruction, 2026-09-17: split the functionality
first, make the landing for the finished product afterwards. Nothing in this plan touches `MouseLanding`,
and [`SITE-DEBT.md`](SITE-DEBT.md) §2's "which product leads the front page" stays open until the split has
actually happened. Anything here that would change the public site is named and deferred.

---

## 0. The thesis, and the one correction to the owner's framing

**The two products do not divide the code. They divide the direction of the arrow.**

- **The machine acts, the person watches.** Injection, a queue, evidence, verdicts, a live loop.
- **The person acts, the machine watches.** Recording, naming, transcripts, digests, and an artifact other
  agents can call.

Everything that merely **sees** — a screenshot, a window list, an element read — is needed by both, and that
is why one agent, one extension and one artifact serve both. This is the sentence to come back to whenever a
split decision is unclear: *which direction is the arrow pointing in this feature?*

**The correction, and it matters for scope.** The owner's framing on 2026-09-17 was "product 1 = an assistant
that does things for you **+ QA**". That is right, and it is a change from
[`MEMORY-PLAN.md`](MEMORY-PLAN.md) §2, which framed the pair as *documentation* versus *QA*. QA is not a
third product and not a sibling of the assistant: **a check is what makes an action trustworthy**. "Send the
invoice" and "send the invoice and prove the invoice went" are one goal loop with an assertion on the end —
they share `_brain.mjs`, `run_queue`, the drivers and the agent. Splitting QA away from the assistant would
mean two copies of the decision loop, which is the one thing this codebase has never allowed itself (one
implementation, many readers — QA-ROADMAP §0, principle 3).

So, the two products, with working names to argue about later (§11):

| | **Product 1 — *Do it for me*** | **Product 2 — *Make it reusable*** |
|---|---|---|
| What the person buys | A machine that carries out work they describe, and proves it still works tomorrow | A way to turn what they already do into tools other agents can call, documents people can read, and numbers they can act on |
| Direction | The machine acts | The person acts |
| Входная точка | A goal, typed or dictated | A recording |
| Core screens | Create, Activity, Tests, Connect | Record, Library, Documents, Dashboard |
| Proof it worked | `expect` checks, verdicts, kept frames | A procedure somebody can read and correct |
| Needs a real mouse | Yes | No — it only needs to watch one |

### Three levels of "split", and which one this plan does

1. **One app, two workspaces.** One deployment, one sidebar that shows one product at a time, two onboarding
   paths, two MCP tool profiles. *This is what this plan does.*
2. **Two builds, two domains, one repo.** A second Vite entry and a second Vercel project, sharing `api/`.
   Precedent exists: `web/vite.extension.config.ts` already builds a second target from this codebase, and
   `vercel.json` is nine lines of rewrites. *This plan cuts the seams so that this is a config change, not a
   refactor — but does not do it.*

   **Half of it arrived with step 4, at the owner's request (2026-09-18): two builds, one repo, no second
   domain.** `VITE_PRODUCT=do|make` builds an app with the other half absent — its own menu, no switcher,
   the root landing on its own home — into `web/dist-do` and `web/dist-make`:

   ```bash
   cd web && npm run build:halves   # both, into dist-do and dist-make
   cd web && npm run dev:halves     # both live on 4410 and 4411, with the mock API, to look at side by side
   ```

   Two separate processes, deliberately: `VITE_PRODUCT` is read when the config module loads and the config
   is cached, so building both in one process would make the second half a copy of the first under a
   different name. What this is **not** yet: two bundles each carrying only its own code. Both still ship
   every screen — the lock is a runtime branch — and that is the `api/` and screen split of steps 5–8, not
   a build flag. It is enough to *look at* the two products, which is what it was asked for.
3. **Two repos, two agents, two extensions.** *Never.* §10 says why.

---

## 1. The engine that is not split, and what breaks if it is

| Piece | Why it cannot be divided |
|---|---|
| `run_queue` + the worker protocol (`?worker=claim\|step\|report\|state\|crash`) | The direction of the connection never reverses — nothing ever reaches into anybody's machine (`db/007_run_queue.sql:9-12`). Both products need the machine to ask; a second queue would be a second answer to "is the machine awake". |
| `api/_brain.mjs` + `api/_step.mjs` + `web/src/lib/desktop-engine.ts` | One decision loop, already read by two drivers. Words for the model live in the brain precisely so two readers cannot teach the model two habits. |
| The desktop agent | One install, one pairing, one set of TCC grants. §6 covers the one honest flag it should gain. |
| The Chrome extension | One unpacked load. `extension/content.js` (1 773 lines) holds recording *and* acting *and* seeing in one script — see §6. |
| `mouseflow.skill/2` | The artifact that makes the two products one product underneath: `procedure.steps` read as documentation, `procedure.verification` run as checks. §4.1 is about the half of this that is not real yet. |
| `user_flow`, `user_run` | The spine. P1 writes runs, P2's analytics and chat read them. |
| Auth, teams, device tokens, OAuth, `api/sync.js` | One account, one pairing, one invitation. |

---

## 2. The map — every surface, and which product owns it

### 2.1 Screens (`web/src/features/*`, routes in `web/src/main.tsx`)

| Screen | Route | Product | Note |
|---|---|---|---|
| Create | `/create` | **P1** | The goal loop, both executors, dictation already lives here |
| Logs | `/logs` | **P1** | Running / waiting / the log as a table, plus the memory ledger. Renamed from Activity 2026-09-18; `/activity` redirects |
| Tests | `/tests` | **P1** | A case is "is this still true?" |
| Connect | `/connect` | **P1** | Exists so a machine can be acted on |
| Record | `/record` | **P2** | Capture, transcript, the recordings table |
| Documents | `/docs/$docId` | **P2** | Currently only reachable through the Gallery's second shelf |
| Dashboard | `/dashboard` | **split** | See §5.2 — one route answers both products' questions |
| Skills | `/skills` | **torn in half** | See §5.1 — the single most divided screen in the app |
| Gallery | `/gallery` | **split** | Published flows install to be *run* (P1's distribution); the Documents shelf is P2's |
| Chat (assistant) | *(embedded in Dashboard)* | **P2** | "Ask about your own work"; was its own route until recently |
| MCP page | `/mcp` | **P2** | Public reference for connecting an agent |
| Teams, account, admin | `/team`, settings | **shared** | Org plumbing |

**Step 4 landed this table in code, 2026-09-18.** `web/src/lib/product.ts` now holds it — address, label,
title, owner, whether it is in the nav, and what the first-run tour says about it — and the sidebar, the
header and the tour all read it. Before that the set of screens was written down **four** times and never
once completely: the routes in `main.tsx` (addresses only), `NAV` in `AppSidebar`, `TITLES` in `AppLayout`,
`STEPS` in `OnboardingTour`. They had already drifted — `/docs` spent one day in the nav, its title stayed
behind, its tour step never existed — and the product was in none of them, because there was nowhere to
write it.

Two rules came out of building it, and neither was in the paragraph above:

- **The address beats the choice.** A screen that belongs to one product names it and the shell obeys;
  the stored preference decides only the rest. Otherwise there is a state called "I am in *Make it
  reusable* and looking at Tests", and repairing it needs a second rule. Opening a shared link to `/tests`
  shows that product's menu, and no drift is possible.
- **`'both'` is not indecision.** It is a screen that genuinely answers both questions and is cut by its own
  step — Skills (§5.1), Dashboard (§5.2), Gallery (§5.3). Until then it stands whole in both menus, which is
  honester than hiding half of it from whoever needs that half.

Menu order per product is today's order with the other half removed, not a new order invented at the same
time: somebody who opens the app after the change finds the same things in the same places, fewer of them.

**The owner trimmed P1 on 2026-09-18, and three of the table's rows are settled by it:**

- **The Gallery is P2's** — that is §11.2 answered. Both shelves are "what is already made and can I take
  it", which is a workshop question.
- **The Dashboard is P2's, whole.** §5.2 was going to cut it in half; the half about runs is not needed in a
  product about proving things work, because Logs answers the same question with the evidence attached. Step
  3's `?half=` is what makes that a move rather than a rewrite.
- **Teams leaves P1 "for now".** Worth writing down what that costs: in a build locked to P1 the team page
  becomes unreachable, because it left the settings dialog when it became a place.

**And P1 offers one executor, the local agent** (`PRODUCTS.do.runsIn`). The extension and the agent make
different promises, and choosing between them is not a question to put in front of somebody whose goal is
"prove the invoicing still works". This is narrower than §6.2, which splits `extension/content.js`: nothing
was removed from the extension, it is simply not offered as an executor on P1's Create.

### 2.2 Routes (`api/*.js`)

- **P1:** `claude.js` (the extension's model proxy), `artifacts.js` (evidence frames), `cases.js`, `memory.js`.
- **P2:** `chat.js`, `chats.js`, `transcript.js`, `docs.js`, `gallery.js`, `skill-md.js`, `compose.js`, `params.js`.
- **Both / infrastructure:** `sync.js`, `mcp.js` (see §4.2), `schedules.js`, `insights.js` (see §4.3),
  `team.js`, `account.js`, `auth.js`, `oauth.js`, `well-known.js`, `admin.js`, `models.js`.

### 2.3 MCP tools — 18 today, built as one literal array at `api/mcp.js:2593-2608`

| Product | Tools |
|---|---|
| **P1 (7)** | `mouseflow_run`, `mouseflow_do`, `mouseflow_stop`, `mouseflow_run_status`, `mouseflow_case`, `mouseflow_cases`, `mouseflow_case_results` |
| **P2 (7)** | `mouseflow_recordings`, `mouseflow_transcript`, `mouseflow_activity`, `mouseflow_run_history`, `mouseflow_help`, `mouseflow_start_recording`, `mouseflow_stop_recording` |
| **Both (4)** | `mouseflow_schedule`, `mouseflow_schedules`, `mouseflow_unschedule`, `mouseflow_status` |

Two facts that decide §4.2: the **list** is one array (subsetting is a one-line change), but `callTool`
(~900 lines) and the whole worker protocol sit in the same 2 628-line module, so a product-specific
*deployment* would still ship the entire execution engine. Separately, `mcp/server.mjs` (stdio) already does
the thing P2 is *for*: it appends **one MCP tool per skill**, so a person's own flows become callable tools.
That is P2's product, already shipped, and nobody has called it that yet.

### 2.4 Tables

- **P1:** `run_queue` (+`machine`), `user_case`, `run_artifact`, `app_memory`, `user_run.checks`.
- **P2:** `gallery_skill`, `flow_digest`, `flow_text`, `user_doc`, `user_doc_version`, `chat_thread`, `chat_message`.
- **Shared:** `user_flow`, `user_run`, `user_schedule`, `device_token`, `oauth_*`, `team*`, `user_pref`,
  `app_setting`, `model_call`.

### 2.5 The agent's endpoints and flags

| | P1 | P2 | Both |
|---|---|---|---|
| Endpoints | `/replay`, `/replay/status`, `/replay/abort`; the acting half of `/do` (`click`, `move`, `scroll`, `type`, `key`, `drag`, `clickname`, `activate`, `open`, `clipwrite`) | `/record/start`, `/record/status`, `/record/drain`, `/record/stop` | `/health`, `/shot`, `/pulse`, `/windows`; the seeing half of `/do` (`capture`, `read`, `find`, `clipread`, `waitwindow`, `scrollto`) |
| Capability flags | `canAnchor`, `canClickName` | `canName`, `canKeys`, `canDrain` | `canSee`, `canWindows`, `canAuth`, `linked`/`taking` |

### 2.6 Documentation (27 pages under `docs/product/`)

P1: 05 Create, 24 Schedules, 25 Checks, 26 Activity, 27 Cases, 09 Connections, 11–12 the agents.
P2: 04 Record, 06 Skills, 07 Gallery, 08 Dashboard, 16 Transcript, 21 MCP, 23 Documents.
Shared: 01–03, 10, 13–15, 17–20, 22.

---

## 3. What the split is actually made of

Not a rewrite. Four kinds of work, in this order of dependency:

1. **Three prerequisite repairs** (§4) — things that are half-built *today* and would become lies once the
   products are named separately.
2. **Cutting the torn screens** (§5).
3. **Giving each product its own front door** — navigation, onboarding, MCP profile, install story (§6–7).
4. **Partitioning what is measured and charged** (§8).

---

## 4. Three repairs that must happen BEFORE anything is named a separate product

### 4.1 `procedure.verification` has no reader — the bridge between the products is half a bridge

`extension/procedure.js:192-204` writes `verification: []` and explains that inventing a check would be
dishonest. `extension/skills.js:352-406` **transports** the field and says out loud that it does not judge
it. `docs/product/06-skills.md` and `extension/procedure.js:11` both claim the artifact "serves both
products — `steps` read as documentation, `verification` runs as checks".

**Nothing reads it.** Verified by grep: the only judge is `readExpects` (`api/_case.mjs:65-120`), and a case
carries its **own** `expects` from `user_case`. A `/2` skill's `verification` reaches no runtime reader at
all.

This is load-bearing: the entire "one engine, two products" story rests on one artifact serving both, and
today the QA half of that artifact is a field nothing consumes. **Fix before the split, not after** — once
the products are separately named and separately sold, the gap becomes a promise nobody kept.

*Done when:* a `/2` skill whose `procedure.verification` names a check produces a case whose verdict comes
from that field, through `readExpects`, with no second definition of what a check is. Proven by execution in
`api/_test-skills.mjs` + `api/_test-case.mjs`, mutation-proven as everything else here.

#### Correction, found on 2026-09-17 while starting this very step — it is worse than "nothing reads it"

The two halves are not merely unconnected. **They are on opposite sides of a wall, and no reader can be
wired between them as written above.**

| | Carries `procedure` | Can a case be built on it? |
|---|---|---|
| `kind: 'recorded'` — `skillFromRecording`, `extension/skills.js:186-203` | **yes** (`verification` always `[]` at derivation) | **no** — `api/cases.js` `skillFor` refuses it: *"that skill is a recording - it is replayed, not decided, so nothing in it can check anything"* |
| `kind: 'created'` — `saveAsGoalSkill` / `saveDictatedAsGoalSkill`, `web/src/features/record/save-as-skill.ts:102,177` | **no** — it carries `goalTemplate`, `success`, `params`, `steps`, `fromRecording`/`fromRun` | yes, and it is the only kind that can |

So the only skills that *can* carry `procedure.verification` are exactly the skills a case *refuses*, and the
only skills a case accepts have no `procedure` at all. Wiring a reader would have produced dead code that
looked like a bridge. **One of the two ends has to move first — which is a product decision, not a
refactor.**

What a `created` skill does carry is `success` — "Признак готовности. **Проверяется, а не исполняется**"
(`save-as-skill.ts:113-118`), kept deliberately apart from `goalTemplate` so the model checks the condition
instead of performing it. That is verification in prose: the same idea as `procedure.verification`, one tier
less structured, on the other side of the wall.

**Three ways to close it, for the owner to choose (§11.8):**

- **A — give `created` skills a procedure too.** Derive it server-side from `fromRecording` when the wizard
  saves (the wizard itself cannot: `GoalSkillSource` is deliberately four fields and holds no events —
  *"fabricating an empty `events` array … would be a lie the next reader has to disprove"*). Honest, and it
  makes one artifact genuinely serve both products. Costs a derivation path on the server.
- **B — treat `success` as the seed.** When a case is built on a created skill and no checks were given,
  show that sentence and ask the person to turn it into checks. Smallest change, keeps a person in the loop,
  but turning prose into structured checks either falls to them or needs a model call (`api/compose.js` is
  the precedent).
- **C — let the wizard ask for checks directly** and write them into `procedure.verification` on the
  created skill. The wizard already collects a name, a goal, params, steps and `success`; one more field is
  cheap, and it puts the checks where the artifact claims they live. Costs one more question at the moment
  somebody is already answering five.

Until one is chosen, **step 1 is blocked and the rest of the sequence is not** — steps 0, 2 and 3 need no
decision, and steps 4–8 do not depend on this repair landing first. The claim in the documentation
(`extension/procedure.js:11`, `docs/product/06-skills.md`) should be softened the day a choice is made, and
not before: it describes the intent correctly and the code will follow it.

#### A was chosen (owner, 2026-09-17) — and A turned out to be a mapping, not a derivation

Implementing it found the second wall immediately: **`procedureFrom` cannot be pointed at a created skill's
recording.** It reads *extension* events — `click`, `blank`, `navigate`, `tag`, `selector`, `field` — and a
created skill is made by the wizard from a **desktop** recording, whose events are `.mmmacro` five-column
lines with `press`/`release`/`move`. Running one through the other yields "Press. Release. Move." — the log
this whole file exists to replace.

And nothing needed deriving, because **the sentences already existed**. The wizard shows the transcript's
lines (`api/_transcript.js`), the person ticks the ones to keep, and they are stored as
`payload.steps = { name, input }[]` where `name` is the transcript's `what` — a finished sentence, curated
by the author. So the honest form of A is to **map what the author already kept into the artifact's shape**,
not to have a second opinion about the same recording.

*Shipped:* `procedureFromSteps` in `extension/procedure.js` (beside `procedureFrom`, sharing one
`whenToUseFrom` so the two cannot word that sentence differently), re-exported through the new
`api/_procedure.mjs` + `.d.mts` — the same web → `api/_*.mjs` → `extension/*.js` chain that `checksOf` and
`fitBlock` already use, because the web app must not import `extension/` directly. Attached at save in
`saveAsGoalSkill`. 11 new checks in `api/_test-skills.mjs`, including the one that matters: a `created`
skill's `verification` passes the same `readExpects` that judges a case's.

*Deliberately not attached* to `saveDictatedAsGoalSkill`: a dictated skill's steps are tool names
(`"1. click"`), not sentences, and manufacturing prose from them would put the log back into the document.
Absent is not false.

#### Step 1b shipped 2026-09-17 — the loop closes, and it closes at BOTH doors

A case built on a skill now takes that skill's `procedure.verification` when its author passed no checks,
and writes the case's checks back onto the skill when they did. Three pure functions in
`api/_procedure.mjs` — `checksOnSkill`, `seedFrom`, `procedureWith` — and both doors call them:
`api/cases.js` (the page) and `api/mcp.js` (the tool). That was the one thing worth being careful about:
**a door that seeds and a door that does not are two ideas of what a case is**, exactly as an already-pinned
rule says about the two doors having one judge. The MCP pin that guards it now guards the seed as well.

Four decisions inside it, each of which could have gone the lazy way:

- **The seed goes through `readExpects`.** A skill carrying a malformed check is refused in the same words
  as one typed by hand. One judge, and nothing smuggled in through the skill that the door would refuse.
- **An empty list counts as "none given".** Passing `[]` and being refused while checks sit on the skill
  would be two answers to one question.
- **Seeded checks are not written back.** They came from there; writing them home again would rewrite the
  field with itself and move `updated_at` for nothing.
- **A skill with no procedure does not get one invented here.** Skills saved before step 1a carry none, and
  fabricating `steps` and `whenToUse` nobody wrote is precisely the "second opinion" `extension/procedure.js`
  refuses out loud. Absent is not false — and the response says `checksKeptOnSkill: false` rather than
  pretending.

*Original note, kept because it names the writer this step became:* nothing wrote `verification` yet. `extension/procedure.js` already names the
intended writer — *"the field exists to be FILLED — by the author, or by the case flow, in the `expects`
shape from `api/_case.mjs`"* — so the other half is: when a case is created on a skill, seed its checks from
the skill's `procedure.verification` when the caller passed none, and write the checks back onto the skill
so the next case, and anyone who installs it from the gallery, starts from them. That closes the loop with
no new question asked of anybody.

### 4.2 `api/mcp.js` is both products in one file

2 628 lines: P2's tool catalogue *and* P1's whole worker/step protocol. Nothing is wrong with it today —
but every later step in this plan runs into it. Serving a tool subset per product is a one-line change to
the array; serving a *deployment* per product is not, because `callTool` and `?worker=*` are the same module.

*Do:* split into `api/_mcp-tools.mjs` (the catalogue and dispatch) and `api/_mcp-worker.mjs` (claim/step/
report/state/crash), leaving `api/mcp.js` as the route that mounts both. **No behaviour change**, no new
route (the expected-routes pin in `mcp/test-mcp.mjs` stays as it is).

*Done when:* `npm test` is green with the file split and the pin untouched, and a reader can answer "which
product does this code serve" from the filename.

#### Shipped 2026-09-17 — 2 651 lines became 350 + 1 310 + 1 007

`api/mcp.js` is now the route and nothing else: it mounts `_mcp-tools.mjs` (the catalogue and `callTool`)
and `_mcp-worker.mjs` (claim/step/report/state/crash). **No behaviour changed** — the code moved, and the
seam it moved along was the one the file already marked with a comment.

**The two halves share exactly two identifiers**, found by measuring rather than guessing: `BROWSER_GOAL`
and `scheduleId`. Both went to the **existing** `api/_queue.mjs`, because putting either into one half would
make the other import it — and a half that imports its opposite is a filename that has stopped answering
the question this step exists to answer. That is pinned: neither half may `from './_mcp-…'` the other.

**The 92 pins in `mcp/test-mcp.mjs` that read `api/mcp.js` now read all three.** They assert *this code
exists and says this*, not *it lives in this file*; binding them to a filename would break them on every
later step of this plan while guarding nothing. What the split itself promises is guarded by a new pin of
its own — no tool schema in the worker, no worker protocol in the catalogue, nothing decided in the route —
and that pin was first written loose enough to catch the **comments** that explain the split, which is the
"check code, not prose about code" rule catching its own author.

### 4.3 `api/insights.js` answers both products in one response

One route, one read-only transaction, computing both *what the person did* (`applications`, `attention`,
`actions`, `patterns` — from `flow_digest`/`flow_text`, P2) and *how the agent performed* (`totals`,
`byOutcome`, `byDay`, `repeated`, `slowestSteps`, `failures` — from `user_run`, P1).

*Do:* keep one route, but name the two halves in the response (`did:` and `ran:`), and let the caller ask for
one (`?half=did|ran|both`, defaulting to both so nothing breaks). The page split in §5.2 then becomes a
choice of section rather than a rewrite of a 2 331-line view.

*Done when:* `/api/insights?half=did` runs no query against `user_run`, and the Dashboard asks for only the
half it is showing.

**Done, 2026-09-17,** and with one thing learned that the paragraph above had not foreseen: **one query read
both tables**. `applications` looked like a P2 block, but its SQL joined recordings' time (`user_flow`) to
runs' time (`user_run`) inside a single statement — so the plan's condition was unreachable without touching
it. It is now cut along the seam that was already inside it (`flow_time` against `step`/`run_left`; the
`combined`/`rolled` CTEs that added them became ten lines of JavaScript), and `peopleQ` the same way. No copy
of the SQL appeared: each half still exists once. The cost is stated in the file — the window totals were
taken before the `LIMIT`, so each half now returns all of its groups and the cap moved to the response.

Two things done beyond the letter of the condition, both because the halves made them necessary rather than
merely nice:

- **The answer is read by key, not by position.** Twelve names destructured out of one array held only while
  the array's length was constant; with halves it is not, and positional reading would have handed one
  query's rows to another's field — no error, a dashboard of plausible wrong numbers.
- **`web/src/extension/Account.tsx` now asks `half=ran`.** It reads one field, `totals.agentHours`, and was
  paying for the unrolling of every event of every recording in the window — the most expensive read in the
  product — every time the panel opened. That is the step's first real saving, and it arrived before any
  page was split.

The Dashboard itself still shows both halves, so it asks for `both` — named in one constant (`HALF`) so
§5.2 changes a word rather than a loading path.

---

## 5. The torn screens, and how each is cut

### 5.1 Skills (`web/src/features/skills/SkillsView.tsx`, 1 879 lines) — the most divided screen in the app

It currently holds, in one page: the library of flows; rename/export/delete; **tool definitions** (name,
description, JSON schema — "which is what a model is given", its own header says); publish to the gallery;
mint a device token and pair the extension; "Ready to become a skill"; and the **Schedules** strip ("Runs by
itself"), plus `SkillWizard` imported from `features/record`.

*Cut:*

- **P2 — "Library"**: the flows themselves, the procedure, the tool schema, SKILL.md export, publish,
  pairing. This is P2's workshop, and it is where `mcp/server.mjs`'s per-skill tools come from.
- **P1 — "Runs"**: run this now, schedule it, "Runs by itself". Schedules already have their own component
  (`Schedules.tsx`) and their own route (`api/schedules.js`), so this is a move, not a rewrite.
- `SkillWizard` stays one component, imported by whichever product shows it (it turns a recording into a
  skill — P2's act, reached from P2's Record).

### 5.2 Dashboard (`InsightsView.tsx`, 2 331 lines)

Two questions live here: *what did I spend my week on* (P2) and *what did the machine do and did it work*
(P1). After §4.3 the route can answer half at a time; the page becomes two pages that share their chart
components. The embedded assistant goes with P2 (it answers "ask about your own work"), and the P1 half keeps
the failure/repeat tables that feed the Tests page.

**Superseded in part, 2026-09-18: the owner moved the Dashboard to P2 whole.** The P1 half is not needed —
Logs answers "what did the machine do" with the evidence attached, which is the stronger version of the same
question.

**And then corrected the same evening, by trying it.** "One line" was wrong, and the way it was wrong is
worth keeping: changing `HALF` to `'did'` typechecks, does not crash, and produces a page that **says
0 runs, —% success rate, no failures, no slow steps**. Every list on this page is read through `list()`,
which turns a missing field into an empty array — defensive code written for a deploy where the page is
newer than the endpoint, doing exactly its job and, here, hiding the problem. A page that was never asked
the question now answers it with a nought.

So the work is what it always was — take the run blocks off the page — only smaller, because they need
deleting rather than moving. They are not one section: *success rate* and *worth automating* are tiles in
the same grid as *recordings* and *skills made*. That is a change somebody has to **look at**, not one the
typechecker can confirm, and it is left for a session that can. The route already does its half; step 3 is
not wasted.

### 5.3 Gallery

Two shelves today: published flows (installed in order to be **run** — P1's distribution channel) and
Documents (P2, and not publishable at all — there is no gallery row type for a document). *Cut:* the
Documents shelf becomes P2's own `/docs` index — a route that existed until recently and was collapsed into
`?tab=documents`. Restore it, and restore `/chat` for the same reason.

### 5.5 Create as a list of threads (owner's proposal, 2026-09-18)

*"Make the UI like Claude's — switching between applications, and in the QA app keep the chats of the tasks
that were created, so the history is visible and the user can repeat them or change them. A shape everyone
already knows."*

**Half of it exists, and that is the point of writing it down here rather than as a new feature.** The
switch between products landed with step 4. Create already keeps a panel of past runs on the right
(`EarlierPanel` / `Earlier.tsx`), and Logs already has **Relaunch**, which puts a past goal back into
Create's composer (`RELAUNCH_KEY`, through `sessionStorage`). So "repeat it" is built; what is missing is
the *shape* — a list you read down the left, where a row is a task rather than a row in a table.

**The one thing that is genuinely missing is the thread.** A run today is a single execution, not a
conversation: `user_run` holds a goal, steps and an outcome, and two runs of the same goal are two
unrelated rows. Claude's shape implies that reopening a row continues something. Two honest readings, and
they cost very different amounts:

| Reading | What it means | Cost |
|---|---|---|
| **A — a thread is a goal you can pick up again** | The row carries the goal and its attachments; opening it fills the composer, and *Run again* / *Change and run* are the two actions. Each run is still its own row in Logs | Small. No schema, no protocol: the goal is already stored, `relaunch()` already does the move |
| **B — a thread is a conversation with state** | Follow-up turns against the same thread ("now do the same for October"), model context carried between them | Large. A `thread_id` on `user_run`, a decision about what the model is shown from previous turns, and the same question answered again in the extension and in the desktop driver |

**Done 2026-09-18, and one thing in the description above turned out to be wrong.** The plan said *two
actions — Run again / Change and run*. There is **one**, and it is the right number: an immediate re-run is
a run started without reading what is about to go, which is precisely the bug this page already fixed once
(Enter doing something other than the button said). Between that run and this one the machine has changed —
other windows are open, other mail has arrived. "Repeat" means read it and press the button, and a single
action that fills the composer means both repeating and changing.

Two details that only appear once it is built: reopening **replaces** the composer rather than adding to it,
because a mixture of the old task and whatever was half-typed cannot be read before pressing Run; and the
goal has to be split back into text and attachments, or somebody who wanted to change one word gets three
screens of CSV in the field.

**Do A first**, and do not let it drift into B by accident. A is a move of what exists into the shape people
recognise; B is a second kind of memory beside `app_memory`, and this codebase already has one rule about
that (QA-ROADMAP §0 principle 3: one implementation, many readers). If B turns out to be wanted, it should
be planned as its own thing with `chat_thread`/`chat_message` — which P2 already has — rather than grown
sideways out of the run table.

*Done when:* a past task is one click from being run again or edited, from the same list, without going
through Logs — and the list is the thing you see first on Create, not a panel on the right.

### 5.6 Connections has no door in P1 (found 2026-09-18, by looking — and smaller than it first read)

With P1 trimmed to four screens, `/connect` is in none of them. It is reachable from the agent pill in the
header and from the settings dialog, and the "no local agent is answering" notice says *Open Connections* —
a sentence naming a place the menu does not have.

**Corrected on inspection, and the correction is the useful part.** The notice already had a button to
`/connect`; it was labelled **"Open the guide"**, which names a different thing from the sentence above it,
and it appeared **only when there was no agent at all**. The stale-agent case — `health` present but too old
to see or act — carries a sentence that also says *Connections has the command*, and had no button under it.
So the gap was never "no door"; it was a door with the wrong name on it, and a second case with no door at
all. In an eight-screen app that cost nothing, because Connections was in the menu; at four screens the
button is the only way there short of the header pill.

*Done 2026-09-18:* the button says **Open Connections**, and it appears on every desktop refusal rather than
only on the absent one. **No nav row** — four screens is a decision, and the header pill is the permanent
door for a machine that is already connected; what was missing was the door at the moment of the problem.

### 5.4 The cross-links that would tear

These are the actual seams; each needs a deliberate decision rather than a broken button:

| Seam | Today | After |
|---|---|---|
| `RecordView.tsx:1222` → `/skills?make=` | Record hands a recording to the skill wizard | Stays inside P2 |
| `RecordView.tsx:1249,1255` → `/dashboard` (`askAbout`) | Record asks the assistant to analyse or document | Stays inside P2 |
| `RecordView.tsx:274` → `/connect` | Pressing Record with no agent | **Crosses products** — P2 needs its own "no machine is watching" path, and it must not sell P1's install |
| `InsightsView.tsx:1469,1476,1888` → `/record`, `/create`, `/skills` | Dashboard's call-to-actions | The `/create` one is the deliberate bridge from P2 to P1 — keep it, name it |
| `SkillsView.tsx:1811,1817` → `/create`, `/record` | "Describe a skill" / "Import a recording" | Split with the screen |
| `ActivityView.tsx:289` → `/skills` | "paused schedules live on Skills" | Points at P1's Runs half after §5.1 |

---

## 6. The local halves — agent and extension

### 6.1 The agent, and the promise P2 wants to make

P2's pitch is "it only watches". The code can make that true; **macOS cannot**, and the plan says so out loud:

- All input injection is confined to `enum Input` (`agent/mouseflow-agent.swift:2961`) plus one private copy
  inside `Replayer` (`:4133`). There are exactly **two** `event.post(tap: .cghidEventTap)` sites — `:2988`
  and `:4509`. `Input.refusal()` (`:3019`) is already the single choke point that refuses injection when
  Accessibility is absent.
- The recording tap is already listen-only (`options: .listenOnly`, `:4680`), and recording never captures
  key identity — "a key was pressed, and when. **Never which key**" (`agent/PROTOCOL.md`). That is the
  strongest privacy evidence P2 has, and it was already true before anyone thought of selling it.
- **The caveat:** on macOS the event tap and the `#ctx` accessibility tree need the *same* Accessibility
  grant that authorises `CGEventPost`. So a record-only build is a **code-shaped** guarantee, not an
  OS-shaped one. Screen Recording *is* separable (a docs build can skip it; `/windows` falls back to app
  names). **Never claim the OS is enforcing it.**

*Do:* one flag — `--record-only` — hung on `Input.refusal()`, reported in `/health` as `canAct: false`, in
both agents. One install, one binary, two modes. (Both agents: the Windows C# half must be compiled for real
per MEMORY-PLAN §0; `swiftc` does not exist on Windows, so the Swift edit gets read twice.)

### 6.2 The extension

`extension/popup.js` already has two named views — `'record'` and `'create'` — which are exactly the two
products' entry points; they need renaming, not inventing. `extension/content.js` (1 773 lines) is the file
that genuinely holds both halves: recording (`selectorFor`, `capture/start|stop`), acting (`replay/event`,
`agent/act`, the `perform` switch), seeing (`agent/snapshot`, `agent/pulse`), checking (`checkFacts`).
Splitting it is optional for level 1 and required before level 2.

### 6.3 Should the agent be a real application? (owner's question, 2026-09-17)

**Two different questions hide in this one, and they have opposite answers.**

**(a) Packaging the agent as a signed native binary — yes, and Windows first.**

Note what already exists: the macOS half *is* a compiled Swift binary with a menu bar item, self-restart and
`--doctor`. The Windows half is PowerShell hosting ~6 700 lines of C# compiled at startup by `Add-Type`. So
this is not "write an app" — the app is written. It is a **packaging and signing** job, and the two halves
are not in the same place:

| | Today | What packaging buys |
|---|---|---|
| Windows | A piped PowerShell command; C# compiled at run time | The install stops looking like the exact thing security training tells people never to paste. Removes `Add-Type` startup cost, PowerShell 5.1-vs-7 divergence, execution policy, and AV heuristics on runtime-compiled code |
| macOS | `curl \| bash` that compiles Swift — needs Xcode command-line tools on the user's machine | A notarised `.app`: no toolchain required, Gatekeeper satisfied, permissions prompted the way every other Mac app prompts them |

The honest case **for**, in order of weight: the install is the highest-anxiety moment in a product that
takes the mouse, and it is the moment a team buyer decides; a packaged binary is the only way to get
auto-update, crash reporting and code signing that are hand-rolled today; and §7 option 3 (a global hotkey
and a microphone for dictating with the app closed) genuinely needs a real application rather than a script.

**And if it is packaged, the Windows half should become .NET 10** (owner's question, 2026-09-17). Not a
separate project — the same one, with a target named. What it buys, in order of weight:

- `Add-Type` compiles ~5 700 lines of C# at every start, and in Windows PowerShell 5.1 that is the .NET
  Framework compiler: the language is stuck around C# 5. The file already works around the 5.1-vs-7 split by
  hand — `agent/mouseflow-agent.ps1:5903` refuses `JavaScriptSerializer` because the assembly reference that
  works on one does not exist on the other — and that class of workaround only grows.
- `dotnet build` makes the Windows half **buildable in CI**, not only on a Windows desk. MEMORY-PLAN §0
  requires the C# to be compiled for real, and today that requirement is satisfied by a person.
- A signed `.exe` removes execution policy, AV heuristics against run-time-compiled code, and an install
  that reads like the exact thing security training tells people never to paste.

The cost is the cost above plus a self-contained build of roughly 70 MB (or a framework-dependent one that
makes the runtime a prerequisite). **So: the target is .NET 10; the timing is still §6.3's — after the
split, tied to whichever product ships first.** A better language version is not a reason to pay for the
certificate sooner.

The honest case **against doing it now**: it costs an EV certificate on Windows or a SmartScreen reputation
burn-in, an Apple Developer ID plus notarisation on macOS, and a second release pipeline to keep green — in a
repository where the Windows machine has no `swiftc` and the Mac machine cannot compile the C#. And nothing
has been measured saying the installer is what loses people. This codebase's own lesson from roadmap item 6
is written down: *measure before optimising, and be willing to delete a planned task on the measurement.*

**So: after the split, not before, and tied to whichever product ships first — because the two products want
different installers.** This is the part worth seeing: with §6.1's `--record-only` flag, **P2 can ship an
installer that never asks for the permission that frightens people**, because it genuinely cannot inject
input. "Install this, it only watches" is a far easier sentence than anything packaging alone buys, and it is
a product difference rather than a file-format difference.

**(b) A full desktop UI (Electron/Tauri) replacing the web app — no.**

The documentation already counts three clients (web app, extension, agent). A desktop UI makes a fourth
surface that must stay in step with the other three, duplicates screens that exist, and buys nothing the
extension's side panel does not already provide — the panel renders the app's own screens today
(`Surface: 'app' | 'panel'`). The agent should stay a small local service with a tray; the UI should stay one
implementation.

---

## 7. Dictation — P1's own ask, and the decision that comes with it

**Already built:** `web/src/features/create/dictation.ts` — Web Speech, wired into Create's composer, with
`processLocally: true` whenever the language pack is on the device. Its header calls that "не оптимизация, а
главное решение в файле": by default Chrome sends microphone audio to its own servers, and *"для продукта,
который смотрит в экран и обещает говорить, что именно уходит с машины, тихо добавить такое было бы
повторением ошибки, которую мы уже один раз отзывали."*

**Owner's decision, 2026-09-17: use OpenAI's speech-to-text instead.** Recognition quality is the reason, and
it is a real one — dictated goals are full of application names, button labels and Russian, which is where
the browser's own recogniser is weakest.

**What that decision costs, stated plainly because the file above exists.** Audio then leaves the machine on
every dictation, always, to a third party. That is not a bug in the choice — it is the choice — but it
reverses the central decision of the file being replaced, in a product whose pitch is that it says what
leaves your computer. So:

- The line that today reads *"dictation stays on this computer"* becomes *"dictation is sent to OpenAI to be
  recognised"*, **shown before the microphone is armed, not after**. `dictation.ts` already models this
  correctly — `where` is part of the state rather than an implementation detail — so this is a change of
  value, not of design.
- Keep the on-device path as the fallback, not as dead code: a machine with the language pack and a person
  who would rather not send audio should still be able to dictate. Two recognisers, one switch, one sentence
  saying which is in use.

**What it is NOT a drop-in for.** `api/_provider.js` is the Responses API and says outright it is "not a
general-purpose SDK — no streaming, no images". Transcription is a different endpoint
(`/v1/audio/transcriptions`), so it is a **third transport**, not a new argument to `ask()`. The shape to
copy is `api/claude.js`: the key stays on the server, the upload is capped, and the route is rate-limited
through `api/_spend.mjs` under its own `LIMITS` key (`transcribe`). The model id goes in the environment with
an allowlist, the way `OPENAI_MODEL` already does — **not** hardcoded from anybody's memory of what OpenAI
currently serves; `api/models.js` exists precisely so the deployment can ask rather than assume.

Two things to check before writing any of it: whether `OPENAI_API_KEY` is actually set on this deployment
(`api/_provider.js`'s header says it was not, a later comment says documents run on `gpt-5.6-terra`, and
those two cannot both be current), and what the transcription endpoint's current model names are.

**The entry points, cheapest first** — this part is unchanged by the choice of recogniser, and only the third
option is made *easier* by it:

1. **The extension side panel.** It already renders app screens (`Surface: 'app' | 'panel'`) and `popup.js`
   already has a `create` view. No native work, no agent rebuild. *Recommended first step.*
2. **A tray/hotkey that opens a small dictation window.** The agent already serves loopback; the window is a
   browser window, so the recogniser stays in one place.
3. **The agent records the audio itself and posts it up.** With OpenAI doing the recognition this stops
   needing `SFSpeechRecognizer` / `System.Speech` in two languages — the agent only has to capture a few
   seconds of microphone and POST it, which is far less code than native STT would have been. It still costs
   an agent rebuild (and every rebuild invalidates TCC grants — STATUS.md), and it adds a **microphone**
   permission to a product that has so far asked only for screen and accessibility. Worth it only once 1 or 2
   have shown the habit is real.

### 7.1 Speaking into a phone while the computer does the work (owner's question, 2026-09-17)

**This needs no new architecture, and that is not a coincidence — it is what the queue was built for.**

`db/007_run_queue.sql:9-12`: *"A call becomes a ROW here, a worker on the user's own machine claims it… The
direction of the connection never reverses… no inbound path to anybody's computer exists."* A phone is
simply one more thing that **inserts a row**. It is exactly what an MCP client already does from Claude
Desktop today via `mouseflow_do` / `mouseflow_run` — the desktop agent long-polls `?worker=claim` every three
seconds and cannot tell who asked.

So the whole path already exists except the phone-shaped shell:

| Step | What serves it today |
|---|---|
| Sign in on the phone | Neon Auth session, or a device token (`mf_…`) — the same `whoIsCalling` three ways in |
| Speak | §7's transcription route — **and this is the second reason to do §7 server-side**: Web Speech is unreliable on mobile browsers, so on-device recognition is not really an option there |
| Turn words into work | A `run_queue` row — one insert, `api/_queue.mjs` |
| Watch it happen | `?live=1` + run status, which is precisely what the Activity page already polls |
| See what it did without being there | `run_artifact` evidence frames and `expect` verdicts, both already built for QA |

**Start as a PWA, not as a native app.** The web app already ships a manifest and a service worker
(`vercel.json` headers for `/sw.js` and `/manifest.webmanifest`); "add to home screen" plus a mobile layout
for Create is a fraction of the work of an App Store presence, and it tests the idea before it is paid for.
Native later, and only for what a PWA genuinely cannot do: push notifications when a run needs an answer, a
lock-screen/hotword entry point, background audio capture.

**Three things a phone screen must say, because they are true regardless of how good the app is:**

1. **The computer has to be awake and taking work.** The schedules feature already has to say this and does
   ("runs only while that computer is awake and taking work"); a phone makes it the first question, not a
   footnote. `mouseflow_status` already answers it.
2. **Nobody is watching the screen.** A run started from a café cannot be confirmed by eye, so a phone-started
   run should lean on the parts P1 already has for exactly this: checkpoint gates for anything one-way, and
   `expect` checks carrying the proof. This is the strongest argument yet that QA belongs *inside* product 1
   rather than beside it — remote acting is only as trustworthy as its checks.
3. **What it may do without asking.** A phone that can drive a desktop is a serious capability; it inherits
   the goal-is-the-authorisation rule from `docs/product/13-extension.md` §"Create the flow", and nothing
   about being remote should widen it.

This is product 1's story end to end — "say it anywhere, it happens on your machine" — and it is worth
noting that it makes the split *more* coherent, not less: nothing about a phone touches recording,
documents or analytics.

---

### 7.2 A messenger as the phone, instead of a PWA (from two codebases the owner sent, 2026-09-18)

§7.1 said a phone is simply one more thing that inserts a `run_queue` row, and proposed a PWA as the shell.
Two projects the owner pointed at answer the same question differently, and both pick the messenger:

- **[TencentCloud/Octop](https://github.com/TencentCloud/Octop)** (MIT, Python, 3.4k★) — Feishu, DingTalk,
  QQ, Discord, WeCom into one `HarnessProcessor`; the session key is
  `<agent>:<channel>:<platform_session>:<dm|group>` and the reply goes back by the same key.
- **[openclaw/openclaw](https://github.com/openclaw/openclaw)** (MIT, **TypeScript**, 390k★) — 20+ channels
  through a local gateway, plus a pairing rule worth copying verbatim: *"DM-capable channels pair unknown
  senders by default; approve a pairing request with `openclaw pairing approve <channel> <code>`."*

**Why a messenger beats a PWA as the first shell.** Push notifications arrive for free — §7.1 named them as
the one thing a PWA genuinely cannot do and deferred them to a native app. There is nothing to install, no
home-screen ritual, and no mobile layout to build before the idea can be tried. What it costs is a bot
token and one channel's API, against a mobile layout for Create plus a manifest.

**What is ours already and must not be re-acquired.** The queue, the worker protocol, `whoIsCalling` with
three ways in, `mouseflow_status` answering "is the machine awake", the run artifacts. A messenger is an
*ingress*, not an architecture: one place that turns a message into a queue row and one that posts the
outcome back. Neither project's agent loop is wanted — this codebase has one, with recording, evidence and
checks attached to it, and QA-ROADMAP §0 principle 3 forbids a second.

**The pairing rule is the part to lift.** A device token (`mf_…`) already authenticates a machine; a chat
account is a different kind of sender, and "unknown senders are paired, not served, until approved by code"
is the right default for something that can drive a desktop. Without it, knowing a bot's handle would be
enough to queue work on somebody's computer.

*Do:* one channel first — Telegram, because a bot is a token and an HTTP call and nothing else — with the
pairing rule, `mouseflow_status` answered before anything is queued, and checkpoint gates on anything
one-way. The PWA stays on the list; it stops being the *first* thing.

---

## 8. Limits, and what a second deployment would cost

`api/_spend.mjs` is keyed by `(user_id, route, at)` and its `LIMITS` object is already **a partition by
route** — "a chat turn is worth more than a filename and both should not share one budget"
(`db/012_model_call.sql:20-21`). Splitting the products' budgets is therefore a partition of keys, with no
schema change:

- **P1:** `step`, `claude`.
- **P2:** `chat`, `insights`, `transcript`, `compose`, `params`, `skill-md`, `plan`.

There is no plan table, no seat count and no per-account budget anywhere in `db/` — so "two products, two
prices" is a product decision with no schema debt behind it, and it is not part of this plan.

A **level-2** split (two builds, two domains) would then be: a second Vite config and entry (the extension
build is the precedent), a second Vercel project pointing at the same repo with a different `buildCommand`,
and the `api/` split from §4.2 so each deployment ships only its own half. Cheap *if* §4.2 and §5 are done
first, and expensive in exactly the way this plan exists to avoid if they are not.

---

## 9. Sequence

Each step ends the way this repository requires: `npm test` green with zero FAIL, `npx tsc --noEmit -p
web/tsconfig.json` clean, `npm run build` in `web/` ok, the docs page updated, push, `build.json` shows the
commit, and one concrete thing named for the owner to check.

**Rewritten 2026-09-18**, after a day in which the owner made six decisions that changed what was left. What
changed, in one line each: the Dashboard, the Gallery and Teams left P1 whole, so §5.2 shrank from a page
split to one query parameter; P1 runs on the local agent alone; Activity became Logs; and two of the
"someday" rows (a phone, a packaged Windows agent) now have a named shape.

### Done

| # | What | Proof |
|---|---|---|
| 1a | **§4.1** a created skill carries tier 1 (`procedureFromSteps`) — 2026-09-17 | `api/_test-skills.mjs`, 11 checks |
| 1b | **§4.1** the case flow fills and seeds `verification` — 2026-09-17 | `api/_test-case.mjs`, 18 checks, 8 mutations |
| 2 | **§4.2** split `api/mcp.js` into catalogue + worker — 2026-09-17 | `npm test`, routes pin untouched, 4 mutations |
| 3 | **§4.3** `insights` halves (`did` / `ran`) — 2026-09-17 | `api/_test-insights.mjs`, 131 checks, 13 mutations |
| 4 | The product axis: `web/src/lib/product.ts`, one list read by sidebar, titles, onboarding — 2026-09-18 | `web/check-web.mjs`, 45 checks, 20 mutations |
| 4a | Two builds from one repo (`build:halves`, `dev:halves`) — level 2 of §0 *prepared*, not performed — 2026-09-18 | `web/check-web.mjs` |
| 4b | P1 trimmed: Gallery, Dashboard and Teams to P2; one executor, the local agent — 2026-09-18 | `web/check-web.mjs` |
| 4c | Activity → **Logs** at `/logs`: a table with named columns, sticky header, Export CSV, Refresh — 2026-09-18 | `mcp/test-mcp.mjs`; CSV pinned by execution |
| 4d | Create in the shape of the references, and **text files attached to a goal** — 2026-09-18 | `agent/test-contract.mjs`, 12 checks |

### Next, in order

| # | What | Why now | How | Done when |
|---|---|---|---|---|
| ~~5~~ | **§5.6** a door to Connections in P1 — **done 2026-09-18** | Smaller than it read: the button existed, was called *Open the guide*, and was missing entirely on the stale-agent case | Renamed to match the sentence; shown on every desktop refusal. No nav row — four screens is a decision | `agent/test-contract.mjs`, 3 checks |
| ~~6~~ | **§5.5-A** Create as a list of threads — **done 2026-09-18** | The owner's shape, and most of it existed already | The list moved to the left of the thread; a row reopens its goal **and its attachments** (`splitGoal`, the inverse of the join). **One** action, not two — see §5.5 for why an immediate re-run was not added | `agent/test-contract.mjs`; DOM order verified live |
| 7 | **§5.1** cut Skills into Library (P2) and Runs (P1) | The last screen still marked `both`, and the only thing standing between here and two coherent products | Split the view; `SkillWizard` stays one component | Neither half uses the other's vocabulary |
| 8 | **§5.2** the P2 dashboard asks `?half=did` — **NOT one line; corrected 2026-09-18 by trying it** | The route half is one line. The PAGE is not: `did` sends no `byOutcome`, `byDay`, `repeated`, `slowestSteps`, `failures`, `skills`, and the page renders them as **0 runs, —% success, no failures** — absence as a negative fact. It does not crash; `list()` sees to that, which is exactly why it is dangerous | Remove the run blocks from the page. They are not a section: *success rate* and *worth automating* are tiles in the same grid as *recordings*. **Needs eyes on the result** | The dashboard runs no query against `user_run` **and** claims nothing about runs |
| 9 | **§5.3** restore `/docs` and `/chat` as first-class P2 routes | A document is P2's output and is reachable only through the Gallery's second shelf | Undo two redirects; both screens exist | A document opens without going through the Gallery |
| 10 | **§8** partition `LIMITS` | Two products, one budget: a chat turn and a run currently share a ceiling | A partition of keys in `api/_spend.mjs`; no schema change | One product's spend cannot exhaust the other's |
| 11 | MCP profiles: P1's 7, P2's 7, the shared 4 | The tool list is one array, so this is cheap — but a P2 connector seeing `mouseflow_run` is a product leak | Subset the array by profile | A P2 connector never sees `mouseflow_run` |
| 12 | **§6.1** `--record-only` + `canAct:false`, both agents | P2's pitch is "it only watches", and today that is a claim rather than a flag | One flag hung on `Input.refusal()`; the C# compiled for real | A record-only agent refuses every injection action, and says so in words |
| 13 | **§7** transcription route (server-held key, capped, rate-limited) | Dictation quality was the owner's ask, and it reverses a promise the code makes — so the route and the sentence ship together | `api/claude.js` is the shape to copy; a new `LIMITS` key | A goal can be dictated, and the UI says where the audio goes **before** the microphone is armed |
| 14 | **§7.2** one messenger channel (Telegram), with the pairing rule | Cheaper than the PWA and brings push for free; the queue already does the hard half | One ingress that turns a message into a `run_queue` row; unknown senders paired, not served | A goal sent from a phone runs on the desk, and an unapproved sender cannot queue anything |
| 15 | **§12** docs set split into two indexes | Each product's documentation should read as one product's | Two indexes over the existing pages | `agent/check-promises.mjs` still green |

### Proposals — worth doing, nobody has asked for them yet

| What | Why it is not above the line |
|---|---|
| **§5.5-B** threads with conversation state | A second kind of memory beside `app_memory`, and a `thread_id` answered again in the extension and the desktop driver. Wanted only if 5.5-A shows people asking follow-ups |
| **§7.1** the PWA | Still the right thing for a phone that is not a chat app. Behind the messenger because the messenger costs a token and this costs a mobile layout |
| **§6.3 + .NET 10** packaging the Windows agent | The technical answer is settled (yes, .NET 10, Windows first). The commercial one is not: nothing has been measured saying the installer is what loses people. Ask one buyer before buying a certificate |
| **Attachments with their own field** | Today an attached file is part of the goal and is capped at 4000 characters, because that is what the queue path stores. A real attachment field would have to cross the queue, three loops and the extension — worth it only when somebody hits the cap for a real reason |
| **Replacing `@insightis/ui`** | 228 vendored files from another Devart product. The name never reaches a built bundle and source maps are not published, so the exposure is the repository and the Sentry project. Only needed if sources are ever handed to a client |
| 0 | `db/022_queue_machine.sql`'s header still says "НЕ ПРИМЕНЕНА" — it was applied 2026-09-11 | Housekeeping, one line, keeps getting postponed |

Steps 1–4 are done. 5–9 are the split proper. 10–15 finish it; 13 and 14 are the only two that add a
capability rather than divide one.

---

## 10. What this plan deliberately does not do

- **Two repositories.** The artifact, the agent, the extension and the brain are shared; two repositories
  means two copies of `mouseflow.skill/2` and a format that disagrees with itself within a month.
- **Two agents or two extensions.** One install, one pairing, one set of TCC grants. §6.1's flag is a mode,
  not a second binary.
- **A second queue or a second decision loop.** QA-ROADMAP §0 principle 3 exists because of exactly this.
- **Site work.** Explicitly deferred by the owner, 2026-09-17.
- **Pricing.** No schema debt, no plan table; a product decision for later.

---

## 11. Open questions only the owner can answer

1. **The names.** "Do it for me" and "Make it reusable" are working titles for arguing with. The existing
   name collision (mouseflow.com, behaviour analytics — STATUS.md §5.3) hits the *documentation* product
   hardest, which is P2, and P2 is the one whose name would be new.
2. ~~**Does the Gallery belong to P1 or P2?**~~ **Answered 2026-09-18: P2's.** Both shelves are "what is
   already made and can I take it", which is a workshop question. The Dashboard and Teams went with it.
3. **Do documents get published and shared like skills?** There is no gallery row type for a document today
   (§5.3), and adding one is a product decision, not a refactor.
4. **One account or two?** This plan assumes one — one sign-in, one pairing, both products visible to a
   person who has both. Two accounts would change `whoIsCalling` and the team model, and nothing in the code
   wants that today.
5. **Does P2 ship a record-only agent by default?** §6.1 makes it possible; whether the documentation
   product's install *should* refuse injection out of the box is a positioning decision, and it changes what
   the install page can honestly promise.
6. **When to pay for packaging** (§6.3). The technical answer is "Windows first, after the split". The
   commercial answer — whether a signed installer is what unblocks the first paying team — is the owner's,
   and it is worth asking one buyer before buying a certificate.
7. **Does dictation keep an on-device fallback** (§7), or does the product simply say that audio goes to
   OpenAI and leave it at that? Keeping both is one switch and one sentence; keeping neither is simpler to
   explain but reverses a promise the code currently makes.

7a. **Which messenger first** (§7.2), and whether a chat account may drive a desktop at all. Telegram is
   proposed because a bot is a token and an HTTP call; the pairing rule is not negotiable either way.

7b. **Do threads carry conversation state** (§5.5)? A is small and is on the list; B is a second kind of
   memory and needs its own plan.

7c. **Does Connections stay in P1's menu forever, or only until the agent is installed** (§5.6)?
8. **Which side of the wall moves — A, B or C in §4.1's correction?** This one blocks step 1, and step 1 is
   the repair the whole "one artifact, two products" claim rests on. It is a product decision because each
   answer changes what the person is asked for and when.
