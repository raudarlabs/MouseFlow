# Two products, two accounts, one deployment — the plan

*Written 2026-10-01, from the owner's answers of the same day: **P1 "Do it for me" leads; the two products
are split completely; two accounts; one deployment for now.** SPLIT-PLAN.md split the SCREENS and the
builds; this plan splits the PEOPLE and their data. Nothing here is built yet. Every migration in it waits
for explicit approval, as always.*

---

## 1. What is true today (measured, not assumed)

**Identity is Neon Auth** (a hosted Better Auth). Users live in `neon_auth."user"`, which Neon manages;
our tables carry `user_id uuid` with no foreign key. One Neon Auth instance means **one email namespace**:
the same address cannot be two users. The session cookie is host-only (api/auth.js strips Domain).

**Credentials all hang off that one user id**: `device_token` (agents, the extension, the panel),
`oauth_client/code/token` (MCP; scope `mcp`, no product in it), `chat_sender` (Telegram), `team_invite`.

**The server never knows which product is asking.** The only product signal on the wire is MCP's
`?profile=`. The web decides the product from the URL, then localStorage, then a build-time lock.

**Data, by product:**

| P1 only | P2 only | Both |
|---|---|---|
| `run_queue`, `user_case`, `run_artifact`, `chat_sender`/`chat_draft`, `app_memory` | `user_doc`/`_version`, `flow_digest`, `flow_text`, `chat_thread`/`chat_message` (Assistant), `gallery_skill`, all team tables | `user_flow` (recordings are P2's, goal skills are both), `user_run` (agent runs P1, replays P2), `user_schedule`, `user_pref`, `model_call` |

**Where the products touch each other today:**
1. A goal skill made in Record (P2 SkillWizard) shows in P1's Skills, and Create's "Save as skill" imports
   its code from `features/record`.
2. One `/api/sync` pull returns every flow and every run to both.
3. P2's Dashboard and Assistant read P1's agent runs; Teams counts them.
4. MCP `mouseflow_run` runs any flow, recordings included; schedules are shared.
5. The agent holds **one** device token — one account per machine. The extension hard-codes one app URL.

**Found while reading, and a bug regardless of the split:** deleting an account (api/account.js) does not
touch `user_doc`, `user_doc_version`, `app_memory`, `chat_sender`, `chat_draft`, `flow_digest`,
`flow_text` or `model_call`. A deleted person's documents and Telegram binding survive them. **Fix first.**

## 2. The decision that shapes everything: what "two accounts" means

"Two accounts" with ONE Neon Auth is not possible as the words say — one instance, one email, one user.
So there are exactly two honest shapes:

**A. Two identity systems.** P1 keeps today's Neon Auth; P2 gets its own. Same email, two unrelated users,
two passwords. Every table then separates **by itself**, because every row is keyed by a user id that
belongs to only one product — no `product` column anywhere. *Cost:* Neon Auth lives in a database's
`neon_auth` schema, so a second instance almost certainly means a **second Neon database** (to confirm
with Neon before committing — this plan assumes it). One Vercel deployment still serves both: the request's
**host** picks `DATABASE_URL` + `NEON_AUTH_BASE_URL`. Migrations are applied to both databases.

**B. One identity, two data spaces.** One sign-in works in both, but a `product` column on every
credential and every shared table keeps the data apart, and each product sees only its own. *Cost:* ~12
tables gain a column and every query a condition — the kind of change where one forgotten `where` leaks.
And it is not what was asked: it is one account wearing two hats.

**Recommendation: A.** It is what "completely split" means, the isolation is structural rather than a
condition somebody must remember, and the code barely changes — it is the same app pointed at two
databases. B is cheaper only until the first leak.

## 3. The sequence

### Step 0 — things that need no decision (start now)
- **0a. Account deletion covers every table** (the bug above), with a pin that lists `user_id` tables
  from the migrations and fails when one is not in the delete.
- **0b. The server learns the product.** One `productOf(req)` from the host (and `?profile=` for MCP),
  used by `whoIsCalling`, CORS and limits. Today it answers `do` everywhere except where `?profile=make`
  says otherwise; nothing changes behaviour until step 1.
- **0c. Cut the code-level crossings.** "Save as skill" moves out of `features/record` into shared code;
  P1 screens stop importing from P2 folders (pinned by a check that forbids it).
- **0d. The product is locked by host at runtime**, not only at build time — the same bundle serves both
  hosts, so the lock has to come from the address.

### Step 1 — a second address (owner: the domain)
- A second domain on the **same** Vercel project (e.g. `mouseflow-docs…` for P2; `mouseflowapp` stays P1).
- `SHIPPED_ORIGINS` in both agents, `OURS` in CORS, the extension's host list and the manifest learn it.
- The P2 `.dmg` gets `MFAllowOrigin` = the P2 address (today both images carry P1's).

### Step 2 — P2's own identity (shape A)
- A new Neon project for P2, with Neon Auth enabled; its env vars on the same Vercel project under
  P2-specific names; `DATABASE_URL`/`NEON_AUTH_BASE_URL` chosen by `productOf(req)`.
- All migrations applied to it (a fresh database: nothing to migrate *in* it).
- Sign-in, sign-up, reset and Google OAuth configured for the P2 address (trusted origins per instance).

### Step 3 — each product stops offering the other's things
- P1 hides nothing it has; P2's Record/Skills/Docs/Dashboard/Teams read only P2's database — so P1's runs
  simply are not there. The switcher in the sidebar goes away for good; each address is one product.
- MCP: the OAuth server answers per host, so a connector added for P2 can only ever see P2's account.
  `?profile=` stays as a narrowing, but the account is already the boundary.
- Telegram is P1's (pairing uses a P1 device token) — no change.
- Admin reads both databases, one tab each.

### Step 4 — the existing rows (a migration: approval required)
Today everything is in one account in P1's database. Two ways out:
- **Move:** the owner signs up on P2; a one-off script copies P2's rows (recordings, documents, digests,
  transcripts, Assistant threads, Gallery authorship, teams) to the new user id in the new database, then
  removes them from P1's. Goal skills made from recordings are copied to both.
- **Start P2 fresh:** nothing is moved; P2 begins empty. There are no outside users yet, so this is honest
  and far cheaper — the owner's recordings stay readable in P1's database until deleted.

**Recommendation: start fresh**, unless the owner's own recordings are wanted in P2.

### What stays shared, on purpose
The code, the deployment, the agents (one binary; the image decides the mode), the extension (one build,
told which address it serves when paired), the engine (`_step`, `_brain`, `_expect`, `_case`), and the
model-spend limits (already named per product).

## 4. What P1 — the main app — does next

In order, and why:
1. **Ship the Mac app.** Built and signed; waits only for the owner's notarisation profile. Removes the
   Xcode tools and `curl | bash` from the first five minutes.
2. **Step 0 above** — the deletion bug is real today, and 0b–0d cost nothing and unblock the rest.
3. **A browser of our own in the agent** (probe passed 2026-10-01, Google sign-in survives relaunch): runs
   in a dedicated Chrome the person logged into once, driven over a pipe — so a run and the person can
   share a machine. This is P1's biggest product change: "it works while you work".
4. **Threads with memory** (§5.5-B, owner: yes) — "now do the same for March" knows what "the same" was.
   Its own plan first: it is a second kind of memory.
5. **Steps 1–3 of the separation**, once the P2 domain and the Neon question are answered.
6. Later, as the owner decided: Windows packaging, mobile beyond Telegram, the per-step gate (not for now).

## 5. What the owner is asked

1. **Shape A or B** (§2). Recommendation: A.
2. **The P2 address** — a name for the second domain.
3. **Move or start fresh** (§3, step 4). Recommendation: start fresh.
