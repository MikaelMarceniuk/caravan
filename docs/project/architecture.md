# Caravan — Architecture

> Technical reference document. Product, scope and roadmap are in [`planner.md`](./planner.md); the screens, in [`design/`](../design).
> Last revised: 2026-10-24. Domain vocabulary: [`CONTEXT.md`](../../CONTEXT.md).

---

## 0. Agreed decisions

| # | Decision | Reason |
|---|---|---|
| D1 | **Authoritative server with versioned ops** (not CRDT) | The consistency problem becomes visible and testable on the backend |
| D2 | **Trip → Stop → Day → Activity** hierarchy | The design organizes the trip into stops (Overview) |
| D3 | **Days are not free-standing entities**: they are a stop's indexes (`0..nights-1`) | They come from the stop's dates; no `day.create/delete/reorder` (revised in D12) |
| D4 | **Activities ordered by time**; a fractional position only breaks ties | An itinerary is chronological; the design always shows it in time order |
| D5 | A single **`packages/core`** decides ops on the client and on the server | The rules can't diverge; the logic is 100% testable without I/O |
| D6 | ~~Conflicts detected on the server and stored per user~~ | **Superseded by D22** (edit lock): with no offline editing, there are no conflicts to store |
| D7 | **Documents/attachments wait for v2** | Scope cut; offline in the MVP = seeing the plan, not the files |
| D8 | **Android comes later**, but everything outside `apps/web` is platform-agnostic | The mobile app must be "UI only" when it arrives |
| D9 | Better Auth: **email+password** in v1, plus an anonymous session for "Try the demo"; Google and Apple later; **no magic link** | Drizzle adapter; `anonymous` and Expo plugins. A magic link shows nothing about the architecture, and password + invite already cover sign-in |
| D10 | Places through **Photon** (OSM) proxied by the API | Nominatim's usage policy forbids autocomplete |
| D11 | **Everything on one ARM VPS** (web + API + Postgres + Redis), same origin, Caddy + Cloudflare | Lock latency, cost, and a compose file that reproduces production. Details in [`deploy.md`](./deploy.md) |
| D12 | **Activity anchored to the stop** (`stopId + dayIndex`), not to an absolute date | Moving, extending or pushing a stop is 1 op and carries the activities along; the date is derived (`stop.arriveDate + dayIndex`) |
| D13 | **A day that disappears neither rejects nor moves activities**: they become "outside the dates" of the stop | An activity created on a day removed at the same time is not lost; shortening is reversible |
| D14 | **Stop overlap is a hard invariant**: the server rejects it and the form reopens with the user's data | The Overview never shows an invalid state; activities can only be created on an already confirmed stop, so nothing depends on a rejected stop |
| D15 | **The server broadcasts effects, not just ops**: `ack`, broadcast and `welcome` carry `effects: Mutation[]`; the client's `confirmed` only applies them | Clients on different versions can't diverge; server values arrive ready; `decide` on the client only serves the optimistic view. State hashes only in tests |
| D16 | **Every decided op gets a receipt** (`op_receipts`), rejected ones included | A resend after a dropped connection doesn't change the outcome; "same response for the same `opId`" becomes a testable property |
| D17 | **Two-phase synchronous `decide`**: `requirements(op)` → prefetch in the API → `decide` | `core` stays pure and synchronous on both sides; per-op I/O inside the lock is explicit and minimal |
| D18 | **Members and trip deletion are system ops** in the same versioned log | Total order between plan and permissions; members visible offline; feed and broadcast for free |
| D19 | **No snapshots in the MVP**; `ops_log` and tombstones kept, receipts for 7 days | The full-state `welcome` comes from the projection; pending ops only live in memory (seconds), so receipts don't need to last longer |
| D20 | ~~The tab that creates the op writes it to IndexedDB before telling the leader~~ | **Superseded by D23**: with no persisted queue, there is no leader and no queue in IndexedDB |
| D21 | **`Activity` in the domain and the protocol**; "card" is only the visual component (`ActivityCard`, `CardSheet`) | The op type name is a contract (P7); the Agenda and mobile don't show cards. Glossary in [`CONTEXT.md`](../../CONTEXT.md) |
| D22 | **Edit lock per entity**: only one person at a time edits an activity, a stop, a day title or the trip header | Removes concurrent write conflicts at the source; the UI shows "Ana is editing" and blocks the rest |
| D23 | **Read-only offline**: the plan is cached (IndexedDB + Service Worker) for reading; editing needs a connection | Keeps the value at the airport/in roaming without an offline queue, long-running rebase or persisted conflicts |
| D24 | **Edit locks in Postgres** (`edit_locks`), checked **inside the op's transaction**; Redis only for ephemeral data | What the product promises lives in the database; what is ephemeral lives in Redis. No race window, and the lock still holds with Redis down |
| D25 | **Hot-path performance tweaks**: the lock is checked in the same database round trip as the prefetch; locks are renewed in batches per instance; `edit_locks` is `UNLOGGED` with no index on `expires_at`; local delivery through Bun's native pub/sub | The lock in Postgres costs ~0.1 ms in an edit of 50–200 ms; the real bottleneck is the cursor fan-out, handled with native pub/sub |
| D26 | **`Place` = `{ name, lat, lon, countryCode, osmId }`**, stored whole in `place_json` from v1 | `lat/lon` is the format of every open-source map (MapLibre, Leaflet, OpenLayers) and every OSM tile source: the map can be swapped with no migration. Photon already returns everything, so storing it before the map exists costs nothing |
| D27 | **Map with MapLibre GL JS + OpenFreeMap tiles**; no Google Maps, no fallback and no tile server of our own | All open source, free and keyless; the library runs in the browser, so there is no container. Changing the tile source later means changing a URL in the style |
| D28 | **UUIDv7 IDs, `uuid` column**: what is born on the client (stops, activities, `opId`) uses `core`'s `newId()` (the `uuid` lib, `v7()`); what the server creates (users, trips, email invites) uses Postgres's `DEFAULT uuidv7()`. The server validates every ID coming from the client (section 18) | The `opId` must be born on the client for resends to be idempotent (D16), and so must the entity ID, so the optimistic UI doesn't have to swap temporary IDs. One function in the browser, in Bun and in RN; v7 is time-ordered, so INSERTs go to the end of the index |
| D29 | **Zod 4 validation everywhere**: schemas live in `core` and are used for WS ops and messages, for Elysia's REST routes (through Standard Schema, with Eden inferring the types) and for the clients. No Elysia `t` (TypeBox) | One library, readable for anyone reading the repo. Zod doesn't generate code with `new Function`, so it runs the same in Bun, in a browser with a strict CSP and in React Native. TypeBox's speed advantage is microseconds before the lock, against milliseconds for the transaction. If the M2 microbenchmark shows a cost on cursors, only that message gets a hand-written check. To verify during the API setup (M1): Eden infers the types and OpenAPI comes out right with Zod; if not, REST goes back to `t` |
| D30 | **`Bun.sql` driver** under Drizzle, **pool of 10 connections per API instance**; an op waits **up to 2 s** for a free connection and then gets `busy` (transient); **5 s timeout** per transaction in Postgres. Depends on the M1 spike; plan B: `postgres.js` | Only the API (Bun) touches the database, so the native driver has no compatibility issue and adds no dependency. At ~1–2 ms per op, 10 connections handle thousands of ops/s; 2 × 10 + migrations + backup + Postgres's reserve ≈ 26 of `max_connections=50`, and a bigger pool only spends memory and contends for the 2 vCPUs. The timeout keeps a stuck transaction from holding the trip lock. `Bun.sql`'s API follows `postgres.js`'s and Drizzle hides the driver, so switching is cheap |
| D31 | **Web stack**: Next.js 16 (Active LTS, exact version pinned); Tailwind 4 + shadcn/ui on **Radix**; `packages/tokens` in TS generates the theme CSS; component tests with **`bun test` + Testing Library + happy-dom**; Node 24 (`mise.toml` locally, `node:24-slim` in production) | Next 16 is the actively supported version (15 leaves maintenance in Oct/2026). shadcn copies the components into the repo, and Radix provides accessibility (keyboard, focus, screen reader). TS `tokens` are a single source for web and RN, and the AA contrast test runs on them. One test runner for the whole repo, with the same command locally and on GitHub Actions; whatever needs a real browser goes to Playwright. Node 22 leaves maintenance in Apr/2027 |
| D32 | **Bun cryptography**: passwords with `Bun.password`'s **argon2id** (19 MiB, 2 iterations) plugged into Better Auth (`emailAndPassword.password.hash/verify`); WS ticket signed with **HMAC-SHA256** (`Bun.CryptoHasher`, secret in `.env`, constant-time comparison); invite token generated with `crypto.getRandomValues` and stored as is | argon2id is OWASP's first recommendation, and switching before the first user avoids rehashing. Bun's default (64 MiB per hash) would take down the 256 MB container with 4 simultaneous sign-ins; 19 MiB/2 is OWASP's minimum. Any instance can check the signed ticket without looking anything up, so the WS accepts connections with Redis down (as in D24); reusing a ticket within its 60 s is acceptable over HTTPS. The invite token is stored as is because the Invite screen shows the link all the time ("Copy link") |
| D33 | **Members and invites only come with the pipeline (M4)**: the foundation (M1) only creates and lists trips; accepting an invite, leaving and changing roles are born as system ops (D18). Until then, multi-user tests and the development seed create members directly in the database | Nothing is written twice, and members never exist outside the version order. M2 ("two tabs editing stops together") works with a single user |
| D34 | **Interface in pt-BR and en-US** from the first screen, with `next-intl` on the web. The server never sends display text, only codes (`reject { reason: "stop_overlap" }`), and each client translates. Emails (invite, password reset) go out in the recipient's language (D35) | Translating later would mean hunting for strings across every screen. With codes in the protocol, web and Android translate in their own way, and the API doesn't need to know each connection's language |
| D35 | **Language in a cookie, not in the URL**: no route has a locale prefix. The proxy resolves the language in this order: `NEXT_LOCALE` cookie → `Accept-Language` (`pt`, `pt-BR` and `pt-PT` become pt-BR; anything else, en-US) → en-US. **`user.locale`** (a Better Auth additional field) is the source of truth: sign-up saves the language in use, sign-in overwrites the cookie with it, and the switcher (landing footer and user menu) updates both. Password reset uses `user.locale`; an email invite to someone without an account goes out in the inviter's `locale`, and `/join` detects the recipient's own. Android follows the device language unless the user chose one | App and invite links leave the app (email, WhatsApp): with a prefix they would carry the sender's language and could never change. The Service Worker precaches a single version of the app routes. SEO per language matters little for a portfolio aimed at remote jobs, and the en-US landing is the one Google indexes; if the landing ever needs pt-BR SEO, it can get a prefix without touching any app link. The precached HTML holds the text of the language at precache time, so switching languages asks the SW to precache the app routes again |
| D36 | **Workspace packages are consumed as source**: `packages/*` have no build step and export `src/index.ts`; the apps compile them (Next with `transpilePackages`, Bun runs TypeScript, Metro on Expo). In CI, a package's "build" is its typecheck | No `dist`, exports map, sourcemaps or build order to maintain. Compiling the packages would only pay off if they were published, which is not planned |
| D37 | **One Biome config with per-workspace additions**: the root `biome.json` holds the shared rules and formatting (tabs of width 2, single quotes, no semicolons); each workspace has its own `biome.json` with `"root": false` and `"extends": "//"`, adding only its rules. Markdown is not formatted by Biome | Biome 2's native monorepo support: no config package to maintain. Each workspace lints through Turborepo, so lint is cached and runs only in affected areas. Reformatting the docs' tables and code blocks would only add noise |
| D38 | **Tables come with their features**: nothing is created ahead of time. Each feature adds its tables to `apps/api/src/db/schema/` and its own migration (`drizzle-kit generate`) when it is built: Better Auth's with auth, `trips` with REST trips. Names are camelCase in TypeScript and snake_case in the database (`casing: 'snake_case'` in the client and in `drizzle.config.ts`) | A schema designed before its feature would be designed before the decisions it depends on (`open-topics.md` items 2 and 10). Writing every column name by hand is noise; the casing is fixed once because every feature inherits it |
| D39 | **Versions of the API stack**: Drizzle's stable line (`drizzle-orm` 0.45, `drizzle-kit` 0.31) and Elysia's latest release (1.4), each pinned exactly | Drizzle 1.0 is still a release candidate and changes the migrations folder format (`drizzle-kit up` converts it later). Elysia has no LTS or published support policy, and 2.0 is a rewrite still in RC: the app stays thin until it ships |
| D40 | **Better Auth configuration**: email and password with Better Auth's limits (8 to 128 characters); passwords through D32; ids generated by Postgres (`generateId: false` + `DEFAULT uuidv7()`, uuid columns); `user.locale` optional at sign-up with `en-US` as the fallback (`NOT NULL DEFAULT 'en-US'`), and any value other than `pt-BR`/`en-US` rejected with `INVALID_LOCALE`; Better Auth's rate limit on in every environment, in memory (one instance until M5), with its own rules (sign-in/sign-up: 3 per address every 10 s); `baseURL` is the web's public origin. Clients read the `code` of an error and ignore its English `message` | The ids follow D28 and the hash follows D32 without a second format. Better Auth types the `locale` enum but doesn't check it at runtime, so a database hook does. The rate limit is the same in tests and production; its counters move to Redis with the second instance. With one origin (P2), email links and cookies belong to the web's address |

