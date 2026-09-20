# Roadmap — what is left, on one page

**This file holds STATUS. The plans hold REASONING.** One line per item here, and a link to the document
that says why it exists and what "done" means. That division is the whole point: three copies of the same
list agree for a week and then drift, and this repository has already paid for that twice (the goal cap
stood in three places "by comment"; `db/022`'s header contradicted the database for six days).

So: **change a status here, change the reasoning there.** If an item's shape changes, the plan is edited and
this line follows — never the other way round.

Updated **2026-09-20**. Live: `https://mouseflowapp.vercel.app`. Every step ends the same way —
`npm test` zero FAIL, `npx tsc --noEmit -p web/tsconfig.json`, `npm run build` in `web/`, push, then one
concrete thing named for the owner to check.

| Where the reasoning lives | What it covers |
|---|---|
| [`SPLIT-PLAN.md`](SPLIT-PLAN.md) | the split into two products; §9 is the numbered sequence with done-conditions, §11 the owner's open questions |
| [`STATUS.md`](STATUS.md) | where things stand, and how to start on a machine that has never seen this project |
| [`MEMORY-PLAN.md`](MEMORY-PLAN.md) | the memory of applications (built), and §0's shell/tooling notes |
| [`QA-ROADMAP.md`](QA-ROADMAP.md) | the eight-item QA direction (closed), and §0 — the house rules |
| `roadmap-2026-09-18.html` | a dated snapshot of §9 for reading outside the repo. **Stale by design** — it is a photograph, not a mirror |

---

## Next up

- [ ] **7 · Split Skills into Library (P2) and Runs (P1)** — the last screen still marked `both`, and the
      only thing between here and two coherent products. [§5.1](SPLIT-PLAN.md)
- [ ] **8 · P2 dashboard asks `?half=did`** — the route half is one line, the page is not: without the run
      blocks removed it renders *0 runs, —% success, no failures*, which is absence shown as a negative
      fact. Needs eyes on the result. [§5.2](SPLIT-PLAN.md)

## The split, remaining

- [ ] **12 · `--record-only` + `canAct:false`, both agents** — P2's pitch is "it only watches"; today that
      is a claim rather than a flag. One switch on `Input.refusal()`; the C# compiled for real. **Say out
      loud that macOS cannot enforce it**: the same Accessibility grant authorises the event tap and
      `CGEventPost`. [§6.1](SPLIT-PLAN.md)
- [ ] **13 · Transcription route** — dictation through OpenAI, server-held key, capped, its own `LIMITS`
      key. Ships **with** the sentence that says where the audio goes, before the microphone is armed:
      it reverses the on-device promise `dictation.ts` currently makes. [§7](SPLIT-PLAN.md)
- [ ] **14a · Telegram as a front door** — type, attach, read the plan, press Approve, *then* a `run_queue`
      row. Unknown senders are paired, not served. Touches no driver and neither agent: approval happens
      before the run exists. [§7.2](SPLIT-PLAN.md) · design notes below
- [ ] **14b · A checkpoint answered from the messenger** — the cloud path is ungated on purpose (*"нет шлюза
      — нет инструмента"*, `api/_brain.mjs`). A messenger is the first thing that makes "somebody is
      watching" true there, and it costs a waiting state on `run_queue`, a pause the worker protocol can
      express, the same pause handled in PowerShell **and** Swift, and a timeout that fails with words.
      Bigger than 14a, and a safety gain for runs that have none today. [§7.2](SPLIT-PLAN.md)
- [ ] **15 · Docs set split into two indexes** — each product's documentation should read as one product's.
      [§12](SPLIT-PLAN.md)

### Step 14, decided 2026-09-20 after reading OpenClaw (MIT)

Their Telegram extension is **284 files, 2 MB** before tests — their whole Gateway (draft streaming, lane
delivery, message cache, thread bindings, callback routers). **Take the design, not the code**; our queue
already does the hard half.

- **Webhook, not long polling** — a serverless function cannot hold a poll open. Telegram calls an HTTPS
  route, the route writes a queue row, the machine claims it with the same `?worker=claim`. The invariant
  survives: nothing reaches into anybody's computer.
- **One authorisation gate** for every inbound update, the way theirs has one.
- **Four states for a stranger**: blocked · allowed by command · on the allow-list · awaiting pairing (DMs
  only). Groups get their own policy and their own list.
- **An edited message never replies** — otherwise editing an old message starts the work again.
- **Store the sender id, not the name.** Names change.
- **Rate limiting is ours to add** — they have none in that file, and behind our messages there is a mouse.
- Any existing bot token works; no new bot needed.

## The application the owner asked for (2026-09-17/20)

Not in the sequence yet — these need shapes agreed before they are steps.

- [ ] **A packaged desktop app, Windows first** — the macOS half is already a compiled Swift binary with a
      menu-bar item; the Windows half is PowerShell hosting C# compiled at startup. Technical answer settled
      (.NET 10, Windows first, after the split). **Commercial answer is not**: nothing measured says the
      installer is what loses people. Ask one buyer before buying a certificate. [§6.3](SPLIT-PLAN.md)
- [ ] **Mobile** — a phone is one more thing that inserts a queue row, so this needs no new architecture.
      Start as a PWA or ride the messenger (step 14); native only for push, a lock-screen entry or
      background audio. [§7.1](SPLIT-PLAN.md)
- [ ] **MCP *client* in the chat** — to pull test cases and data from other servers. **This is the one real
      gap**: MouseFlow is an MCP *server* today and has no client at all. New work, not a wiring job.
- [ ] **Attachments with their own field** — *premise changed 2026-09-20*: the cap is 20 000 characters now
      (one constant, and the goal rides in the cached prefix), so the old "4 000 is too small" argument is
      spent. Revisit only when somebody hits the new cap for a real reason.

## Owed measurements — nobody can answer these until somebody runs the agent

- [ ] **Run the agent at all.** Measured 2026-09-20: the last agent run in the database is **2026-09-08**.
      Every timed step (807) and every successful run (64) predate prompt caching *and* `click_named`. Twelve
      days of building, zero runs.
- [ ] **QA item 6's done-condition** — median model decision under 4 000 ms, from a measured 5 035. Cannot
      be read: there is no "after" in the data. [`QA-ROADMAP.md` §6](QA-ROADMAP.md)
- [ ] **Steps per successful run** — where `click_named` would show. Median is 13, all of it from "before".
- [ ] **The memory of applications, §4.13** — turns per successful run, before and after. One `taught` fact
      exists; one row is not a measurement. Roll `MEMORY_LIVE` back if it costs more than it saves.
- [ ] **The new cache marker on the goal** — shipped 2026-09-20, unmeasured for the same reason. `cached`
      is already written into every step, so the number is there the moment anything runs.

## Waiting on the owner

- [ ] **Which product leads** — decides whose vocabulary gets the site's front page. [§11.2](SPLIT-PLAN.md)
- [ ] **The name** — `MouseFlow` collides with mouseflow.com (behaviour analytics), and the collision hurts
      the documentation product most. Cheap now, expensive later. [§11.1](SPLIT-PLAN.md)
- [ ] **Does the Gallery belong to P1 or P2**, and do documents get published like skills. [§11.3](SPLIT-PLAN.md)
- [ ] **Does P2 ship a record-only agent by default** — it changes what the install page may promise. [§11.5](SPLIT-PLAN.md)
- [ ] **Does dictation keep an on-device fallback**, or does the product simply say audio goes to OpenAI. [§11.7](SPLIT-PLAN.md)

## Parked, with the reason

- [ ] **`mouseflow.skill/2` tier 2** — the recording as a pointer rather than a copy. Hazard already found:
      `mouseflow_run` answers `body: null, goal: false` the moment a `/2` skill stops carrying events, and
      must refuse **with words** instead. [`MEMORY-PLAN.md` §3](MEMORY-PLAN.md)
- [ ] **`learned` memory with staging and approval** — MEMORY-PLAN row 6, "or never". Build only if
      `derived` and `taught` leave a measured gap.
- [ ] **QA item 6, lever 4** — a cheaper model for the wave hand-off and the plan preview. Last on purpose:
      it must not be near a decision that aims a click.
- [ ] **QA item 4, hybrid replay** — proposed superseded by the memory of applications; the owner has not
      struck it.
- [ ] **The site pass** — [`SITE-DEBT.md`](SITE-DEBT.md). Deferred by the owner until the split lands.
- [ ] **Threads with conversation state** (§5.5-B) — wanted only if the thread list shows people asking
      follow-ups.
- [ ] **Replacing `@insightis/ui`** — 228 vendored files from another Devart product. Only needed if sources
      are ever handed to a client.

---

## Done

**The split** — 1a artefact tier 1 on written skills · 1b the case flow fills and seeds `verification` ·
2 `api/mcp.js` cut into catalogue and worker · 3 `insights` halves · 4 the product axis · 4a two builds from
one repo · 4b P1 trimmed to one executor · 4c Activity → Logs · 4d Create's shape and attachments ·
5 a door to Connections · 6 Create as a list of threads · 9 `/docs` and `/chat` restored · 10 `LIMITS`
named per product · 11 MCP profiles (`?profile=do|make`).

**The memory of applications** — the pure module, `derived` over recordings, the turn block behind a flag
(now on), migration 023, the ledger card, and `web:<origin>` reaching a run through the extension. A
redaction gap that only real data could find: an accessibility tree handed back a typed email address as a
control name.

**2026-09-20** — the goal rides in the cached prefix, so an attachment can be five times bigger; the cap is
one constant instead of three that agreed by comment.
