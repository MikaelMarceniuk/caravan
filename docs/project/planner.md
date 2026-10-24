# Collaborative Trip Planner — Project Plan

> Name: **Caravan**
> Goal: a portfolio project for freelance work and remote jobs abroad (paid in euros/dollars).
> Platforms: **Web (Next.js)** in the MVP. **Android (Expo)** in v2, reusing the same backend and the same sync engine.
> Detailed architecture: [`architecture.md`](./architecture.md).

---

## 1. Pitch

A group builds a trip itinerary together, in real time. The trip is split into **stops** (cities, on a timeline), each stop has its **days** (columns), and each **activity** is a card. Everyone sees who is online, who is editing what, and everyone else's changes right away, with no flicker. Only one person edits each thing at a time ("Ana is editing"), so nobody overwrites anybody. With no connection (airport, road, roaming), the plan stays open for reading. No confirmed edit is lost, even if the server goes down.

The product is simple on purpose. The complexity is in what it demonstrates technically.

---

## 2. What the project must demonstrate

| Capability | Where it shows |
|---|---|
| Real time / WebSocket | Live ops and presence |
| Consistency and concurrency | Authoritative server, versioned ops, rebase |
| Resilience | Op log, op receipts, reconnection, read-only offline cache |
| Horizontal scaling | 2+ API instances with Redis pub/sub |
| Redis | Ephemeral presence (TTL) + pub/sub; what is a promise (edit locks) lives in Postgres |
| Messaging | Pub/sub between instances |
| External integration | Place search (Photon/OSM) |
| Tests | Unit + property-based (convergence) + integration (multiple WS clients) + chaos test |
| Performance | Load test with k6 (concurrent connections, broadcast p95 latency) |
| Full stack | Next.js + a platform-agnostic sync core (ready for Android in v2) |
| DevOps | Docker Compose, Caddy, Cloudflare, CI/CD with zero-downtime deploys, IaC (OpenTofu) |

---

## 3. v1 scope

### In
- Auth: email/password, forgot password and "Try the demo" (anonymous session) with Better Auth. Google and Apple come later
- Trip list (upcoming/past, who is online, pending invites)
- Create a trip (name and dates; first stop and invites are optional). Days come from the stops (D12); whether the trip has its own dates is item 2 of [`open-topics.md`](./open-topics.md)
- Invites: link (role, expires in 7 days, reset) and email (resend, accept/decline); owner and editor roles
- **Overview:** list of stops, add/edit/remove a stop (city, dates, transport, color), gap warning
- **Board** per stop: days as columns (editable title), cards ordered by time
  - Create, edit and delete cards (title, time, place, notes) in the CardSheet
  - Move cards between days (drag & drop)
- Presence: avatars, "so-and-so is editing" (card and field)
- **Read-only** offline: the plan can always be read (Overview, Board and CardSheet); editing needs a connection; Synced/Syncing/Offline status + "viewing only" banner
- Exclusive editing: a lock per entity ("Ana is editing"), toasts with *Restore* when an edit is rejected
- Place search (online)
- **Fully responsive web** (phone and desktop), with touch drag
- "Try the demo": an anonymous session with a ready-made trip, on top of the GIF/video

### Out
- **v1.x:** Agenda, Google and Apple sign-in, ⌘K search, live cursors and drag, month timeline in the Overview, "All activity" feed
- **Documents/attachments** and offline files
- **Android** (Expo)
- Group chat
- Voting on activities
- Expense splitting
- Map with the day's route
- iOS

Each item has a version in the roadmap (§8).

---

## 4–7. Architecture, consistency, persistence and stack

Moved to [`architecture.md`](./architecture.md), the technical source of truth. Summary:

