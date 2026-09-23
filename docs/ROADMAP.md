# Roadmap — what is left, on one page

**This file holds STATUS. The plans hold REASONING.** One line per item here, and a link to the document
that says why it exists and what "done" means. That division is the whole point: three copies of the same
list agree for a week and then drift, and this repository has already paid for that twice (the goal cap
stood in three places "by comment"; `db/022`'s header contradicted the database for six days).

So: **change a status here, change the reasoning there.** If an item's shape changes, the plan is edited and
this line follows — never the other way round.

Updated **2026-09-23**. Live: `https://mouseflowapp.vercel.app`. Every step ends the same way —
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

*The split is finished. What follows is the rest of the sequence.*

- [x] **7 · Skills is P2's, schedules are in Tests — done 2026-09-22.** The cut was a subtraction: all of
      that screen is P2's workshop and P1 owned only the schedules. They moved into Tests as a third card
      (strip + a skill picker, since the clock left the library row with them) rather than onto a fifth
      screen — a case is already *a skill plus what must hold, run nightly*, and a skill on a clock is the
      same question with nothing asserted. Name kept. **No screen is marked `both` any more.**
      [§5.1](SPLIT-PLAN.md)
- [x] **8 · The dashboard reads recordings only — done 2026-09-22.** Not a filter: six sections, four
      tiles, five columns and all the arithmetic behind them were **removed**, 728 lines of it, and the
      type now declares the `ran` fields optional so a future omission fails the typecheck instead of
      printing a nought. Four false statements surfaced only by looking at the page — the headline still
      promised *reliability*, the applications note said *recordings and runs together*, that table kept a
      Runs column, and the endpoint's own "why" for unplaced time listed agent steps that half never
      counted. [§5.2](SPLIT-PLAN.md)

## The split, remaining

- [x] **12 · `--record-only` + `canAct:false`, both agents — done 2026-09-23.** The list in the code is
      of the six actions that **read** (`clipread capture read find refresh waitwindow`), not of the ones
      that act — so an action added later and forgotten there is refused rather than allowed. Three of the
      refusals inject nothing and are refused anyway: `activate` raises somebody else's window, which is
      how the *next* action lands in it; `open` starts a program; `clipwrite` replaces the clipboard.
      `/health` answers `canAct` **and** `recordOnly` — two facts, because a missing Accessibility grant
      needs a switch shown and a chosen mode needs nothing offered. **No version bump**: the flag answers
      for itself and absent is the answer, and raising `AGENT_WANTS` would have told every user to
      reinstall for a switch nobody asked for. Said out loud everywhere it is read — the refusal, the
      banner, `/health`, Connections, `17-privacy` — that **neither OS enforces this**; on macOS the same
      Accessibility grant authorises `CGEventPost`, on Windows `SendInput` asks nothing at all.
      [§6.1](SPLIT-PLAN.md)
  - Two things only a live run could find, both now fixed and pinned. **The agent still took work**: with
    the flag on it reported `taking:true` and was about to poll the queue, where everything that arrives
    is a goal, a replay or a window to raise — it would have claimed jobs to fail them. It now claims
    none, and a queued task waits. And `HOME` does **not** isolate a test run on macOS: `NSHomeDirectory`
    asks `getpwuid`, so the binary read the real account file anyway — which is precisely why the suite
    cuts functions out of the source instead of starting an agent.
  - **The Windows half was not compiled** — no `pwsh` and no `dotnet` on this machine, and per
    `agent/check-csharp.mjs` that is not going to change. It was checked by the compiler proxy, and both
    agents' lists, refusals and courier guards are pinned against each other and against the docs.
    Its first real start is still owed.
- [x] **13 · Transcription — LIVE 2026-09-21.** `api/_transcribe.mjs` holds the words, the caps and the
      call; `api/transcribe.js` is the page's door, capped under its own `transcribe` ceiling. The model
      id has **no default at all** — it is asked of `/api/models`, which now lists recognisers. Three
      ways in, all working: a voice message in Telegram (proved on a real run), the Create composer, and
      the same route for anything later. Two recognisers, one switch, one sentence — the on-device path
      is kept as the other half of a choice rather than deleted. [§7](SPLIT-PLAN.md)
  - [ ] **The agent records audio itself** — §7's third entry point, and still the expensive one: a
        rebuild of both binaries, a **microphone** permission on a product that has asked only for screen
        and accessibility, and every macOS rebuild invalidates the TCC grants. Worth it once the habit is
        real; a phone and a composer both have a microphone today.
- [x] **14a · Telegram as a front door — LIVE 2026-09-21.** Type, attach, read the plan, press Approve,
      *then* a `run_queue` row. Unknown senders are paired, not served. Touches no driver and neither
      agent. Two tasks ran end to end from a phone, both `ok`. [§7.2](SPLIT-PLAN.md) · notes below
  - [x] `db/024_chat_channel.sql` applied 2026-09-21, both tables read back from `information_schema`.
  - [x] Both environment variables set, `setWebhook` called with the secret.
  - [x] One chat paired, two tasks run. **Three bugs only a real run could find**, each now pinned:
        the plan's `HTTP 401` explained nothing; a free desktop goal had no name in the queue dictionary,
        so the agent's courier took it and answered "does not understand"; and a job could end in ten
        places while only three of them said so in the chat.
- [ ] **14b · A checkpoint answered from the messenger** — the cloud path is ungated on purpose (*"нет шлюза
      — нет инструмента"*, `api/_brain.mjs`). A messenger is the first thing that makes "somebody is
      watching" true there, and it costs a waiting state on `run_queue`, a pause the worker protocol can
      express, the same pause handled in PowerShell **and** Swift, and a timeout that fails with words.
      Bigger than 14a, and a safety gain for runs that have none today. [§7.2](SPLIT-PLAN.md)
- [x] **15 · Docs set split into two indexes — done 2026-09-23.** `docs/product/do.md` and `make.md`,
      over the **same** pages: copying the thirteen shared ones (protocol, both agents, extension, API,
      data model, privacy, configuration, limits, operations) would have made thirteen files to edit
      twice, and the first divergence would have been silent. `README.md` stays the whole set and points
      at both. **The indexes cannot drift**: each screen row carries the screen's route, and
      `check-promises.mjs` reads those routes and asks `web/src/lib/product.ts` — the one list the
      sidebar, the header and the tour already read. Wrong half, dead link, page in neither index, or a
      working name changed in code and not in the heading: all six fail the suite, proved by mutation.
      Two things found on the way and fixed rather than noted: **§12 of the plan did not exist** — this
      row had linked to it for four days — and the docs README pinned a commit and "agents 0.8.2" while
      the agents were at 0.29.0, so the one line claiming to say how current the set was, was the most
      out-of-date line in it. [§12](SPLIT-PLAN.md)

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

- [ ] **16 · An instant panel with the chat in it** — owner's decision 2026-09-21, and he chose the
      expensive shape deliberately: a native always-on-top panel on a global hotkey, not a browser window.
      It holds a **WebView** on our own compact composer, so it is not a second composer to keep in step.
      Chat first, dictation into it second. macOS is cheap (AppKit already running, `WKWebView` in the
      SDK, Carbon hotkey consumes only its own chord); **Windows is not** — WebView2 needs assemblies a
      PowerShell-hosted C# agent has nowhere to put, so that half waits for the packaged app below.
      [§7](SPLIT-PLAN.md)
  - [x] **The page it shows** — `/panel`, shipped 2026-09-21. Bare but behind the sign-in, and it
        **queues** rather than driving the run itself, because the window is closed a second later.
  - [x] **The macOS panel and the hotkey** — shipped 2026-09-21. `NSPanel` + pre-warmed `WKWebView`,
        Carbon `RegisterEventHotKey`; off until switched on, `⌃⌥Space` printed in the menu, released
        while a flow is recording, and reachable by mouse for anyone who never turns it on.
        **The agent version is deliberately NOT bumped**: parity is pinned across both agents and
        `AGENT_WANTS`, so bumping would tell every Windows user to reinstall for a macOS-only window.
        It bumps when the Windows half lands.
  - [x] **Sign-in removed, the window sized by the page, three ways out** — everything the first real
        presses found: the panel presents the Mac's own device token instead of asking for a password;
        the page measures itself and posts one height; `.nonactivatingPanel` was silently breaking ⌘V
        and key repeat; and the agent got a main menu, because on macOS paste is a menu item.
  - [x] **Dictation into it — shipped 2026-09-21, and it needed TWO halves, not one.** The plist now
        declares `NSMicrophoneUsageDescription`, in the words the person reads in the system dialog. But
        that alone changes nothing: `WKWebView` asks its host, and a host that has not implemented
        `requestMediaCapturePermissionFor` answers **no, silently** — button drawn, request dead, nothing
        on screen pointing at the cause. Granted only for our own origin and only the microphone. The
        grant is also reset on rebuild alongside the other two, since a new signature is a new app.
        Version in the plist now read from the source: it said 0.8.2 against `VERSION 0.29.0`.
  - [x] **A second chord: press and speak** — `⌃⌥⇧Space` opens the panel already recording, with the
        language taken from the **current keyboard layout** (it says what somebody is typing in now,
        which beats the browser's preferred-languages list — the thing that once had Russian speech
        recognised as English). Set as the visible selection rather than a hidden setting, because a
        Russian layout can still speak English. It calls the page that is already open rather than
        loading a second address: reloading would cost exactly what pre-warming buys.
  - [ ] **First-run permissions in the panel** — deep link to the pane, a live re-check, two lines of
        state. Accessibility can never have an Allow button; the fallback words are the product.
        **Deferred by the owner 2026-09-23**, after looking at how ChatGPT Computer Use does it — which
        confirms the shape rather than offering a better one: their "Allow" opens the same System Settings
        pane and floats a coach window over it with an arrow and the app icon **to be dragged into the
        list**. No API grants either permission; the whole thing is a well-made instruction. Worth taking
        when it is taken: open the exact pane (we have the deep link), float a window whose drag source is
        our own `.app`, name the `+` button as the second path (a drag that misses is the common failure),
        and re-check on return (`--probe` already answers). Same screenshot also showed **MouseFlow Agent
        with Screen Recording on** — so the "screen MISSING" seen in step 12's live run was the temporary
        binary, not a lost grant: TCC follows the signature, not the name.

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

## The first "after" — measured 2026-09-21, from two runs started in Telegram

Twelve days of building had produced **zero runs**: every one of the 807 timed steps and 64 successful runs
in the database predated prompt caching *and* `click_named`. There was no "after" to read. There is now,
and it is small — **20 timed steps across 2 runs** against 807 across 64. Read it as a direction, not as a
replacement for the baseline.

- [x] **Run the agent at all.** Two runs, 2026-09-21, both `ok`, 15 and 7 steps, driven from a phone.
- [x] **QA item 6's done-condition — met.** Median model decision **2 959 ms**, from a measured 5 035.
      The condition was "under 4 000". Range 1 848–5 297. [`QA-ROADMAP.md` §6](QA-ROADMAP.md)
- [x] **The cache marker on the goal — working, and visible.** Every step after the first reads
      **~9 900 tokens** from cache; the first writes it. That is the system prompt, the tool schema *and*
      the opening message, which is what paid for the 20 000-character attachment ceiling.
- [x] **`click_named` is exercised** — twice in the 15-step run, at 1 848 ms and 2 064 ms, among the
      fastest decisions in either run.
- [ ] **Steps per successful run** — 15 and 7 here against a median of 13 before. Two runs cannot move a
      median; this needs a week of ordinary use, which it can now get.
- [ ] **The memory of applications, §4.13** — turns per successful run, before and after. One `taught` fact
      exists; one row is not a measurement. Roll `MEMORY_LIVE` back if it costs more than it saves.

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