---

## 1. Overview

```
        ┌──────────────────────┐        (v2) ┌──────────────┐
        │ apps/web (Next.js)   │             │ apps/mobile  │
        │ UI + Service Worker  │             │ Expo         │
        └─────────┬────────────┘             └──────┬───────┘
                  │ packages/sync + packages/core   │
                  │      REST (Eden) + WebSocket    │
                  ▼                                 ▼
             ┌──────────────────────────────────────────┐
             │      Caddy (TLS, LB, WS) · same origin   │
             └──────────┬─────────────────────┬─────────┘
                        ▼                     ▼
                 ┌────────────┐        ┌────────────┐
                 │ api #1     │        │ api #2     │   Bun + Elysia
                 └──┬─────┬───┘        └──┬─────┬───┘
                    │     └──── pub/sub ──┘     │
                    │        Redis (presence,   │
                    │        broadcast, cache)  │
                    ▼                           ▼
             ┌──────────────────────────────────────────┐
             │ PostgreSQL — projection + ops_log + locks│
             └──────────────────────────────────────────┘
```

---

## 2. Monorepo

Bun workspaces + Turborepo. Biome for lint/format (D37). Packages are consumed as source (D36).

```
apps/
  api/          Elysia: REST + WebSocket gateway + op pipeline
  web/          Next.js (App Router)
  mobile/       (v2) Expo
packages/
  core/         pure domain: types, Zod schemas, decide(), mutations, invariants, ordering, WS protocol
  sync/         client sync engine: confirmed state + pending, rebase, transport, status
                also exports `sync/react` (hooks via useSyncExternalStore; serves web and RN)
  tokens/       design tokens (stop colors, spacing, typography)
infra/
  compose*.yml, caddy/, scripts/, provision/, k6/   (see deploy.md)
```