- **Monorepo** (Bun + Turborepo): `apps/api` (Elysia), `apps/web` (Next.js), `packages/core` (domain + `decide()`, shared by client and server), `packages/sync` (the client sync engine), `packages/tokens`.
- **Consistency:** authoritative server, ops versioned per trip, `FOR UPDATE` lock on the trip row, a receipt per op. An **edit lock per entity** (in Postgres, checked inside the op's transaction) stops two people from editing the same thing; there are no conflicts to resolve.
- **Real time:** WebSocket + Redis pub/sub between 2 instances behind Caddy. The client detects version gaps and asks for a `resync`.
- **Presence:** Redis only (a hash with per-field TTL + pub/sub for cursor and drag).
- **Persistence:** Postgres (projection + `ops_log` kept in full + `op_receipts` for 7 days, D19); on the client, IndexedDB + Service Worker (Serwist).
- **Stack:** Bun, Elysia, Drizzle, Zod, Better Auth, Resend, Next.js 16, Tailwind 4, shadcn/ui (Radix), dnd-kit, TanStack Query, Photon (places), fast-check, Playwright, k6, toxiproxy, Docker Compose, GitHub Actions, Caddy, Cloudflare, one Hetzner ARM VPS for everything ([`deploy.md`](./deploy.md)).

---

## 8. Roadmap

No deadlines: what matters is the **order** and what goes into each version. Each milestone ends with something running in production. If time gets tight, a feature moves to a later version instead of being cut.

These apply to every milestone: responsiveness and accessibility are part of every screen, and code is written with TDD ([`development.md`](./development.md)).

### v1 — showcase

#### M1 — Foundation
- [x] Monorepo (Bun + Turborepo), Biome, basic CI
- [ ] Buy the domain (Cloudflare Registrar)
- [x] Docker Compose (Postgres, Redis)
- [ ] API (Elysia) + Drizzle
- [ ] Auth with Better Auth: email and password (no email sending) + first migration and migration tests
- [ ] REST: create and list trips
- [ ] **Minimal production deploy:** CAX11, Caddy, Cloudflare, CI deploying (1 API instance)
- [ ] **Risk spike:** a Next.js page opening offline with Serwist
- [ ] **Risk spike:** `Bun.sql` in the pipeline (`FOR UPDATE` in series, full pool → `busy`, transaction timeout, migrations and Better Auth); plan B: `postgres.js` (`architecture.md` D30)

**Order:** the monorepo setup leaves `bun test` working and CI running before any production code merges. Docker Compose (Postgres, Redis) is up before the code whose tests need it. Other test tools come in with the first code that needs them, not ahead of time.

**Done when:** sign-in and the trip list are live.

#### M2 — Sync slice (stops)
- [ ] `core`: `requirements()` + synchronous `decide()` + mutations (effects) for the stop ops, stop invariants, upcasters
- [ ] WebSocket server: `hello`/`welcome`, `op`, `ack`, `reject`, `resync`, auth ticket
- [ ] Op pipeline (per-trip lock, prefetch, `op_receipts`, `ops_log` with effects)
- [ ] `packages/sync`: confirmed + pending, rebase, ordering buffer, Transport/Storage/Clock ports
- [ ] Basic Overview (list of stops; add, edit and remove) + place search (Photon) + `stop_overlap` toast
- [ ] **Tests:** unit, **property-based** (N clients, random delivery → they converge) and **integration** (N WS clients against the real API)
- [ ] **On-demand staging** (`deploy.md` §14)

**Done when:** two tabs edit stops together, in production.

#### M3 — Full plan
- [ ] `core` and pipeline for the day and activity ops, ordering by time
- [ ] Board per stop (days, activities by time) + CardSheet
- [ ] Drag & drop: mouse, touch, keyboard and "Move to…"

**Done when:** a whole trip can be planned in the app.

#### M4 — Collaboration
- [ ] Email infrastructure: Resend, verified domain, templates
- [ ] Invites: link (role, expires in 7 days, reset) and email (resend, accept/decline); join
- [ ] "Forgot password"
- [ ] Members as system ops (join, leave, change role)
- [ ] Presence: avatars and "editing" (card and field)
- [ ] Edit lock per entity (`lock.acquire/release`, `edit_locks` table, `tabId`, check inside the transaction) + "Ana is editing" UI + `locked` toast with *Restore with my change*

**Done when:** two people really plan together.

#### M5 — Scale and resilience
- [ ] Redis pub/sub + 2 API instances behind Caddy; rolling deploy
- [ ] Test: clients on different instances converge, and the lock is exclusive across instances
- [ ] Reconnection with `lastVersion`, backoff, Synced/Syncing/Offline status + "viewing only" banner
- [ ] Read cache (IndexedDB) + Service Worker: open the plan offline, read-only
- [ ] Protocol compatibility test (API N and N+1 side by side, N−1 fixtures)
- [ ] **Chaos test** (toxiproxy): kill an instance, Redis and the network in the middle of edits → nothing is lost

**Done when:** the technical side is complete.

#### M6 — Launch
- [ ] "Try the demo": an anonymous session with a ready-made trip (the seed)
- [ ] Full infrastructure: OpenTofu, backups to R2, Grafana Cloud, Sentry, UptimeRobot
- [ ] Upgrade to CAX21 + k6 load test (including lock renewal) → numbers in the README and on the landing page
- [ ] README: architecture, diagram, decisions and trade-offs, how to run locally
- [ ] GIF/video: 3 browsers editing together + chaos demo
- [ ] LinkedIn post + project featured on the profile

**Done when:** the showcase is ready.

### v1.x
- **Agenda** (the day's timeline, "now" and "up next"), together with the stop's time zone
- Google and Apple sign-in
- ⌘K search inside the trip
- Live cursors and drag
- Month timeline in the Overview
- "All activity" feed
- Staging that wakes up on access (Cloudflare Worker)

### v2
- **Android (Expo):** Agenda + Board + CardSheet on top of `packages/sync`; checklist in `architecture.md` §16
- **Map** with the day's route (MapLibre + OpenFreeMap, D27)
- **Documents/attachments** (R2/MinIO, presigned upload) + offline per file/stop/trip
- History / "undo" using the op log
- Transport as an entity
- *Viewer* role (read-only)

### v3+
- Group chat
- Voting on activities
- Multi-currency expense splitting
- iOS

---

## 9. Showcase (what to show)

- **Main GIF:** two browsers + a phone side by side, cursors and cards moving; one of them loses its connection and keeps seeing the plan.
- **Chaos demo:** kill an API instance live, with no data loss; take Redis down and show that the edit lock still holds.
- **Exclusive editing demo:** Ana opens a card, Leo sees "Ana is editing"; Ana closes it and Leo edits.
- **Numbers:** "X concurrent connections, broadcast p95 of Y ms" (k6).
- **README with "Design decisions":**
  - Authoritative server vs CRDT
  - Shared `core` (functional core, imperative shell)
  - Edit lock instead of conflict resolution (and why offline is read-only)
  - Broadcast ordering across instances and gap detection
  - Presence in Redis vs edit lock in the database (ephemeral × promise)
  - Op log kept in full: why not compact it (yet)
- **LinkedIn post:** the problem, the main decision, the demo and the link.
- Links: public repository, live web app.

---

## 10. Risks and possible cuts

| Risk | Mitigation / cut |
|---|---|
| The sync engine takes longer | It is the priority; ⌘K, live drag and social sign-in are already in v1.x. If it slips further, other features move to a later version (§8) |
| Next.js offline (Service Worker) | Spike in M1; plan B: app routes as a static SPA served by the SW; plan C: no offline in the MVP (banner only) |
| `Bun.sql` unstable in the pipeline | Spike in M1; plan B: `postgres.js` (same API, Drizzle hides the driver) |
| Overview (timeline) is a lot of work | First a simple list of stops; the month timeline comes later |
| Full responsiveness slips | Touch drag can wait: "Move to…" (required by WCAG) already covers phones |
| No phone design | Derive it from the desktop components; review later |
| Scope grows | Anything outside section 3 goes to a later version in the roadmap (§8) |
