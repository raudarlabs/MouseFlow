# Hivelink — the plan

*Written 2026-10-16, from the owner's answers of the same day. The first product (`do`, "Do it for me")
is now **Hivelink**: the machine acts, and there can be many machines. Recording stays in the other
product ("Make it reusable"), which is not touched for now.*

> Owner, 2026-10-16:
> - the local agent installs on several computers at once; each gets a name; the account lists them all
>   and gives each its own commands;
> - recording is not part of Hivelink: "we give a command to a remote computer, we do not show it";
> - Skills and Tests become one component; MCP is part of Hivelink; the home screen is a dashboard that says
>   how many agents are connected, how many are online and how many worked over the window.

## 1. What shipped first (step H0 — web only, no migration)

| | What | Where |
|---|---|---|
| Name | `PRODUCTS.do.name = 'Hivelink'`; id stays `do`. `DEFAULT_PRODUCT` is now `do` | `web/src/lib/product.ts` |
| Menu | Overview, Create, Logs, Skills, MCP | `SCREENS` |
| Overview `/overview` | Hivelink's home. Machines = device tokens labelled `This computer`; *online* = the token was used in the last minute (the agent polls every 3 s and `byDeviceToken` writes `last_used_at` on every call); runs = `GET /api/insights?half=ran` | `web/src/features/overview/OverviewView.tsx` |
| Skills + Tests | One screen at `/saved`. A test case is a skill plus checks (`user_case.flow_id` is required), so a skill's checks are drawn in the skill's own row; "Add checks" writes a case; a case whose skill is not listed is shown at the bottom, never hidden. `/tests` redirects to `/saved` | `web/src/features/saved/SavedSkillsView.tsx`, `web/src/features/tests/cases.tsx` |
| MCP `/ai` | The address with `?profile=do`, the three ways to connect, who is connected (`/api/oauth?do=grants`, revocable), and the tools of the `do` profile. The public page `/mcp` stays | `web/src/features/ai/AiView.tsx`, `PROFILE_TOOLS` in `web/src/lib/mcp-facts.ts` (pinned against `api/_mcp-tools.mjs`) |

What Overview deliberately does **not** show yet: which machine ran which job, and machine names. A run does
not record its machine today, so a per-machine number would be invented. Both arrive with step H1.

## 2. What blocks many machines today (measured 2026-10-16)

1. **The server has no machine.** Every agent has its own `mf_` token, but `byDeviceToken`
   (`api/_session.js`) returns only the user. The claimer is the free-text `worker` name
   (`Environment.MachineName` / `Host.current().localizedName`) — not unique, spoofable, changes on rename.
2. **One job per account.** `queueOne` refuses as *busy* while anything is queued or claimed for the
   account (`api/_queue.mjs`), and `dueNow` does the same.
3. **Liveness is per account** (`user_pref 'worker.seen'`, `agent.steps.seen`), and so are
   `mouseflow_stop`, `mouseflow_status`, the 45-minute stale sweep and Telegram.
4. **`?worker=step|report|state` match the job by id and user only**, never by who claimed it.
5. **Pairing needs a browser on that machine** (`POST /account` over loopback), and every token is labelled
   "This computer".
6. **No auto-update**, and the Windows agent cannot autostart when piped — a fleet that drops out on reboot.

## 3. The sequence

### H1 — the machine as a server-side entity (migration: approval required)
- `db/025_device.sql`: `device_token` gains `name`, `kind` (agent/extension), `hostname`, `platform`,
  `agent_version`, `caps jsonb`, `seen_at`, `taking`; a name unique per account. `device_id` on
  `run_queue`, `user_run`, `user_schedule`, `user_case` (NULL = any free machine).
- `whoIsCalling` carries `deviceId`; the claim stamps `seen_at` and the self-reported facts.
- *Busy* per machine; a job with no pin goes to the first free machine.
- `step`/`report`/`state` require `claimed_by = deviceId`; stop, status and the stale sweep per machine.
- **Works with 0.29.0 agents unchanged** — each already presents its own token.

**Built 2026-10-16; `db/025_device.sql` written and NOT applied** (it needs the owner's go-ahead and a
machine with `.env.local`). As built:
- `byDeviceToken` returns `deviceId`. The claim stamps `seen_at`/`hostname` on the token, records
  `claimed_device`, gives a machine that already holds a job no second one, and matches a pin
  (`run_queue.machine`) against the device id as well as the old computer name.
- `queueOne(…, { device })` checks the machine is the account's and not revoked (`no-device` otherwise).
  *Busy* (`busyFor`): a pinned job waits only for its machine; an unpinned one queues while fewer jobs are
  in flight than agents online (at least one). `dueNow` uses the same rule (`roomForOne`).
