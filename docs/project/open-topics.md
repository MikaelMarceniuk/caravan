# Caravan — Open topics

> The single list of what is still to be decided, checked or fixed.
> Decisions already made are in [`architecture.md`](./architecture.md) §0 and [`deploy.md`](./deploy.md) §0; the vocabulary, in [`CONTEXT.md`](../../CONTEXT.md).
> There is no schedule: each item says **what it blocks**. When an item is decided, it leaves this list and becomes a line in §0 of the right document. Numbers are fixed: a decided item's number is never reused.
> Last revised: 2026-10-25.

---

## Summary

| # | Topic | Blocks | Weight |
|---|---|---|---|
| **B. Domain model** ||||
| 8 | Map: how to draw the route | Map (v2) | 🟢 |
| 9 | Stop time zone | Agenda (v1.x) | 🟢 |
| 10 | Edit lock entities and the day's id | `edit_locks` table, protocol | 🟡 |
| 11 | Full list of `RejectReason` | `decide`, protocol | 🟡 |
| **C. Product and UX** ||||
| 12 | Edit lock defaults | Edit lock | 🟠 |
| 13 | How the lock feels on a bad connection | CardSheet/Board UI | 🟠 |
| 14 | Changed screens and phone screens | UI | 🟠 |
| 15 | Push or only fill when adding a stop | Overview UI | 🟡 |
| 16 | Where the "All activity" feed lives | Status UI | 🟡 |
| 17 | *Viewer* role (read-only) | Nothing (v2) | 🟢 |
| **D. Technical validation** ||||
| 18 | Service Worker spike: success criteria | Read-only offline | 🔴 |
| 19 | Out-of-order messages: timings and test plan | `packages/sync` | 🟠 |
| 20 | Version discipline (P7) in practice | 1st deploy | 🟡 |
| 21 | New limits (lock and cursors) | Presence and lock | 🟢 |
| 24 | Auth limits across instances | 2 API instances (M5) | 🟢 |
| **F. Practical preparation** | | Auth, CI, deploy | 🟡 |

---

## B. Domain model

### 8. Map: how to draw the route 🟢

**Already decided:** the shape of `Place` (D26), the map stack, MapLibre GL JS + OpenFreeMap (D27), and that it ships in v2 (`planner.md` §8).

**To decide:**
- The day's route: OSRM, Valhalla or GraphHopper. All of them must be self-hosted (the public demo servers are not for production) and are heavy for the VPS (4 GB at first, 8 GB after the upgrade).
- OpenStreetMap attribution is required on screen.

### 9. Stop time zone 🟢

**Why it matters:** §18 says each stop stores a `timezone` (IANA) computed from `lat/lon`, but the field is neither in the model (§3) nor in the `stops` table (§11). The Agenda ("now", "in 12 min") depends on it. Since the Agenda moved to v1.x, we decide when it arrives.

**To discuss:** whether the time zone is stored or derived, where it is computed, and how the Agenda handles flights across time zones.

### 10. Edit lock entities and the day's id 🟡

**Why it matters:** the `edit_locks` table has `entity` and `entity_id`, but the entity enum and the id format are not defined.

**To discuss:** the list (`activity | stop | day | trip`?) and the id of a day, which has no UUID of its own (`stopId:dayIndex`?).

### 11. Full list of `RejectReason` 🟡

**Why it matters:** today the final rejections are `forbidden`, `locked`, `deleted` and `stop_overlap` (`outside_trip` went away with D44). Some cases are missing.

**To discuss:**
- Limit exceeded (2,000 activities, 100 stops, 20 members): which reason, and whether it is final or transient.
- `activity.create` with a `dayIndex` outside the stop's dates: accepted as "outside the dates" (D13) or rejected?
- The new cases from D28: `*.create` with an ID that already exists, and an `opId` from another user.
- The final closed list, including the transient ones (`rate_limited`, `invalid`, `busy`, `upgrade_required`, `server_behind`).

---

## C. Product and UX

### 12. Edit lock defaults 🟠

Chosen without discussion (`architecture.md` §7). Confirm or change:

| Default | Current value | Alternative |
|---|---|---|
| Granularity | Whole entity (activity, stop, day title, trip header) | Per field (two people on the same card, in different fields) |
| Deleting a stop with an activity locked by someone else | Denied | Allowed (whoever was editing gets the *Restore* toast) |
| Two tabs of the same user | They compete for the lock like two people ("Open in another tab") | The second tab "steals" the lock from the first |
| Validity without renewal | 15 s | 10–30 s |
| Inactivity with the card open | 2 min → "Editing paused" | 5 min, or never |

### 13. How the lock feels on a bad connection 🟠

**Why it matters:** asking for the lock costs a round trip to the server (20–100 ms, or more on 4G). If the UI waits for the answer, opening a card feels stuck.

**To decide:**
- **Optimistic open:** the card opens and you can type right away. If `lock.denied` comes back, what happens to what was already typed (kept as a draft? discarded?).
- The visual states: "requesting", "yours", "Ana's", "paused", "in another tab".
- What to show when the connection drops **while** the person is editing.

**Starting recommendation:** optimistic open. If `denied` comes back, the typed text becomes a local draft with the notice "Ana is editing — your draft is kept" and an *Apply when free* button.

### 14. Changed screens and phone screens 🟠

**Why it matters:** the current design is desktop-only (1440 px) and has screens that no longer exist.

