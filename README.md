# THE DESK — Discord infrastructure

Server provisioning and community tooling for **THE DESK**, an international
trading community built around research, process and execution.

The bot's job is narrow and deliberate: define the server's shape in one
configuration file, and keep the live server in sync with it — safely, and as
many times as you like.

```
EDGE > HYPE            PROCESS > PREDICTION      DATA > OPINIONS
EXECUTION > SIGNALS    RISK MANAGEMENT > GAMBLING
RESEARCH > GURU WORSHIP        LONG-TERM DEVELOPMENT > QUICK MONEY
```

---

## Contents

1. [Requirements](#1-requirements)
2. [Create the Discord application and bot](#2-create-the-discord-application-and-bot)
3. [Intents and permissions](#3-intents-and-permissions)
4. [Invite the bot](#4-invite-the-bot)
5. [Configure `.env`](#5-configure-env)
6. [Install, run, build, deploy](#6-install-run-build-deploy)
7. [First run: provisioning the server](#7-first-run-provisioning-the-server)
8. [How `/setup` works](#8-how-setup-works)
9. [How `/setup-dry-run` works](#9-how-setup-dry-run-works)
10. [Command reference](#10-command-reference)
10b. [Moderation, protection and support](#10b-moderation-protection-and-support)
11. [Server architecture](#11-server-architecture)
12. [Roles and permissions](#12-roles-and-permissions)
13. [Modifying the server structure](#13-modifying-the-server-structure)
14. [Adding channels, roles and events](#14-adding-channels-roles-and-events)
15. [Logging](#15-logging)
16. [Project layout](#16-project-layout)
17. [Recovery and troubleshooting](#17-recovery-and-troubleshooting)
18. [Design decisions](#18-design-decisions)
19. [Future expansion](#19-future-expansion)

---

## 1. Requirements

| | |
|---|---|
| **Node.js** | 20.18.0 or newer (tested on 24.x). `node -v` |
| **npm** | 10 or newer, ships with Node |
| **Discord** | An account with **Manage Server** on the target guild |
| **OS** | Anything Node runs on. Developed and validated on Windows 11 |

Runtime dependencies are just `discord.js` and `dotenv`. TypeScript, ESLint and
`tsx` are development-only.

---

## 2. Create the Discord application and bot

1. Go to <https://discord.com/developers/applications> and click
   **New Application**. Name it `The Desk`.
2. Open **General Information** and copy the **Application ID** — this is your
   `CLIENT_ID`.
3. Open the **Bot** tab.
   - Click **Reset Token**, then **Copy**. This is your `DISCORD_TOKEN`.
     You will only ever see it once. If you lose it, reset it again.
   - **Never commit this token.** If it leaks, reset it immediately —
     a leaked bot token gives a stranger everything the bot can do.
4. Still on the **Bot** tab, turn **off** *Public Bot* unless you intend other
   people to add this bot to their servers.

To get your `GUILD_ID`: in Discord, **User Settings → Advanced → Developer
Mode**, then right-click the server icon → **Copy Server ID**.

---

## 3. Intents and permissions

### Gateway intents (Developer Portal → Bot → Privileged Gateway Intents)

| Intent | Required | Why |
|---|---|---|
| **Server Members Intent** | **Yes** | Assigning `@New Member` on join. Without it, `guildMemberAdd` never fires. |
| Message Content Intent | No | The bot never reads message text. Leave it off. |
| Presence Intent | No | Unused. Leave it off. |

> The bot requests five gateway intents: `Guilds`, `GuildMembers`,
> `GuildModeration` (ban events for anti-nuke), `AutoModerationExecution`
> (so blocked messages are recorded in #moderation) and `GuildVoiceStates`
> (join-to-create voice rooms). Only GuildMembers is privileged. `MessageContent` is deliberately absent — the bot never reads
> message text, and AutoMod evaluates content on Discord's side, not ours.

### Bot permissions

| Permission | Used for |
|---|---|
| Manage Roles | Creating roles, assigning `@New Member` / `@Member` |
| Manage Channels | Creating and updating categories and channels |
| View Channels | Everything |
| Send Messages | Welcome/rules content, announcements, logs |
| Embed Links | All bot output is embeds |
| Attach Files | Reserved for future exports |
| Read Message History | `/clear`, editing published messages |
| Manage Messages | `/clear`, pinning the welcome and rules posts |
| Create Public Threads | `/review` and event discussion threads |
| Send Messages in Threads | Same |
| Manage Threads | Ticket threads and thread moderation |
| Create Private Threads | The ticket system |
| Manage Events | `/event create` and `/event cancel` |
| Moderate Members | `/timeout` and the strike ladder |
| Kick Members | `/kick` |
| Ban Members | `/ban` |
| Mute Members | Running live voice and stage sessions |
| Move Members | Stage moderation, and moving a member into the room they just created |
| **Manage Server** | **AutoMod rules and the server description** |
| **View Audit Log** | **Anti-nuke: attributing destructive actions** |
| Use Application Commands | Slash commands |

The permission integer for exactly this set is **`1505675570358`**.

---

## 4. Invite the bot

Replace `YOUR_CLIENT_ID` and open the URL in a browser:

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=1505675570358&scope=bot%20applications.commands
```

### Role hierarchy caveat — read this one

Discord will not let a bot manage a role positioned **above** its own. After
inviting, open **Server Settings → Roles** and drag the bot's integration role
(the one named after the application, marked *managed*) to **just below
`@Founder`** — above every role it has to assign.

If you skip this, `/setup` reports `Could not reorder roles` and role
assignment silently fails.

> The `@Bot` role in the blueprint is a **cosmetic marker** for labelling bot
> accounts in the member list. It grants nothing. A bot's real permissions come
> from its managed integration role, which Discord creates and which no bot can
> edit — which is why the blueprint does not try to.

---

## 5. Configure `.env`

```bash
cp .env.example .env
```

```dotenv
DISCORD_TOKEN=your-bot-token
CLIENT_ID=your-application-id
GUILD_ID=your-server-id

# optional
LOG_LEVEL=info                # trace | debug | info | warn | error
AUTO_DEPLOY_COMMANDS=true     # register slash commands on startup
DISCORD_LOGGING=true          # mirror logs into #bot-logs
STATE_FILE=data/state.json    # where resolved IDs are remembered
NODE_ENV=development
```

`.env` is in `.gitignore`. Nothing secret is ever written to source, to
`state.json`, or to any Discord channel. Missing variables produce one clear
error at startup rather than a confusing API failure later.

---

## 6. Install, run, build, deploy

```bash
npm install
```

If npm reports that `esbuild` has an unapproved install script (npm 11+),
approve it — `tsx` needs it:

```bash
npm approve-scripts esbuild
```

| Command | What it does |
|---|---|
| `npm run dev` | Run from source with hot reload (`tsx watch`) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled build |
| `npm run typecheck` | Type-check without emitting |
| `npm run lint` | ESLint |
| `npm run verify` | Validate the blueprint offline — no Discord needed |
| `npm run check` | typecheck + lint + verify |
| `npm run deploy` | Register slash commands without restarting the bot |
| `npm run setup:dry` | Provision preview from the CLI. Writes nothing |
| `npm run setup` | Provision the server from the CLI |
| `npm run migrate:types` | Recreate channels whose blueprint type changed |

### Provisioning from the command line

`/setup` in Discord is the normal path. The CLI equivalents exist for two
situations it cannot cover: bootstrapping before slash commands have
propagated, and recovering when something is broken enough that `/setup`
itself will not run.

```bash
npm run setup:dry     # same report, nothing written
npm run setup         # apply
```

They call the same `syncServer()` as the slash command — there is no second
implementation. The CLI connects with the `Guilds` intent only, so it works
even if the privileged Server Members intent has not been enabled yet.

### Deploying to a server

```bash
npm ci --omit=dev      # runtime dependencies only
npm run build          # needs devDependencies; build on CI or before pruning
NODE_ENV=production node dist/index.js
```

Keep it alive with `systemd`, `pm2` or a container. It is a single stateless
process apart from `data/state.json`, which should live on a persistent volume.

An example `systemd` unit:

```ini
[Service]
WorkingDirectory=/opt/the-desk
ExecStart=/usr/bin/node dist/index.js
EnvironmentFile=/opt/the-desk/.env
Restart=always
RestartSec=10
```

---

## 7. First run: provisioning the server

```bash
npm run dev
```

Then, in Discord:

1. `/setup-dry-run` — read what it intends to do. Nothing is written.
2. `/setup` — provision the server.
3. `/server-status` — confirm the result.

First run on an empty server:

```
Created  8 roles
Created  7 categories
Created 23 channels
Published the welcome and rules messages
```

Run `/setup` again:

```
0 created, 0 updated, 38 resources already correct
All required resources already exist. Nothing was changed.
```

That second result is the whole point of the design.

---

## 8. How `/setup` works

`/setup` (Admin+) reconciles the live server against
[`src/config/server.ts`](src/config/server.ts).

**For each role, category and channel in the blueprint:**

1. **Resolve it.** Look it up by the ID remembered in `data/state.json`. If
   that ID is gone, fall back to an exact name match — and when that succeeds,
   re-record the ID, so the server heals itself instead of drifting.
2. **Create** it if it does not exist.
3. **Compare** it if it does: name, topic, slowmode, category, user limit,
   permissions.
4. **Update** only what differs.
5. **Report** what happened, and why.

**Guarantees:**

- **Nothing is ever deleted.** Not channels, not roles, not messages. There is
  no code path in this project that deletes a channel or a role.
- **No duplicates.** A renamed channel is found by ID; a channel found only by
  name has its ID re-recorded.
- **Manual customisations survive.** When permissions are written, overwrites
  for targets the blueprint does not manage — a per-member exception a
  moderator added by hand — are carried through untouched.
- **Channels outside the blueprint are left completely alone**, and listed in
  the report so you know they exist.
- **Failures are isolated.** One resource failing does not abort the rest; it
  is recorded as `failed` with the reason.

**Options:** `publish-content` (default `true`) also publishes or refreshes the
welcome and rules messages. Refreshing edits the existing message in place, so
pins, permalinks and the verification button survive.

---

## 9. How `/setup-dry-run` works

`/setup-dry-run` (Admin+) answers *"what would `/setup` do right now?"* and
writes nothing.

It is not a separate simulation. It calls the same `syncServer()` function with
`dryRun: true`, which suppresses every mutation and nothing else. There is no
second code path that could drift out of agreement with the real one.

Use it:

- before the first run on a real server;
- after editing the blueprint, to see the blast radius;
- when something looks wrong and you do not yet want to change anything.

On a server with no roles yet, permission diffs are reported as
`permissions pending creation of: member, mentor, …` rather than an invented
diff — the roles genuinely do not exist to compare against.

---

## 10. Command reference

Access is enforced twice: Discord's own `default_member_permissions` hides the
command, and the bot re-checks the role on execution. The guild owner and
anyone with Administrator always pass.

### Administration

| Command | Access | Description |
|---|---|---|
| `/setup [publish-content]` | Admin+ | Create or synchronise the server structure |
| `/setup-dry-run` | Admin+ | Show what `/setup` would do. Writes nothing |
| `/server-status` | Moderator+ | Read-only audit of blueprint vs reality |

### Moderation

| Command | Access | Description |
|---|---|---|
| `/warn <user> <offence> <reason>` | Moderator+ | File a strike. The ladder picks the consequence |
| `/warnings show <user>` | Moderator+ | A member's strike record |
| `/warnings clear <user> <reason>` | Admin | Wipe a record |
| `/funded approve<br>/funded decline` | Moderator+ | Decide a funded verification |
| `/clear <amount> [user] [reason]` | Admin | Bulk delete up to 100 recent messages |
| `/kick <user> <reason>` | Moderator+ | Remove a member |
| `/ban <user> <reason> [delete-days]` | Moderator+ | Ban a member |
| `/timeout <user> <minutes> <reason>` | Moderator+ | Mute for up to 28 days. `0` clears it |

Every moderation action is written to `#moderation` as a case record and to
`#bot-logs` as a log line. Discord's role hierarchy is checked first: you
cannot act on someone at or above your own highest role, and neither can the
bot. `/clear` skips pinned messages and anything older than 14 days, because
Discord's bulk endpoint refuses those.

### Community

| Command | Access | Description |
|---|---|---|
| `/event create <type> <date> <time> [host] [title] [notes] [duration]` | Mentor+ | Schedule a session |
| `/event list` | Everyone | Upcoming sessions (posts publicly) |
| `/event cancel <event> [reason]` | Mentor+ | Cancel a session (autocompletes) |
| `/review <instrument> [direction] [session] [private]` | Member | Structured trade review template |
| `/resources [topic] [share]` | Member | Curated books, papers, tools and data |
| `/faq [topic] [search] [share]` | Everyone | The standing answers, searchable |
| `/ticket close [reason]` | Everyone | Close the ticket you are in |
| `/news` | Mentor+ | Post the market digest now |

`/event create` builds a **native Discord Scheduled Event** — members get
RSVPs, reminders and the event banner for free — plus an announcement embed in
`#events` with a discussion thread. Dates and times are **UTC**:
`YYYY-MM-DD` and `HH:mm`.

`/review` posts the template and opens a thread on it, so `#trade-review` stays
a readable index rather than a wall of half-finished reviews. `private: true`
returns a plain-text version only you can see.

---

## 10b. Moderation, protection and support

Three layers, deliberately independent so that a failure in one does not
disarm the others.

### Layer 1 — AutoMod (front end, runs on Discord)

Provisioned by `/setup` from [`src/config/moderation.ts`](src/config/moderation.ts).
These evaluate a message **before it is delivered**, cost nothing at runtime,
and keep working when the bot is offline.

| Rule | Catches |
|---|---|
| Scams and phishing | Fake giveaways, "guaranteed returns", recovery scams, wallet phishing, `copy my trades` |
| Shorteners and loggers | `bit.ly`, `tinyurl`, `grabify`, `iplogger` and friends — links that hide where they go |
| Server invites | `discord.gg/…`, exempt in staff channels |
| Hate speech and sexual content | Discord's maintained Slurs and SexualContent lists |
| Spam | Discord's spam heuristic |
| Mass mentions | More than 6 mentions in one message |

Staff roles are exempt — a moderator quoting a scam to discuss it is not a
scam. Every block is recorded in `#moderation` with the matched keyword.

Two Discord constraints the code now enforces so a config edit cannot break
rule creation: the **timeout action is rejected on preset rules**, and a server
may hold **exactly one preset rule**, so all preset word lists live in one rule
which is matched by trigger type rather than by name.

### Layer 2 — the strike ladder (back end, runs in the bot)

`/warn` files a strike. The moderator chooses the **offence**; the ladder
chooses the **consequence**. That separation is the point — the same behaviour
costs the same regardless of who is on duty.

```
1 point  →  formal warning
2 points →  1 hour timeout
3 points →  24 hour timeout
5 points →  7 day timeout
7 points →  ban

Points expire after 120 days.
Scams and hate speech skip the ladder entirely: immediate ban.
```

The member is DM'd the offence, the reason, their running total and what
happens next. Every strike is written to `#moderation` and survives restarts in
`state.json`. Edit the ladder or the offence table in `config/moderation.ts`.

### Layer 3 — anti-nuke (back end, audit-log driven)

AutoMod only reads messages. It cannot see a compromised admin account mass-
deleting channels. [`src/services/protection.ts`](src/services/protection.ts)
watches the destructive gateway events, attributes each one to an executor via
the audit log, counts them in a rolling window, and acts:

| Trip wire | Threshold |
|---|---|
| Channel deletions | 3 in 30s |
| Role deletions | 3 in 30s |
| Role permission changes | 8 in 30s |
| Bans | 4 in 60s |
| Kicks | 5 in 60s |
| Webhook creations | 3 in 60s |

The response is **quarantine** by default — every role stripped — rather than a
ban, because the usual cause is a stolen session on a trusted account, not the
person themselves. `@Admin` is paged in `#moderation` with what was detected
and what to do next.

**Stated honestly, because a security feature that oversells itself is worse
than none:**

- The **guild owner cannot be stopped**. Discord permits no action against them
  by anyone, including a bot with Administrator.
- Anyone whose highest role sits **above the bot** cannot be stopped either.
- **Deleted channels and their messages are gone.** This limits the blast
  radius; it does not undo it. `/setup` rebuilds the structure, not the history.

Which is why the real defence is upstream: one Administrator holder, the bot's
role kept high, and 2FA on every staff account. Tune the thresholds in
[`src/config/protection.ts`](src/config/protection.ts).

### Tickets

The panel in `#open-a-ticket` opens a **private thread** — no channel-limit
ceiling, no permission overwrite to get wrong, and closing one archives it in
place so the history stays where the staff can find it.

- One open ticket per member at a time.
- `@Moderator` is pinged into the thread on creation.
- Closing (button or `/ticket close`) locks and archives it. **Nothing is ever
  deleted** — an appeal six weeks later needs the original conversation.
- `#open-a-ticket` is visible to `@New Member` on purpose: being unable to get
  in is one of the main reasons to open a ticket.

### FAQ

[`src/config/faq.ts`](src/config/faq.ts) is the single source. It is published
as pinned embeds in `#faq` and searchable with `/faq`. Add an entry and run
`/setup`.

### Self-assignable roles

`#roles` carries three published panels, defined in
[`src/config/selfRoles.ts`](src/config/selfRoles.ts):

- **Language** — International or Italiano. Not access control; the Italian
  area is open to everyone. It just says which language you are comfortable in.
- **Order flow software** — multi-select across 20 platforms that genuinely
  exist and genuinely do footprint / volume-profile / DOM work on real data.
  Makes "how do I set this up" answerable by someone running the same tool.
- **Funded trader** — a button, not a menu.

Selecting is idempotent: your roles in a group are made to match the selection
exactly, so deselecting removes the role instead of leaving it stuck.

Self-assign roles live in a **separate list** from the hierarchy roles
(`SERVER.selfRoles`), hold zero permissions, and are never hoisted — so they
cannot take part in a permission decision even by accident.

### Funded verification

Deliberately not automated. A bot cannot tell a real firm dashboard from a
convincing screenshot, and putting an automatic badge of credibility on
something nobody checked is worse than having no badge.

1. Member presses **Request funded verification** in `#roles`.
2. A **private thread** opens with the staff.
3. They post one piece of proof: a firm dashboard screenshot, a payout
   confirmation, or the funded certificate.
4. A moderator runs `/funded approve <user> <firm>` or `/funded decline`.

The instructions tell members, in both the panel and the thread, to **redact
the account number, legal name, address, balance and payment details** — the
firm name and the account status is the entire check, and the rest is only
worth stealing. They are also told outright that staff will never ask for
credentials, an API key, or money.

### The daily digest

`#news-feed` receives one automated post per day at **06:30 UTC** — after the
Asian session, before the European open — rendered as a fixed-width table:

```
DATE  TIME   SRC   HEADLINE
────────────────────────────────────────────
09-04 09:10  ECB   Philip R. Lane: Diversity at the ECB
09-04 12:32  BLS   Major Economic Indicators Latest Numbers
```

Sources are **primary**, not financial media: the Fed, the ECB, the Bank of
England, the BLS and the SEC. They publish the releases that actually move a
market, on stable free endpoints, without editorialising. A news-media feed
would be higher volume and lower information — which is exactly the "news spam
channel" this server is supposed not to have.

Every URL in [`src/config/news.ts`](src/config/news.ts) was probed before being
committed. Two obvious candidates were dropped for failing that probe: the US
Treasury feed times out, and the BEA endpoint 404s. **If you add a feed, probe
it first** — a silently dead source is worse than an absent one, because the
digest still looks complete.

Feed content is untrusted input from the open internet, so headlines are
stripped of markup and backticks, and the message is sent with mentions
disabled — a headline containing `@everyone` cannot ping the server.

`/news` posts on demand. The schedule only fires while the bot is running; a
missed morning is not backfilled, because a stale digest is worse than none.

### On-demand voice rooms

Joining a **➕ Create …** hub spawns a room and moves you into it; the room is
deleted when the last person leaves.

This is the **one** place the bot deletes a channel, and the constraints are
tight by design: it only removes a channel it created itself, that it still has
recorded in `state.json`, that is empty. The anti-nuke watcher ignores the
bot's own actions, so a busy evening cannot trip it, and a startup sweep clears
rooms that emptied while the bot was down.

The staff hub is restricted **by Discord**, not by the bot: nobody below
Moderator can connect to it at all, so a bug in the handler cannot become a
privilege escalation. The handler re-checks anyway.

### Extra permissions these need

Beyond the invite set in §3, the bot's role also needs:

| Permission | For |
|---|---|
| **Manage Server** | Creating AutoMod rules, setting the server description |
| **View Audit Log** | Attributing destructive actions in anti-nuke |

Grant them in **Server Settings → Roles → your bot**. Without Manage Server the
AutoMod step reports `skipped` with the reason; without View Audit Log the
anti-nuke watcher logs that it is blind rather than failing silently.

---

## 11. Server architecture

Eight categories, 22 channels. Small on purpose — a new member should be able
to understand the whole server in one scroll.

```
START HERE        #welcome  #rules  #roles
                  Read by everyone, written by nobody. The rules message
                  carries the verification button; #roles is members-only
                  and holds the self-assign menus.

THE DESK          #general  #trading-floor  (text)
                  #the-lab  (forum)
                  #news-feed  (text, bot-written)
                  #the-lab is one forum for trades AND research: the same
                  activity at different scales, separated by tags rather
                  than by two half-populated channels.

EDUCATION         #education  (text)   #library  (forum)
                  English only. #library merges lessons, resources and
                  video into one searchable, tagged reference.

LIVE DESK         #live-trading  (text)
                  ➕ Create Trading Room   join-to-create, 6 seats
                  ➕ Create Staff Room     join-to-create, staff only
                  🏛 Auditorium            stage, for hosted sessions
                  No standing voice rooms: an empty channel makes a server
                  look dead, a room that exists only while occupied does not.

EVENTS            #events  (announcement channel)
                  Announcements only; discussion happens in each thread.

ITALIA            #italia  #trading-italia
                  Desk Italia  (voice)
                  Italian-language area. Compact by design — reviews and
                  education are not duplicated, they stay in #the-lab and
                  #library in English.

SUPPORT           #faq  #open-a-ticket
                  Read-only. Tickets are private threads opened from the
                  button. Visible to unverified members on purpose.

STAFF             #staff  #bot-logs  #moderation
                  Invisible to everyone below Moderator.
```

**There are no signal channels, and there will not be.** No `#buy-signals`,
`#calls`, `#entries` or `#vip`. Trade ideas go in `#trading-floor`; trades go
in `#trade-review` with the reasoning attached.

---

## 12. Roles and permissions

```
Founder      Administrator. The only role that has it.
   ↓
Admin        Channels, roles, server settings, webhooks, events.
             Deliberately NOT Administrator — see below.
   ↓
Moderator    Messages, timeouts, kicks, bans, staff channels.
             Cannot manage channels or roles.
   ↓
Mentor       Curates EDUCATION, hosts live sessions, manages events.
             Elevated by channel overwrite, not by server permission.
   ↓
Researcher   Member, plus thread management in #research-lab.
   ↓
Member       Full community access.
   ↓
New Member   #welcome, #rules, #general. No links or files until verified.
   ↓
Bot          Cosmetic label. Grants nothing.
```

**Why `@Admin` does not have Administrator:** the Administrator bit bypasses
*every* channel overwrite, including the ones that keep `#staff` private. Any
role holding it can read every channel regardless of what the blueprint says.
Restricting it to `@Founder` means the permission model is actually enforced
rather than merely described.

**How access is granted:** `@everyone` holds **no** guild permissions at all,
and every category except `START HERE` explicitly denies `ViewChannel` to
`@everyone`. Access is then granted by naming the roles that should have it.
The useful consequence: a channel someone creates manually later is **private
by default** — a safe failure mode rather than an accidental leak.

**New member flow:**

1. Member joins → the bot assigns `@New Member` (needs the Server Members
   intent).
2. They can read `#welcome` and `#rules`, and talk in `#general` — but cannot
   post links or attachments, which removes the main spam vector.
3. They press **"I have read and accept the rules"** on the rules message.
4. The bot adds `@Member`, then removes `@New Member` — in that order, so a
   failure halfway leaves them with more access rather than none.

`#welcome` and `#rules` are readable by `@everyone`, not just `@New Member`.
That is deliberate: if role assignment ever fails, a new arrival can still read
the rules and verify themselves out of the hole.

### Verifying the permission model

```bash
npm run verify
```

This runs an **independent re-implementation** of Discord's permission
resolution algorithm against the blueprint and asserts what each role can
actually do in each channel — that `@Member` cannot see `#staff`, that
`@New Member` cannot attach files in `#general`, that `@Mentor` can post in
`#lessons` and `@Member` cannot, and so on. 309 checks, no network access.

A test that called into `src/permissions/` would only prove the code agrees
with itself. This one would catch the day someone "simplifies" the layering
rules and quietly opens `#staff` to everybody.

---

## 13. Modifying the server structure

Everything about the server's shape lives in
[`src/config/server.ts`](src/config/server.ts). No channel ID, role name or
permission is hardcoded anywhere else.

The workflow is always the same:

1. Edit `src/config/server.ts`.
2. `npm run verify` — catches structural mistakes and permission regressions
   offline.
3. `/setup-dry-run` in Discord — see what would change.
4. `/setup` — apply it.

> **`key` is permanent, `name` is not.** The `key` is how a resource is
> remembered in `state.json`. Change a `name` and `/setup` renames the live
> channel. Change a `key` and `/setup` treats it as a brand-new resource and
> creates a duplicate.

---

## 14. Adding channels, roles and events

### Add a channel

```ts
// in src/config/server.ts, inside the relevant category
{
  key: 'options-desk',        // permanent identifier
  name: 'options-desk',       // lowercase-hyphen for text channels
  type: 'text',               // 'text' | 'voice'
  topic: 'Volatility, skew, structure. Bring the surface.',
  rateLimitPerUser: 30,       // optional slowmode, seconds
  overwrites: [               // optional; layered over the category
    ...allowRoles(['researcher'], ['ManageThreads']),
  ],
}
```

Then `npm run verify`, `/setup-dry-run`, `/setup`.

Channel overwrites are **layered over** the category's, and the channel layer
wins in both directions — so a channel can be *stricter* than its category, not
only more permissive. Within a single layer, `allow` beats `deny`, which is
what lets `EDUCATION` say "members cannot post" and "mentors can" at once.

### Add a role

```ts
// in src/config/server.ts, in `roles`, ordered high → low
{
  key: 'contributor',
  name: 'Contributor',
  color: 0x7a8b99,
  hoist: false,
  mentionable: true,
  permissions: MEMBER_GUILD_PERMISSIONS,   // from config/permissionPresets.ts
  purpose: 'Shown in /server-status. Documentation only.',
}
```

Position in the array **is** the hierarchy. `/setup` reorders the managed roles
among the slots they already occupy, so roles belonging to other integrations
keep their relative place.

New roles usually need channel access too — add them to `COMMUNITY`, `STAFF`,
`EDUCATORS` or `LEADERSHIP` near the top of `server.ts`, or give them their own
overwrites.

### Add a recurring event format

```ts
// in src/config/events.ts
{
  key: 'order-flow-lab',
  title: 'THE DESK — Order Flow Lab',
  summary: 'One session, read tick by tick.',
  agenda: ['Context', 'The tape', 'What we got wrong'],
  voiceChannelKey: 'voice-study-room',   // must exist in server.ts
  durationMinutes: 90,
  typicalHost: 'mentor',
  recurrence: 'Tuesdays 16:00 UTC',      // documentation for now
}
```

It appears in the `/event create` picker on the next command deploy. No code
change is needed.

### Change the welcome text, rules or resources

- Welcome and rules: [`src/config/content.ts`](src/config/content.ts)
- Resource library: [`src/config/resources.ts`](src/config/resources.ts)
- Trade review template: [`src/config/review.ts`](src/config/review.ts)
- Colours and tone: [`src/config/branding.ts`](src/config/branding.ts)

Run `/setup` to push updated welcome/rules text — the existing messages are
edited in place.

---

## 15. Logging

Everything goes to the console; `info` and above is mirrored into `#bot-logs`,
batched to stay inside Discord's rate limits.

```
[SETUP] Created category: THE DESK
[SETUP] Created channel: #trading-floor
[SETUP] Updated role: @Moderator (permissions)
[MEMBER] someone#0001 joined — assigned @New Member
[MEMBER] someone#0001 accepted the rules — promoted to @Member
[MODERATION] TIMEOUT: someone#0001 (1234…) — 10 minutes by mod#0002 — spam
[EVENT] Created scheduled event: THE DESK — Market Review at 2026-09-09T15:00:00Z
[ERROR] /ban failed for mod#0002
```

Logged: setup start and completion, every resource created or updated,
permission changes, member joins and verifications, moderation actions, event
creation and cancellation, and command errors.

**Sensitive detail never reaches Discord.** Stack traces, API URLs and raw
error payloads go to the console only; the channel gets a readable summary. Set
`LOG_LEVEL=debug` for per-command timing, or `DISCORD_LOGGING=false` to keep
everything local.

---

## 16. Project layout

```
src/
├── index.ts                     Entry point, process handlers, shutdown
├── config/
│   ├── env.ts                   Validated environment
│   ├── server.ts                ★ THE BLUEPRINT — roles, categories, channels
│   ├── permissionPresets.ts     Permission bundles and overwrite helpers
│   ├── content.ts               Welcome and rules text
│   ├── events.ts                Recurring session formats
│   ├── moderation.ts            ★ Offences, strike ladder, AutoMod rules
│   ├── protection.ts            ★ Anti-nuke thresholds and response
│   ├── channelGuides.ts         The pinned card in each channel
│   ├── faq.ts                   FAQ entries
│   ├── selfRoles.ts             Self-assign menus, software list
│   ├── news.ts                  Digest feeds and schedule
│   ├── resources.ts             Curated library
│   ├── review.ts                Trade review template
│   └── branding.ts              Colours, principles, presence, tone
├── core/
│   ├── client.ts                Gateway client and intents
│   ├── command.ts               Command contract and registry
│   └── deploy.ts                Slash command registration
├── commands/
│   ├── index.ts                 The command list
│   ├── admin/                   setup, setup-dry-run, server-status
│   ├── moderation/              warn, warnings, clear, kick, ban, timeout
│   └── community/               event, review, resources, faq, ticket
├── events/
│   ├── index.ts                 Gateway listener wiring
│   ├── ready.ts                 Startup checks
│   ├── interactionCreate.ts     Dispatcher: auth, deferral, buttons, errors
│   ├── guildMemberAdd.ts        Join role assignment
│   ├── protection.ts            Anti-nuke gateway listeners
│   └── autoModExecution.ts      Records AutoMod blocks in #moderation
├── permissions/
│   ├── overwrites.ts            Spec → Discord overwrites, layering, diffing
│   └── guards.ts                Command authorisation, hierarchy checks
├── services/
│   ├── provisioning/
│   │   ├── provisioner.ts       ★ syncServer() — the idempotent engine
│   │   ├── finalise.ts          Content + AutoMod, after the structure exists
│   │   ├── report.ts            Report rendering
│   │   └── types.ts             Outcomes and counts
│   ├── state.ts                 Persistent key → snowflake store
│   ├── resolve.ts               ID-then-name resource resolution
│   ├── logger.ts                Console + #bot-logs transport
│   ├── content.ts               Welcome/rules publishing
│   ├── membership.ts            Join role, verification
│   ├── warnings.ts              Strike store and ladder enforcement
│   ├── automod.ts               AutoMod rule provisioning
│   ├── protection.ts            Anti-nuke watcher
│   ├── tickets.ts               Ticket lifecycle
│   ├── publishing.ts            Channel guides, FAQ, roles, description
│   ├── mentions.ts              {{#channel}} → clickable link resolution
│   ├── selfRoleService.ts       Role menus and funded verification
│   ├── voiceRooms.ts            Join-to-create rooms
│   ├── news.ts                  RSS digest
│   ├── scheduler.ts             Daily job timing
│   ├── health.ts                Optional HTTP health endpoint
│   ├── eventService.ts          Discord Scheduled Events
│   └── moderationLog.ts         Moderation case records
├── scripts/
│   ├── deployCommands.ts        npm run deploy
│   ├── setupServer.ts           npm run setup / setup:dry
│   ├── migrateChannelTypes.ts   npm run migrate:types
│   └── verifyBlueprint.ts       npm run verify
├── types/
│   ├── index.ts                 Blueprint types
│   └── state.ts                 Persisted state shape
└── utils/
    ├── errors.ts                Error translation, safe user messages
    └── format.ts                Discord limits, chunking, timestamps
```

`data/state.json` is written at runtime and gitignored. It holds only Discord
IDs — no secrets. Deleting it is not destructive: setup falls back to matching
by name and re-records everything.

---

## 17. Recovery and troubleshooting

| Symptom | Cause and fix |
|---|---|
| **Someone deleted a channel** | Run `/setup`. It is recreated with the correct permissions. Its messages are gone — Discord cannot restore those. |
| **Someone renamed a channel** | `/setup` renames it back; the blueprint is the source of truth. To keep the new name, change `name` in `server.ts` (never `key`). |
| **`state.json` was deleted** | Harmless. Resources are re-matched by name and the file is rebuilt on the next `/setup`. |
| **`Could not reorder roles`** | The bot's integration role sits below the roles it manages. Drag it just under `@Founder` and re-run. |
| **New members get no role** | The **Server Members Intent** is off in the Developer Portal. They can still self-verify from `#rules`. |
| **Slash commands missing** | `AUTO_DEPLOY_COMMANDS=false`, or the bot was invited without `applications.commands`. Run `npm run deploy`, or re-invite with the URL in §4. |
| **`Missing Permissions` in the report** | The bot lacks Manage Roles / Manage Channels, or is trying to edit something above it. Check §3 and the hierarchy caveat in §4. |
| **A channel is reported `failed` with a type conflict** | A channel of that name exists with a different type (e.g. `#welcome` as voice). Rename or remove it, then re-run. |
| **Nothing in `#bot-logs`** | It does not exist until the first `/setup`. Until then the console is the record. |
| **Bot will not start** | Missing environment variables are reported by name at startup. Check `.env` against `.env.example`. |

---

## 18. Design decisions

Documented so the reasoning survives the next maintainer.

**One code path for setup and dry run.** `/setup-dry-run` calls `syncServer()`
with `dryRun: true`. A separate simulation would eventually lie.

**Match by ID, then by name.** IDs survive renames; names survive a lost state
file. Together they make duplicates structurally very hard to produce.

**Never delete.** No code path in this project deletes a channel, role or
message. Recovering from an over-eager sync is not possible on Discord;
deciding not to delete is.

**Preserve unmanaged overwrites.** Setup rewrites only the targets the
blueprint names, and carries everything else through. A moderator's manual
per-member exception is not our business to erase.

**Channel permissions are written in full.** Each channel receives the union of
its category's and its own overwrites rather than relying on Discord's category
"sync", so effective permissions are explicit and independently verifiable.

**Administrator only for `@Founder`.** It bypasses every channel overwrite. A
permission model that any staff role can bypass is decoration.

**`@everyone` holds nothing.** Access is granted, never assumed, so a
manually-created channel is private by default.

**Voice channel topics are documentation only.** Discord does not expose a
settable topic on voice channels, so the blueprint's `topic` for a voice room
is shown in `/server-status` and never pushed.

**Native Scheduled Events over custom messages.** RSVPs, reminders and the
event surface already exist; re-implementing them in embeds would be worse in
every respect.

**No `MessageContent` intent.** The bot has no feature that reads message text,
so it does not ask for the privilege. `/clear` works through the REST API.

**Errors are translated at one boundary.** `interactionCreate` catches
everything, maps it to a user-safe message, and logs the detail locally. Handlers
throw `OperationalError` and otherwise assume success.

---

## 19. Future expansion

The foundation is built to carry these; none are implemented, on purpose.

| Feature | Where it slots in |
|---|---|
| Automated event reminders / recurring scheduler | `services/eventService.ts` — presets already carry a `recurrence` hint |
| Full onboarding, screening, role selection | `services/membership.ts` — the verification button is the seam |
| Reputation, XP, levels, leaderboards | New service + a table in `state.json` (or swap `state.ts` for SQLite) |
| Trade journal, trading statistics | Extend `/review`; persist submissions instead of only rendering them |
| Strategy database, resource search | `config/resources.ts` is already structured data |
| Economic calendar, market events | New service publishing into `#market-context` |
| AI-assisted trade review | New command reading the `#trade-review` thread |
| Content tagging, educational progression | Thread tags on `#lessons` |

Two rules for extending it:

1. **Anything about the server's shape goes in `config/server.ts`.** If you find
   yourself writing a channel ID into a service, stop.
2. **Anything long-lived goes in `state.ts`.** When it outgrows a JSON file,
   replace that one module — nothing else touches the storage layer.

---

*THE DESK. No signals, no guarantees, no shortcuts.*
