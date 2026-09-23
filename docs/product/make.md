# “Make it reusable” — the documentation of one half

**Record what you already do. It becomes a tool other agents can call and a document people can read.**

The arrow points the other way here: **the person acts and the machine watches.** A recording, the names of
the things that were clicked, a transcript, a skill, a document, and the numbers that say where the week
went.

This is an **index over the existing pages**, not a second copy of them. Every page below is the same file
the other half reads where the subject is shared; nothing is duplicated, and nothing is hidden.

The file is named for the product's **id**, not for its name: `make` is what `web/src/lib/product.ts` calls
it, and the name above is a working title the owner has not settled (`SPLIT-PLAN.md` §11.1). When the name
changes, this heading changes and no link does.

## Its screens

The route in the middle column is not decoration — it is what makes this index checkable. `product.ts`
holds the one list of which screen belongs to which half, and `agent/check-promises.mjs` reads the routes
out of this table and asks that file. A page filed under the wrong half fails the suite rather than
quietly teaching somebody the wrong product.

| | Screen | What it covers |
|---|---|---|
| [04 — Record](04-record.md) | `/record` | The recorder, long sessions, the recordings table, the transcript panel, held recordings, cross-device reconciliation |
| [06 — Skills](06-skills.md) | `/skills` | The library, roles, save-as-skill, tool schemas, publishing, extension pairing |
| [23 — Process documents](23-documents.md) | `/docs` | A procedure written from one recording, every line citing its step, kept as an object somebody can correct |
| [08 — Dashboard and the assistant](08-dashboard.md) | `/dashboard` | Every metric, every gap, the grounded chat and its read-only tools |
| [22 — Teams](22-teams.md) | `/team` | Who may see whose work, the three roles, and the longer list of what a team deliberately does not open |
| [07 — Gallery](07-gallery.md) | `/gallery` | Collections, browse and collection views, install, publish, withdraw |
| [21 — MCP](21-mcp.md) | `/mcp` | Connecting somebody else's AI to an account: every tool, how it signs in, what it refuses |

## The parts underneath

Shared with the other half, because the engine is one engine — except the transcript engine, which is this
half's own and is listed first for that reason.

| | |
|---|---|
| [16 — Transcript engine](16-transcript.md) | How a recording becomes prose, and how an edit is applied and undone. **This half's, not shared** |
| [01 — Overview](01-overview.md) | What the product is, the three clients, why the split exists, the capability matrix |
| [02 — Concepts and vocabulary](02-concepts.md) | Recording, session, part, flow, skill, run, transcript, role, source, identity |
| [03 — The web app shell](03-web-app.md) | Routes, sidebar, top bar, theme, sign-in wall, settings dialog |
| [10 — Agent protocol](10-agent-protocol.md) | The loopback HTTP contract: every endpoint, parameter, event word and body grammar |
| [11 — The Windows agent](11-agent-windows.md) | Flags, tray icon, hooks, capabilities, platform limits |
| [12 — The macOS agent](12-agent-macos.md) | Installer flags, code signing, TCC permissions, menu bar, self-restart, `--doctor` |
| [13 — The Chrome extension](13-extension.md) | Modes, message API, event format, settings, what it cannot do |
| [14 — HTTP API](14-http-api.md) | Every serverless route with its parameters, caps and auth rules |
| [15 — Data model](15-data-model.md) | Tables, payload shapes, `localStorage` keys, sync and reconciliation rules |
| [17 — Privacy and security](17-privacy-security.md) | What is captured and what is deliberately not — and **record-only**, which is this half's promise made into a refusal |
| [18 — Configuration reference](18-configuration.md) | Every environment variable, flag, query parameter, storage key and tuning constant |
| [19 — Limits and known gaps](19-limits-and-known-gaps.md) | Inherent limits, unverified areas, and defects found while writing this |
| [20 — Operations](20-operations.md) | Deploy, migrate, develop, test |

## What is deliberately not here

Create, Logs, test cases, checks, schedules and Connections belong to the other half —
**[“Do it for me”](do.md)**. They are not missing pages; they are somebody else's subject, and the one
place both halves meet is the parts list above.

The whole set, in one table, is [README.md](README.md).
