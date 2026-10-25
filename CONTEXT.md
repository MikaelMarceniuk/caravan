# Caravan — Glossary

Domain vocabulary. Code, protocol, docs and UI use these terms. Decisions: [`docs/project/architecture.md`](docs/project/architecture.md) §0.

## Plan

- **Trip**: the shared plan. It has a name and members, and its dates are derived from its stops (from the first `arriveDate` to the last `leaveDate`; none without stops, D44), and it is the unit of versioning, locking and sync.
- **Stop**: a city or place in the trip, with `arriveDate`/`leaveDate` (half-open). Stops never overlap (D14).
- **Gap**: dates between two stops with no stop in them. A gap has no Board and no activities.
- **Day**: an index `0..nights-1` inside a stop (`stopId + dayIndex`). It is not a free-standing entity. The day's date is derived (`arriveDate + dayIndex`).
- **Activity**: one item of the itinerary, anchored to `stopId + dayIndex` (D12). The UI draws it as a *card* (`ActivityCard`, `CardSheet`). **Never use "card" in the domain or the protocol** (D21).
- **Outside the stop's dates**: an activity whose `dayIndex` no longer exists because the stop was shortened. It stays in the stop and comes back on its own if the stop is extended again (D13).

## Sync

- **Op**: the intent of a change, sent by the client inside an **Envelope** (`opId`). A closed set of types that only grows (P7).
- **System op**: an op generated only by the API, from a REST endpoint (`member.*`, `trip.delete`). A client never sends one (D18).
- **Effect** (`Mutation`): the state change produced by an op the server decided. It is what the client applies to `confirmed` (D15).
- **Version**: a per-trip counter. Each accepted op uses exactly one.
- **Receipt**: the record of an op's outcome (accepted or rejected). It guarantees the same response for the same `opId` (D16).
- **Confirmed / pending / view**: the state the server accepted / local ops with no answer yet (in memory only, milliseconds) / what the UI shows (`pending` applied on top of `confirmed`).
- **Final / transient reject**: a final reject has a receipt and never changes. A transient one (rate limit, schema, `server_behind`) is resent.

## Editing

- **Edit lock**: the exclusive, time-limited right of one **tab** to edit an entity (activity, stop, day title or trip header). It lives in the `edit_locks` table in Postgres and is renewed every ~5 s. Whoever does not hold the lock sees "Ana is editing" and cannot write (D22, D24). Not to be confused with the `FOR UPDATE` on the trip row, which serializes ops.
- **Tab** (`tabId`): the stable identity of a browser tab across reconnections; it owns the edit locks.
- **There is no "conflict"** in the domain: the edit lock prevents concurrent edits. A rejected op (`deleted`, `locked`, `stop_overlap`) becomes a toast, and its content is still in memory.

## Client

- **Read-only offline**: with no connection, the plan opens from the cache (IndexedDB) but cannot be edited (D23).