**Dependency rule:** `core` depends on nothing; `sync` depends only on `core`; the apps depend on both. No package may use DOM, Node, Bun or React Native APIs.

In `core`, the rule is enforced by tooling: its `tsconfig.json` declares `lib: ["ES2023"]` and `types: []`, so DOM, Bun and Node globals don't exist there, and its `biome.json` rejects imports of `bun`, `bun:*`, Node modules and `@caravan/*` in `src/`. The tests have their own `__tests__/tsconfig.json` with Bun's types.

---

## 3. Domain model

```
Trip        id, name, startDate, endDate, ownerId
Member      tripId, userId, role (owner|editor), color, lastSeenAt
Stop        id, name, place, countryCode, arriveDate, leaveDate, color, transportIn (train|flight|ferry|bus|car|null)
Day         (stopId, dayIndex), title                   — exists implicitly for each day of the stop (0..nights-1)
Activity    id, stopId, dayIndex, title, time {start, end?} | null, place | null, notes, position
            derived date = stop.arriveDate + dayIndex (D12)
Place       name, lat, lon, countryCode, osmId          — a value (not an entity), from Photon (D26)
            osmId prefixed with its type: "N123" (node), "W123" (way), "R123" (relation); the number alone is ambiguous
```

**Invariants** (validated in `core`):
- Stops stay within the trip's dates, `arriveDate < leaveDate`, and **never overlap** (half-open interval `[arrive, leave)`). A **hard** invariant (D14): a `stop.create`/`stop.update` that breaks it is rejected (`stop_overlap` / `outside_trip`) and the UI reopens the form with what was typed.
- Activities and day titles belong to a stop (D12). A date with no stop = a "gap" in the Overview, with no Board and no activities. Activities can only be created on a stop **already confirmed** by the server (a new stop's Board opens after the `ack`).
- Stop ops **never rewrite** activities' `dayIndex` (D13). An activity with `dayIndex ≥ the stop's nights` is **outside the dates**: it shows in the Board's "Outside the stop's dates" section and in a warning in the Overview; extending the stop again brings it back. Shortening or shifting a stop is always accepted; there is no `stop_has_cards`.
- `trip.update` is always accepted: a stop left outside the trip's new dates becomes a warning in the Overview, not a rejection.
- `stop.delete` soft-deletes the stop **and its activities in the same op**; `stop.restore` restores only the activities deleted by that op (`deletedVersion`). If the stop's dates were taken in the meantime, `stop.restore` is rejected (`stop_overlap`) and the UI offers to restore with new dates.
- Editing or moving a deleted entity → rejected (`deleted`); the UI shows the toast with *Restore with my change* from the in-memory draft (section 7).

**Order of activities within a day:** `(time.start NULLS LAST, position, id)` within `(stopId, dayIndex)`. Dragging to another day changes `stopId`/`dayIndex`; the position (`fractional-indexing`) only matters between activities with no time or with the same time.


---

## 4. Operations

```ts
type Op =
  | { type: "trip.update";  fields: Partial<{ name: string; dates: { start: ISODate; end: ISODate } }> }
  | { type: "stop.create";  stopId: Id; name: string; place: Place; dates: DateRange; color: StopColor; transportIn: Transport | null }
  | { type: "stop.update";  stopId: Id; fields: Partial<{ name; place; dates; color; transportIn }> }
  | { type: "stop.delete";  stopId: Id }
  | { type: "stop.restore"; stopId: Id }
  | { type: "day.update";   stopId: Id; dayIndex: number; fields: { title: string } }
  | { type: "activity.create";  activityId: Id; stopId: Id; dayIndex: number; title: string; time?: TimeRange; place?: Place; notes?: string; position: string }
  | { type: "activity.update";  activityId: Id; fields: Partial<{ title; time; place; notes }> }
  | { type: "activity.move";    activityId: Id; stopId: Id; dayIndex: number; position: string }
  | { type: "activity.delete";  activityId: Id }
  | { type: "activity.restore"; activityId: Id; fields?: Partial<{ title; time; place; notes }> };

type Envelope = { opId: Uuid; tripId: Id; op: Op; clientTs: number };
// The server adds userId (from the session, never from the client) and version.

// System ops (D18): generated only by the API, from the REST endpoints; coming from a client → rejected.
type SystemOp =
  | { type: "member.join";   userId: Id; role: Role; color: MemberColor }
  | { type: "member.remove"; userId: Id }
  | { type: "member.role";   userId: Id; role: Role }        // includes ownership transfer (2 mutations)
  | { type: "trip.delete" };
```

IDs are generated on the client with `core`'s `newId()` (UUIDv7, D28), so the optimistic UI can reference the entity before the `ack`. The client only proposes the ID; the validation rules are in section 18.

### Functional core: `decide` → `mutations`

```ts
requirements(envelope): ReadSet   // what decide will read: stop/activity ids, "all stops"

interface TripReader {            // SYNCHRONOUS. client: in-memory state. server: ReadSet rows fetched inside the tx (D17)
  trip(): Trip; stop(id): Stop | null; stops(): Stop[]; activity(id): Activity | null; activitiesOn(stopId, dayIndex): Activity[];
}

decide(reader, envelope, userId): { ok: true; mutations: Mutation[] }
                                | { ok: false; reason: RejectReason }
```

- **Client:** `applyMutations(view, mutations)` in memory, **only for the optimistic view of pending ops**. `confirmed` never re-decides: it applies the `effects` the server sends (D15).
- **Server:** `persistMutations(tx, mutations)` turns them into `UPDATE`/`INSERT`s on the projection.
- **Boundary (D17):** `core` declares what it needs (`requirements`) and decides; `apps/api` fetches and writes. On the server, the prefetch reader **throws** when accessing a key outside the `ReadSet`, and the property tests run with it to catch incomplete `requirements`.

The same code decides on both sides ("functional core, imperative shell"). It is the most tested part of the project.

**Effects are the protocol contract (D15).** `Mutation`s are declarative and carry the values only the server knows (`deletedAt`, `deletedVersion`, `deletedBy`). Cascades use aggregate mutations (`softDeleteActivitiesOfStop { stopId, version }`) to fit the message limit. The mutation schema only changes additively.

---

## 5. WebSocket protocol

| Dir. | Message | Content |
|---|---|---|
| C→S | `hello` | `tripId`, `lastVersion \| null`, `ticket`, `protocolVersion` |
| S→C | `welcome` | `currentVersion`, `mode: "ops" \| "state"`, `ops[]` (with `effects`) or `state`, `presence[]`, `locks[]` |
| C→S | `op` | `Envelope` |
| S→C | `ack` | `opId`, `version`, `effects` |
| S→C | `reject` | `opId`, `reason` |
| S→C | `op` | `{ version, opId, userId, op, effects }` (from other clients; `op` feeds the feed, `effects` the state) |
| C→S | `resync` | `fromVersion` (gap detection) |
| C→S | `lock.acquire` / `lock.release` | `{ entity, id }` (section 7) |
| S→C | `lock.granted` / `lock.denied` | `{ entity, id }` / `{ entity, id, holder: userId }` |
| S→C | `lock` / `lock.free` | lock taken or released by someone else (becomes "Ana is editing") |
| C→S | `presence` | ephemeral state (section 8) |
| S→C | `presence` / `presence.leave` | the others' state |
| C↔S | `ping` / `pong` | `pong` carries `currentVersion`; `ping` renews the connection's locks |

- **Protocol version:** the server accepts the current and the previous one; older → `upgrade_required`, newer → `server_behind` (the client goes read-only and retries). New op/effect types are read one release before they are emitted (`deploy.md` P7).
- **WS authentication:** the client gets a short *ticket* (`userId` + 60 s expiry, signed with HMAC-SHA256, D32) from `POST /ws-ticket` using its session (cookie on the web, bearer on mobile) and sends it in `hello`. That way the token never goes in the query string.
- The server processes each connection's messages **in series**, which preserves the order of a single client's ops.

---

## 6. An op's pipeline on the server

```
receive op
 ├─ rate limit, size and schema (Zod)        → transient reject, no receipt (the client resends)
 ├─ BEGIN
 │   SELECT current_version FROM trips WHERE id = $1 FOR UPDATE      -- serializes per trip, across instances
 │   SELECT * FROM op_receipts WHERE op_id = $2  → if it exists: repeat the SAME response (D16); if it belongs to another user, reject (D28)
 │       accepted: ack { version, effects from ops_log } · rejected: reject { reason }
 │   member's role (inside the tx: sees an already committed removal/role change)
 │   prefetch(requirements(envelope)) → synchronous reader (1–2 queries; the same round trip brings the locks of the entities read)
 │   edit lock (D24): update/move/delete → the entity can't hold a valid lock from another tab
 │   decide(prefetchReader, envelope, userId)
 │     rejected → op_receipts(rejected), COMMIT, send reject
 │   version = current + 1
 │   persistMutations(tx)
 │   INSERT ops_log; INSERT op_receipts(accepted, version); UPDATE trips SET current_version = version
 ├─ COMMIT
 ├─ ack → author
 └─ PUBLISH trip:{id}  { version, opId, userId, op, effects }
```

The lock is per `trips` row: different trips never contend for the same lock.

**Single decision per `opId` (D16):** every op that reaches the transaction gets a receipt, accepted or rejected. Resends (after a dropped connection) always get the same response. Final rejections: `forbidden`, `locked`, `deleted`, `stop_overlap`, `outside_trip`. (`locked` is final for that op; the draft stays on screen and the person tries again when the lock is released, generating a new op.) Transient ones (no receipt, before BEGIN): rate limit, size, schema, server busy.

---

## 7. Concurrent editing: the edit lock (D22)

There are no write conflicts: **only one person edits a thing at a time**. Consistency across ops is still guaranteed by Postgres (version + `FOR UPDATE`); the edit lock is the UX guarantee that nobody overwrites what someone else is editing.

**Granularity: entity.** Activity, stop, day title (`stopId + dayIndex`) and trip header (name and dates). The "editing field X" indicator stays in presence (section 8), but the lock covers the whole entity.

| UI action | Lock |
|---|---|
| Open the CardSheet for editing, focus an inline field | `lock.acquire` on the activity (or the day, the stop, the trip) |
| Drag an activity, resize a stop | lock on the entity at the start of the drag |
| Delete | lock on the entity; `stop.delete` is also denied if any of the stop's activities is held by someone else |
| Create | not needed (the entity doesn't exist yet) |
| Close the sheet, blur, drop | `lock.release` |

**Mechanics (D24: in Postgres):**
- An **`UNLOGGED`** table `edit_locks (trip_id, entity, entity_id, user_id, tab_id, expires_at)`, PK `(trip_id, entity, entity_id)`. Every timestamp comes from Postgres's `now()` (a single clock).
  - `UNLOGGED`: it skips the WAL, so it is faster. If Postgres crashes, the table comes back empty: acceptable, since the locks would expire within 15 s anyway and tabs ask again when they reconnect.
  - **No index on `expires_at`** (nor on any other changing column): renewal becomes a *HOT update* (the row is updated in place) and the table doesn't bloat. The only index is on `tab_id`, which doesn't change.
- **Acquire:** `INSERT … ON CONFLICT DO UPDATE … WHERE edit_locks.expires_at < now() OR edit_locks.tab_id = excluded.tab_id RETURNING`. A row came back → `lock.granted`; none did → `lock.denied { holder }`, and the UI goes read-only for that entity ("Ana is editing").
- **Renew in batches, per instance:** every ~5 s, each instance runs **one** `UPDATE edit_locks SET expires_at = now() + 15 s WHERE tab_id = ANY($1)` with the live tabs connected to it (those that answered the `ping`). The cost is constant (≈ 2 queries every 5 s in total), no matter how many people are editing. A closed tab, a dropped network or a dead instance = the lock expires on its own in ≤ 15 s. Expired rows are deleted lazily (in the `INSERT` itself) and by a periodic cleanup.
- **Owner = tab, not connection:** each tab generates a `tabId` (kept in `sessionStorage`) and reuses it across reconnections. If the connection drops and comes back in < 15 s (or a deploy closes the WS with 1012), the tab **resumes its own lock** instead of being blocked by it.
- **Release:** `lock.release` runs a `DELETE`. A removed member (`member.remove`) → their locks are deleted in the same transaction.
- **Inactivity:** 2 min without input while holding the lock → the client releases it and the UI shows "Editing paused" (so nobody holds a card hostage by leaving a tab open).
- **The pipeline checks the lock inside the op's transaction** (after the `FOR UPDATE`): update/move/delete on an entity with a valid lock from **another tab** → `reject { reason: "locked" }`. `stop.delete` also checks the locks of the stop's activities. No race window is left between the check and the COMMIT.
- **Telling the others:** acquire and release publish `lock`/`lock.free` on Redis pub/sub (that is what lights up "Ana is editing" live). The `welcome` carries the valid locks read from Postgres.
- **Redis down:** the lock **still holds** (it lives in Postgres). Only the live notice disappears; whoever tries to edit gets `lock.denied { holder }` right away and the UI shows "Ana is editing" all the same.

**Remaining rejections and what the UI does** (the user's content is still in memory):
- `deleted` (the entity was deleted by a `stop.delete` cascade): toast "Leo deleted this stop · Restore with my change".
- `stop_overlap` / `outside_trip`: the stop form reopens with the data and the warning.
- `locked`: toast "Ana is editing this"; the draft stays in the field until the lock is released.
- `forbidden`: a notice, and the user leaves the trip.

The `ops_log` still feeds the "All activity" feed.

---

## 8. Presence

Two levels, both in Redis only:

| Kind | Examples | Storage |
|---|---|---|
| **Stable** | online, `editing: { entity, id, field }` | hash `presence:{tripId}`, field `{userId}:{connId}` with per-field TTL (`HEXPIRE`, Redis ≥ 7.4), renewed on the heartbeat |
| **Volatile** | cursor, drag in progress, stop resize | `PUBLISH` only, 50 ms throttle, nothing stored |

- The **edit lock** (section 7) is separate from presence and lives in Postgres (D24): presence says *where* the person is (including the field) and can vanish without harm; the lock says *who may write* and cannot.
- **Document coordinates**, not screen coordinates: `{ anchor: { kind: "day", stopId, dayIndex } | { kind: "activity", id }, dx, dy }` as fractions of the element. Screens of different sizes see the cursor in the same place.
- Several tabs of the same user = several `connId`s. The UI groups them by user.
- `trip_members.last_seen_at` is written on disconnect ("Last seen 2 days ago").
- The trip list ("Ana and Leo are here") reads the hashes with a pipeline in `GET /trips`.

---

## 9. Broadcast across instances and ordering

- Each instance subscribes to `trip:{id}` on Redis **once**, when the 1st local connection joins the trip, and unsubscribes when the last one leaves.
- **Local delivery through Bun's native pub/sub:** each connection runs `ws.subscribe("trip:{id}")` in Elysia; the instance receives from Redis and forwards with `server.publish("trip:{id}", msg)`, done in native code with no JS loop. It is the hottest path in the system (cursors: ~400 msg/s per full trip × 19 recipients), far more than ops and locks.
- **Order is not guaranteed:** instance A commits v5, B commits v6, and B may publish first. On top of that, Redis pub/sub is *at-most-once*.
- **The client is responsible:** it keeps a buffer of ops with `version > confirmed + 1`. If the gap lasts more than ~500 ms, it sends `resync { fromVersion }`. `pong` carries `currentVersion`, so a lost message (Redis went down, an instance died) is detected too.

---

## 10. Client: `packages/sync`

```
confirmed: { version, state }          ← only changes with confirmed effects, in order
pending:   Envelope[]                  ← local ops with no ack yet (in memory only; they live milliseconds)
view = pending.reduce(apply, confirmed.state)   (memoized; it is what the UI renders)
```

| Event | Effect |
|---|---|
| local action | needs a connection and the entity's lock (D22); local `decide`; if ok, it goes into `pending`, is sent, and the view is recomputed |
| `ack {opId, v, effects}` | applies the `effects` to `confirmed` at version `v` (respecting the ordering buffer) and removes it from `pending` |
| remote `op` `v` | applies the `effects` to `confirmed` and recomputes the view |
| `reject` | removes it from `pending`, recomputes, emits an event to the UI with the op's content (section 7 toast) |
| disconnect | **read-only UI** (D23); exponential backoff with jitter; status `offline { retryInMs }`; "Retry now" forces it. In-flight `pending` ops stay in memory |
| reconnect | `hello { lastVersion }` → apply `welcome` → resend in-flight `pending` ops (the server resolves duplicates through the receipt) → re-request the open locks |

**Injected ports** (what makes the package ready for mobile):

```ts
interface Transport { connect(url): Socket }            // web: native WebSocket. RN: same
interface Storage   { load(tripId); save(tripId, confirmed) }   // read-only offline. web: IndexedDB. RN: expo-sqlite
interface Clock     { now(); setTimeout(...) }          // fake in tests
```

**Status exposed to the UI:** `synced { version }` · `syncing { incoming }` · `offline { retryInMs }` (read-only). It feeds the top pill and the "You're offline — viewing only" banner.

**React:** `sync/react` exports `useTrip(selector)` on top of `useSyncExternalStore`. No Zustand needed for synced state; UI state (modals, selection) stays local.

---

## 11. Persistence

```sql
-- Better Auth manages: user, session, account, verification (IDs from the database's DEFAULT uuidv7(), D40)
-- user gets a `locale` additional field ('pt-BR' | 'en-US', D35; NOT NULL DEFAULT 'en-US', D40)
-- Every id is a uuid (UUIDv7, D28): DEFAULT uuidv7() for what the server creates; what comes from the client arrives filled in
trips          (id, name, start_date, end_date, owner_id, current_version, created_at, deleted_at)
trip_members   (trip_id, user_id, role, color, joined_at, last_seen_at)              PK (trip_id, user_id)
invite_links   (token PK, trip_id, role, created_by, expires_at, revoked_at)
invite_emails  (id, trip_id, email, role, invited_by, created_at, accepted_at, declined_at)
stops          (id, trip_id, name, place_json, country_code, arrive_date, leave_date, color, transport_in,
                deleted_at, deleted_by, deleted_version)
days           (stop_id, day_index, trip_id, title)                                   PK (stop_id, day_index)
activities     (id, trip_id, stop_id, day_index, title, time_start, time_end, place_json, notes, position, created_by,
                deleted_at, deleted_by, deleted_version)
ops_log        (trip_id, version, op_id UNIQUE, user_id, op_json, effects_json, created_at)  PK (trip_id, version)
edit_locks     (trip_id, entity, entity_id, user_id, tab_id, expires_at)   UNLOGGED    PK (trip_id, entity, entity_id), index on tab_id
op_receipts    (op_id PK, trip_id, user_id, outcome, version, reason, created_at)
```

- The entity tables are the **projection** (fast reads). The `ops_log` is the history, the feed and the basis for reconnection.
- **Full state in `welcome`:** the projection is read in a `REPEATABLE READ` transaction together with `current_version`, which gives a consistent snapshot without locking. If `current - lastVersion > 500`, the server sends the state instead of the ops.
- **Retention (D19):** `ops_log` and tombstones (`deleted_at`, used by *restore*) are kept; `op_receipts` older than 7 days are deleted (pending ops only live in memory). No snapshots in the MVP; history/undo (v2) can be rebuilt from `effects_json`.

---

## 12. Web (Next.js)

- **UI:** Tailwind 4 + shadcn/ui on Radix (D31). A script generates, from `packages/tokens`, the CSS variables the shadcn theme reads.
- **Public routes** (landing, sign in/up, join) with SSR. **App** (`/trips`, `/t/:id/...`) as client components on top of `sync`.
- **Language (D35):** `next-intl` without i18n routing; the proxy resolves the locale (cookie → `Accept-Language` → en-US) and no URL carries it.
- **Read-only offline (D23):** Service Worker with **Serwist** (`@serwist/turbopack`, because Next 16 builds with Turbopack; precache of the shell + app routes) and each trip's `confirmed` cached in IndexedDB. With no connection, the UI opens the plan and search but disables editing. Still the biggest technical risk on the web: validate it early (M1) with a "hello offline" page.
- **Every business rule goes through the API.** No Server Actions/route handlers with domain logic, or mobile can't reuse them.
- **REST** with the **Eden** client (types inferred from Elysia) + TanStack Query for the trip list, invites and members.
- Drag & drop: dnd-kit. ⌘K search: an in-memory index over the local state (works offline). "New places from the map need a connection."
- Agenda (now/next/done): derived from state + clock, client only.

---

## 13. API (Elysia)

```
apps/api/src/
  auth/        Better Auth mounted at /api/auth/*, /ws-ticket
  trips/       trip CRUD (creation produces trip + owner + v0), members, roles
  invites/     links (create, reset, accept), emails (send, resend, accept, decline)
  places/      Photon proxy + 24h Redis cache + per-user rate limit
  realtime/    WS gateway, op pipeline, edit locks (Postgres), presence, pub/sub, ReadSet prefetch → TripReader (D17)
  health/      /healthz and /ready (deploy.md §3)
  db/          Drizzle client (Bun.sql), schema + migrations (drizzle-kit); each feature adds its tables (D38)
```

- **Roles:** an editor edits the plan and invites; only the owner changes roles and deletes the trip.
- **Invites:** a link with a short token (`eR7k-2Qx9`), a role and a 7-day expiry; "Reset link" revokes it and creates another. An email invite shows up as a Join/Decline banner on `/trips` when the user's verified email matches.
- Transactional email (invite, password reset): Resend.

---

## 14. Tests

| Level | What | Tool |
|---|---|---|
| Unit | each op's `decide`, invariants, ordering | bun test |
| Component | the web's React components, querying by role and label | bun test + Testing Library + happy-dom |
| Property | N simulated clients, random ops, delivery in random order, drops and resends → **all converge** to the server state (hash); no op lost or duplicated; same response for the same `opId` | bun test + fast-check |
| Integration | real API + Postgres + Redis; N concurrent WS clients on 2 instances; edit lock exclusivity across instances, including with Redis stopped | bun test + compose |
| Chaos | kill an instance, Redis and the network (latency, cut) in the middle of edits → no confirmed op is lost; with Redis down, two people still can't edit the same thing | toxiproxy |
| E2E | web flows (create a trip, invite, edit in 2 tabs, "Ana is editing" lock, open offline read-only) | Playwright |
| Load | concurrent connections, broadcast p95 | k6 |

---

## 15. Infrastructure and deploy

See [`deploy.md`](./deploy.md). In short: one Hetzner ARM VPS with Docker Compose (Caddy + api ×2 + web ×2 + Postgres + Redis), Cloudflare in front and everything on the same origin (`/`, `/api/*`, `/ws`). Deploys are rolling: each instance closes its WS with code 1012 and clients reconnect to the other one.

---

## 16. Ready for Android (v2)

A checklist so no doors close now:
- [ ] `core` and `sync` with no DOM/Node; `Transport`/`Storage`/`Clock` ports injected.
- [ ] Hooks in `sync/react` (plain React, no `react-dom`).
- [ ] Auth working with a **bearer** token besides the cookie; WS through the ticket.
- [ ] All logic in the API (nothing only in Next).
- [ ] Presence with document coordinates; the cursor is optional (mobile only shows avatars and "editing").
- [ ] `tokens` in plain TS (not CSS-only), consumable by Tailwind and RN.
- [ ] `core`/`sync` dependencies compatible with Hermes (no mandatory `crypto.subtle`, with a UUID polyfill).

---

## 17. Outside the MVP (impact on the design)

- **Documents/attachments** (CardSheet → Documents, "Today's documents", offline per stop/trip, Wi-Fi only, "S3 presigned uploads"). In v2: R2 (production)/MinIO (local), presign → PUT → `attachment.add` op.
- **Android** ("Get it on Android" on the landing page).
- Screens to adjust in the MVP: in SignIn/SignUp, remove "Email me a sign-in link instead" and hide "Continue with Google" until OAuth arrives; remove the Documents section from the CardSheet; the "Save X offline" buttons, OfflineStop and TripOffline go away; the offline indicator in the trip list goes away (the plan can always be read offline); the conflict screens (ConflictChanges, ConflictDeleted, ConflictField) go away: they become the "Ana is editing" lock and toasts; the Offline screen becomes the "viewing only" banner; the landing page replaces "Web + Android" and the "S3 presigned uploads" and "Docker · nginx" chips (now Caddy); "2 API instances behind nginx" becomes "behind Caddy".

---

## 18. Complementary decisions

**Time and time zones**
- Activity times = **local wall-clock time** (`"09:40"`) + derived date (D12). No UTC on the activity.
- Each stop stores a `timezone` (IANA), computed from `lat/lon` with `tz-lookup` (offline, in `core`).
- The Agenda's "now", "in 12 min" and "done": the device clock converted to the time zone of the day's stop.
- `time.end < time.start` = crosses midnight (ends the next day).
- Travel across time zones (Lisbon → Prague flight): waits until transport becomes an entity. In the MVP, an activity uses its stop's time zone.

**Edit granularity**
- Text fields produce an op on *blur*, after ~800 ms without typing, or on `pagehide`/`visibilitychange: hidden` (phones kill background tabs). Discrete fields (time, place, move) produce an op right away.

**Tabs, accounts and storage**
- Each tab has its own WS and a stable `tabId` (in `sessionStorage`). Two tabs of the same user compete for the edit lock like two people; the UI says "Open in another tab".
- The IndexedDB read cache is written by any tab, **only if the version is higher** than the stored one. A cache with an incompatible format is discarded and downloaded again (it is only a cache).
- IndexedDB is split per `userId`; signing out clears the cache.
- On sign-in, **all** the user's trips are downloaded into the cache (the plan can be read offline).

**Members and permissions in real time**
- Joining, leaving, being removed, changing roles, transferring ownership and deleting the trip go **through the same pipeline** as ops (lock → `decide` → effects → version), as system ops (D18). Members are part of `confirmed` and of the feed. Pending invites stay outside (REST).
- A member removed while online: the gateway sees the `member.remove` effect, releases their locks, closes the WS (code 4403), and the client deletes the trip from the cache.
- A member removed while offline: on the next `hello` they get `forbidden`; the client deletes the trip from the cache and shows a notice.
- Role change: the gateway applies the `member.role` effect to the connection's role; each op's authorization is checked inside the transaction, at the version it is decided.
- The owner can only leave the trip after transferring ownership. Deleting the trip is a soft delete (owner only) and disconnects everyone.

**Limits**

| Item | Limit |
|---|---|
| Title | 120 characters |
| Notes | 5,000 characters |
| Activities per trip | 2,000 |
| Stops per trip | 100 |
| Trip length | 366 days |
| Members per trip | 20 |
| WS message | 64 KB |
| Ops per connection | 20/s (burst 50), token bucket |
| Presence | 30/s |
| Auth | Better Auth's rate limit |

- Invite token: 10 base32 characters (≈ 50 bits) from `crypto.getRandomValues`, with a rate limit on `/join` (D32).
- Password: `Bun.password`'s argon2id with 19 MiB and 2 iterations (D32), plus Better Auth's rate limit.

**Security and privacy**
- The WS upgrade validates the `Origin` (Cross-Site WebSocket Hijacking) on top of the ticket.
- **IDs coming from the client (D28):** the client proposes, the server decides.
  - UUIDv7 format validated by Zod.
  - A `*.create` with an ID that already exists (in any trip) is rejected; the PK is unique across the whole database.
  - Every server read is filtered by the op's `trip_id`, on top of the membership check: knowing the ID of an entity in another trip gives no access to it.
  - The receipt is checked by `op_id` **and** `user_id`: an `opId` from another user is rejected.
  - Nothing derives time or order from the timestamp embedded in the ID; `created_at` and order come from the server.
- User text is always rendered as plain text; strict CSP in Next.
- Cookies `HttpOnly; Secure; SameSite=Lax`; same origin, no CORS.
- Account deletion: removes personal data and replaces the `user_id` in `ops_log`/`op_receipts` with a "Deleted user"; trips they own pass to the oldest member, or are deleted if they were alone.
- Terms and Privacy pages; cookieless analytics (self-hosted Umami), no banner.

**Accessibility**
- Keyboard drag & drop (dnd-kit), with announcements.
- Relevant remote changes announced through `aria-live="polite"`, throttled.
- AA contrast for text on the stop colors (validated in the `tokens`).
- Respect `prefers-reduced-motion` in the animations of remote cards.

**Interface**
- Interface in pt-BR and en-US (D34), language in a cookie and on the user (D35); dates and times formatted by locale (`Intl`).
- Dark theme only in the MVP; the `tokens` are structured for a light theme from the start.
- Avatar: the Google photo when there is one; otherwise, initials in the member's color.
- **Fully responsive** (phone and desktop), with touch drag. Components are designed mobile-first, which also gets Android ahead.

---

## 19. Open

> The full list of what is still undecided, with recommendations, is in [`open-topics.md`](./open-topics.md).

| Question | Deadline | Context |
|---|---|---|
| Adding or extending a stop over a taken period: push the following ones, only fill gaps, or ask? | **Before M2** (Overview UI) | UX only: the invariant is already hard (D14). Pushing would be an explicit op (`stops.shift`), cheap thanks to D12 |
| Phone screens in the design | **Before M2** | The current design is desktop-only (1440 px) |
| Transport as an entity (departure and arrival times, origin and destination time zones) | v2 | Today it is just the icon in `stop.transportIn` |
| Trip date asymmetry: a `trip.update` that leaves stops outside is accepted (warning), but a `stop.create` outside the trip is rejected (D14). Derive the trip dates from the stops? | When the `trips` schema is built (M1) | Acceptable for now: each op only validates what it changes |
| Edit lock: the 15 s TTL and 2 min inactivity are starting defaults | M4 | Adjust with real use; see section 7 |
| **Viewer** role (read-only) | v2 | Doesn't change the architecture: `decide` already checks the role inside the transaction (D18) |

**Depend on a prototype or a test (can't be decided on paper):**

| Question | How to validate | When |
|---|---|---|
| Next.js + Serwist opens the app offline (already planned) | "Hello offline" spike | M1 |
| `Bun.sql` holds up in the pipeline (D30) | Spike: two `FOR UPDATE` transactions on the same trip run in series; with the pool full, the op waits 2 s and gets `busy`; a stuck transaction is cut at 5 s and releases the lock; Drizzle migrations and Better Auth work on `Bun.sql`. Failed → `postgres.js` | M1 |
| `requirements` (D17) covers everything `decide` reads | A prefetch reader that throws + fast-check with every op | M2 (and with every new op) |
| Lock cost per op with prefetch (target ≤ 2 ms p95 on the same host) | Pipeline microbenchmark with 2,000 activities | M3 |
| Cascade `effects` fit in 64 KB (`stop.delete` with 135 activities) | Integration test with the trip from the design | M3 |
| The perceived lock latency (`acquire` before editing) doesn't get in the way of opening the CardSheet and dragging | Measure the `lock.acquire` round trip on simulated 4G; the UI opens optimistically and only blocks if `denied` comes back | M4 |
| `pagehide` fires reliably on Chrome Android when the tab is killed | Manual test on a real device | M5 |
| Rolling deploy and rollback with mixed instances (P7) | Integration with API N and N+1 side by side | On staging, before the 1st deploy with a protocol change |