- `?worker=step|report|state` answer only the machine that took the job; the report stamps
  `agent_version`/`platform` when the agent sends them.
- `GET /api/sync?tokens=1` carries `name`, `hostname`, `platform`, `version`, `seenAt` and, once
  `claimed_device` exists, `jobs` per machine over 30 days. `PATCH /api/sync?token=<id>` names a machine
  (unique per account). `POST /api/queue` takes `device`.
- Overview shows each machine by its name (click to rename), the computer name it reported, what it is
  running and how many jobs it did in 30 days.
- **Before 025 is applied** everything still works: per-machine busy and the taker check use `to_jsonb`
  and are simply inert where the column is missing; naming answers 503 with the reason; Overview says the
  per-machine count is not made yet. After it is applied, all of it starts working with no further change.

### H2 — Devices and commands
- `api/devices.js`: list (name, platform, version, online, current job, last run), rename, pause/resume
  taking work (the agent learns it from the claim answer), revoke.
- `/api/queue` takes `device` or `devices[]`; a broadcast is N rows with one `batch_id`.
- Commands from what the agent already does: run a skill (with arguments), a goal in words, stop, and a new
  "screenshot now". Recording commands stay out of Hivelink.
- `/devices` screen; a machine picker on Create, Skills and schedules; a Machine column in Logs; Overview's
  per-machine numbers.

**Built 2026-10-16** (same migration, 025, extended with `device_token.paused` and `user_schedule.machine`):
- `/devices`: every attached machine with status (online / paused / offline), its name (click to rename),
  what it is doing now with **Stop**, jobs in 30 days, agent platform and version; **Pause/Resume** and
  **Remove** (revoke, pressed twice).
- **A command to one machine or several**: a goal in words or a skill with its values, picked machines as
  the addressees. `POST /api/queue` with `devices[]` makes one row per machine and answers `queued` and
  `refused` with each refusal in words; at most 50.
- **Pause from the account** is the server saying "no work" on the claim — so it works on any agent version.
  A paused machine gets no pinned job and gives no free seat.
- **Skills** runs and schedules on a chosen machine; a schedule pinned to a machine waits for that machine,
  and its jobs carry the pin. `api/schedules.js` says when the pin could not be written.
- **Logs** has a Machine column (and in the CSV): the machine that took the job, else the one it is pinned
  to, else the name it reported.
- Not in H2, deliberately: a "screenshot now" command needs agent 0.30 (H3); Create still runs on the
  computer the browser is on (a machine picker there means moving its loop onto the queue); MCP and
  Telegram get `device` in H5.

### H3 — enrolling many machines without a browser on each (agent 0.30.0)
- An enrolment code from the account (short-lived, optionally N uses for a batch):
  `… --enroll CODE --name "Office-3"`; the agent trades it for its own token at `POST /api/devices?enroll`.
- Or the agent shows a code in the tray / menu bar and the person types it in the account.

### H4 — packaging and updates
- Windows: a signed installer (.NET 10, SPLIT-PLAN §6.3) or at least a script that saves the agent to a
  file and registers autostart. macOS: the signed `.dmg` exists and waits for notarisation.
- Auto-update, or an `update` command against a version manifest.

### H5 — scale, safety, the other doors
- Ten machines polling every 3 s is ~290k requests a day per account against Vercel and Neon: idle backoff
  to 10–15 s first, a push channel only if measured necessary. Vercel Pro is likely (cron, durations).
- An audit line per command (who sent what to which machine), an on-screen mark on the machine while a
  remote job runs, a local pause the server cannot override, per-machine revoke.
- MCP `hivelink_devices` and a `device` argument on `do`/`run`; Telegram `/machines` and `/use NAME`.

## 4. Open questions for the owner

1. Commands beyond skill / goal / stop / screenshot — shell commands? (new, and the riskiest)
2. Who manages a fleet: the account owner only, or a team with several admins?
3. What a typical fleet runs on — if Windows, H4's Windows half moves up to H2.
4. The second product's name, when it is decided.
5. Whether Hivelink gets its own repository — see §5.

## 5. One repository or two

Not yet. The agent binaries (~7k lines of Swift, ~7k of PowerShell/C#), the decision engine (`_step`,
`_brain`, `_expect`, `_case`), the extension and the deployment are shared, and every fix to them would have
to be made twice. The moment to split is when Hivelink gets its own deployment and database (SEPARATION-PLAN
steps 1–2) and the shared parts stop changing weekly — then a fork with history, or a monorepo with
`apps/hivelink`, `apps/make` and `packages/engine`, is a mechanical move.
