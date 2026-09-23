# “Do it for me” — the documentation of one half

**Describe the job. The machine carries it out on your computer, and proves it still works.**

The arrow points one way here: **the machine acts and the person watches.** A goal, a queue, evidence of
what happened, and a check that says whether it is still true tomorrow.

This is an **index over the existing pages**, not a second copy of them. Every page below is the same file
the other half reads where the subject is shared; nothing is duplicated, and nothing is hidden.

The file is named for the product's **id**, not for its name: `do` is what `web/src/lib/product.ts` calls
it, and the name above is a working title the owner has not settled (`SPLIT-PLAN.md` §11.1). When the name
changes, this heading changes and no link does.

## Its screens

The route in the middle column is not decoration — it is what makes this index checkable. `product.ts`
holds the one list of which screen belongs to which half, and `agent/check-promises.mjs` reads the routes
out of this table and asks that file. A page filed under the wrong half fails the suite rather than
quietly teaching somebody the wrong product.

| | Screen | What it covers |
|---|---|---|
| [05 — Create](05-create.md) | `/create` | Prompt → flow: the executor, the plan, checkpoint gates, window pinning, live context, the decision loop |
| [26 — Logs](26-activity.md) | `/logs` | Running, waiting and everything that ran, with Stop and Cancel beside the thing itself; the status vocabulary |
| [27 — Test cases](27-cases.md) | `/tests` | A skill plus what must be true when it has run: the four verdicts, and why nothing without evidence is ever green |
| [25 — Checks](25-tests.md) | `/tests` | `expect`: an assertion the machine decides from the accessibility tree rather than the model from a picture |
| [24 — Schedules](24-schedules.md) | `/tests` | Runs nobody asks for, ticked by the machine's own poll — and what it says when the machine was asleep |
| [09 — Connections](09-connections.md) | `/connect` | Installing the agent on both platforms, Local Network Access, autostart |

## The parts underneath

Shared with the other half, because the engine is one engine. Read them when the question is *how*, not
*which product*.

| | |
|---|---|
| [01 — Overview](01-overview.md) | What the product is, the three clients, why the split exists, the capability matrix |
| [02 — Concepts and vocabulary](02-concepts.md) | Recording, session, part, flow, skill, run, transcript, role, source, identity |
| [03 — The web app shell](03-web-app.md) | Routes, sidebar, top bar, theme, sign-in wall, settings dialog |
| [10 — Agent protocol](10-agent-protocol.md) | The loopback HTTP contract: every endpoint, parameter, event word and body grammar |
| [11 — The Windows agent](11-agent-windows.md) | Flags, tray icon, hooks, capabilities, platform limits |
| [12 — The macOS agent](12-agent-macos.md) | Installer flags, code signing, TCC permissions, menu bar, self-restart, `--doctor` |
| [13 — The Chrome extension](13-extension.md) | Modes, message API, event format, settings, what it cannot do |
| [14 — HTTP API](14-http-api.md) | Every serverless route with its parameters, caps and auth rules |
| [15 — Data model](15-data-model.md) | Tables, payload shapes, `localStorage` keys, sync and reconciliation rules |
| [17 — Privacy and security](17-privacy-security.md) | What is captured and what is deliberately not — including record-only, which is the *other* half's promise and this half's opposite |
| [18 — Configuration reference](18-configuration.md) | Every environment variable, flag, query parameter, storage key and tuning constant |
| [19 — Limits and known gaps](19-limits-and-known-gaps.md) | Inherent limits, unverified areas, and defects found while writing this |
| [20 — Operations](20-operations.md) | Deploy, migrate, develop, test |

## What is deliberately not here

Recording, the skill library, documents written from a recording, the dashboard, teams, the gallery and the
MCP connector belong to the other half — **[“Make it reusable”](make.md)**. They are not missing pages;
they are somebody else's subject, and the one place both halves meet is the parts list above.

The whole set, in one table, is [README.md](README.md).