- **Removed:** ConflictChanges, ConflictDeleted, ConflictField, OfflineStop, TripOffline and the "Save X offline" button.
- **Changed:** Offline (becomes the "viewing only" banner), SyncStatus (no pending queue) and CardSheet (no Documents).
- **Missing:** the "Ana is editing" state on the card, the stop and the day title; "Editing paused"; "Open in another tab"; the rejection toasts (`deleted`, `locked`, `stop_overlap`); the "Outside the stop's dates" section on the Board; and **every phone screen**.

**To decide:** who designs them, and whether the phone screens come from the design or are derived from the desktop components.

### 15. Push or only fill when adding a stop 🟡

**Why it matters:** overlap is already forbidden (D14). The UX is missing: AddStop says "adds 2 days", which suggests pushing the following stops.

**Options:** only fill gaps · push the following stops (a `stops.shift` op, cheap thanks to D12) · ask.

**Starting recommendation:** only fill gaps, and offer "push the following stops" as an explicit action in the Overview. That way no stop changes dates without someone asking.

### 16. Where the "All activity" feed lives 🟡

**Why it matters:** the feed was a tab of the "What changed" panel, which is gone. The data is still in `ops_log`.

**Options:** a popover on the status pill · its own tab in the trip · out of v1.

**Starting recommendation:** a popover on the status pill ("Leo moved *Coliseum tour* · 2 min"). It reuses a screen that already exists and shows real time at work.

### 17. *Viewer* role (read-only) 🟢

It doesn't change the architecture (the role is already checked inside the transaction). It is a product question: does a family member only follow the itinerary? It is in v2 of the roadmap.

---

## D. Technical validation

### 18. Service Worker spike: success criteria 🔴

**Why it matters:** it is the biggest technical risk on the web, and it needs a clear pass/fail before offline is built on top of it.

**Proposed criteria:**
- Open `/t/:id` with no network after one visit, with the plan coming from IndexedDB.
- Update the app (new deploy) and have the old SW replaced within 1 reload.
- Work on Chrome Android and Safari iOS (iOS is web-only, but it will show up in the video).
- Switch the language (D35) and have the app routes served in the new language on the next offline open.

**Plans B and C:** a static SPA served by the SW · no offline in v1 (banner only).

### 19. Out-of-order messages: timings and test plan 🟠

**Why it matters:** it is the heart of real time. A bug here makes someone see a different plan without noticing.

**To decide:**
- How long to wait for a missing version before asking for a `resync` (today ~500 ms).
- The `ping` cadence: architecture §7 renews locks every ~5 s, and `deploy.md` §4 says 25 s (Cloudflare's limit). Unify on 5 s?
- Which failures the property test injects: reorder, drop, duplicate, disconnect and switch instance.

### 20. Version discipline (P7) in practice 🟡

**Why it matters:** "read one release before writing" is discipline, not code, so it is easy to forget.

**To decide:**
- Where the protocol version number lives (`core`) and who bumps it.
- ~~A checklist item in the PR template ("does this PR emit a new op or effect type?")~~ Done: it is in `.github/pull_request_template.md`.
- When the "API N and N+1 side by side" test enters CI: from the start, or only before the first deploy with a protocol change.

### 21. New limits (lock and cursors) 🟢

Missing from the limits table (`architecture.md` §18):
- `lock.acquire` per connection (proposal: 10/s).
- Concurrent locks per tab (proposal: 3).
- Confirm that the 30/s presence limit covers the cursor throttled at 50 ms (20/s).

---

### 24. Auth limits across instances 🟢

**Why it matters:** Better Auth's rate limit and the limit of 3 emails per address an hour (D41) keep their counters in each API process's memory. With 2 instances (M5), each one counts apart, so the real limits double; a restart also resets them.

**Starting recommendation:** move both to Redis with the second instance: Better Auth's `secondary-storage` for the rate limit, and the same Redis for the email counter.

---

## F. Practical preparation

- [ ] Domain: pick the name (`caravan.x` is a placeholder today) and buy it on Cloudflare Registrar. It comes before Resend.
- [ ] Resend: in use since M1, sending from `onboarding@resend.dev`, which only delivers to the account owner's address. Arbitrary addresses, and so sign-up in production, wait for the verified domain.
- [ ] Google OAuth client and Sign in with Apple (when they come in; Apple requires the paid developer account).
- [ ] `LICENSE`.

---

## Sync engine acceptance criteria

What must pass before starting the web UI:

- **Convergence (fast-check):** N clients, random ops (including system ops), out-of-order delivery, drops, duplicates and reconnections. All of them end with the same state as the server, compared by hash.
- **Single decision:** resending the same `opId` at any time always returns the same response and does not change the state.
- **Exclusive lock:** two tabs never both get an update/move/delete op accepted on the same entity while the other holds the lock, including with 2 instances and with Redis down.
- **Lock resumption:** a tab that reconnects in < 15 s keeps its own lock.
- **Shortening and extending** a stop is reversible without losing any activity.
- **Overlap:** an overlapping stop is rejected, and the client gets its data back to reopen the form.
- **Prefetch:** the server reader throws when reading outside the `ReadSet`, and the property test runs with it without failures.
- **Removing a member:** none of their ops is accepted at a version after the removal, and their locks disappear in the same transaction.
- **Performance:** trip lock < 2 ms at p95 with 2,000 activities; checking the edit lock adds < 0.2 ms.
- **Compatibility:** the previous version's fixtures (messages and `ops_log`) pass from the first release.
