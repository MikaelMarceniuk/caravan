# Create and list trips

> Branch: `feat/create-list-trips` · Milestone: M1, item "REST: create and list trips".
> Plan: [`docs/planners/m1-foundation/5.create-list-trips.md`](../planners/m1-foundation/5.create-list-trips.md).

## What

- **`packages/core`:** `TRIP_NAME_MAX` (120) and the `TripSummary` type (`{ id, name }`), used by the API route and the web form. No dependencies, no Zod.
- **`apps/api`:**
  - `src/auth/session.ts`: a plugin with the `traveler` macro. A route with `{ traveler: true }` reads Better Auth's session from the request's headers and gets `traveler.id`; without a session it answers 401 `{ code: "UNAUTHORIZED" }`.
  - `src/trips/routes.ts`: `POST /api/trips` and `GET /api/trips`. The body is a `t.Object` (TypeBox); a `transform` hook trims the name before the validation, so `"   "` is refused and the 120 limit applies to the name as saved. `VALIDATION` answers 422 and `PARSE` 400, both `{ code: "INVALID_INPUT" }`.
  - `src/trips/trips.ts`: `createTrip` (the trip and the owner as a member, in one transaction) and `listTrips` (the traveler's memberships, newest first: `created_at DESC, id DESC`).
  - `trips` (`id`, `name`, `owner_id`, `created_at`) and `trip_members` (`trip_id`, `user_id`, `role`, `joined_at`; PK `(trip_id, user_id)`, index on `user_id`) in `0001_trips`. The other columns of `architecture.md` §11 come with the features that use them (plan C11).
  - `@sinclair/typebox` 0.34.52 is now an explicit dependency (it was only Elysia's peer), and so is `@caravan/core`.
  - Biome refuses `zod` in `src/**/routes.ts` (`apps/api/biome.json`).
- **`apps/web`:**

| Route | What it does |
|---|---|
| `/trips` | Server component: reads the session (none → `/sign-in`) and hydrates it; `TripsScreen` asks for the trips on the client |
| `/`, the auth screens, `/verify-email`, signing in | Lead to `/trips` when there is a session |
| `/session` | Removed, with `SessionScreen`, `SessionView` and `SignOutButton` |

  - `TripsScreen`: the header (logo + `UserMenu` with the initials, name, email and "Sign out"), "Your trips", "N coming up", the **Upcoming N / Past N** tabs and the "New trip" button. Upcoming lists a card per trip (name + "No stops yet", not a link) and ends with the dashed "Plan a new trip" card; Past says "No past trips yet". While loading, a `status` says so; when the list fails, an alert and "Try again".
  - `NewTripDialog` (shadcn `Dialog`, full screen on phones) with `NewTripForm`: the name only, "You'll be the owner.", Cancel and "Create trip". After creating, the dialog closes, the "Trip created" toast shows and the list is asked again. A failure keeps the dialog open with the name and the form's error.
  - A 401 from the trips' requests empties the session query, and the screen goes to `/sign-in` (the same effect that handles a session refresh with no session).
  - `src/lib/trips/` (`fetchTrips`, `createTrip`, `useTrips`, `useCreateTrip`) and `src/lib/schemas/trip.ts` (Zod, with `TRIP_NAME_MAX`).
  - New shadcn components: `dialog` (its close button takes a translated `closeLabel`), `dropdown-menu`, `tabs`. Every text in en-US and pt-BR, with plurals.
- **Docs:** D44 (trip dates derived from the stops: `architecture.md`, `CONTEXT.md`, `open-topics.md`, `development.md`, `planner.md`), D45 (REST conventions), and the TypeBox rule (`development.md` §2, API; D29 revised).

## Decisions

| Topic | Where it is recorded |
|---|---|
| The trip's dates come from its stops; NewTrip asks only the name | `architecture.md` D44; plan D-A, D-B |
| Route input with `t` (TypeBox), never Zod; limits from `core` | `development.md` §2, API; `architecture.md` D29; plan D-G, P1, P2 |
| Session macro, error codes, wrapped responses | `architecture.md` D45; plan C3 |
| No `dates` in the M1 contract; tabs split on the client | Plan C2, D-D |
| List fetched on the client; stay on `/trips` after creating; card without a link | Plan C6, C7, C10 |
| Columns left for later | Plan C11 |

## How it was verified

Observed on 2026-10-25: aarch64 (Asahi), Bun 1.4.3, Node 24.20.0, TypeScript 7.0.2, Postgres and Redis from `bun run infra:up`. `bun run check` passes: 79 tests in `api`, 80 in `web`, 23 in `tokens`, 1 in `core`.

**TDD cycles.** RED is the failure observed first. "Characterization" means the test passed on its first run because an earlier GREEN already did it; each of those was checked by a temporary mutation of the code (listed), then reverted.

| Behavior | RED |
|---|---|
| Listing without a session → 401 `UNAUTHORIZED` | 404: no route |
| `trips` and `trip_members` after the migrations | The literal table list lacked both; then `db:generate --name trips` |
| A traveler sees the trip they created (201, UUID id) | 404 on the POST |
| A trip without a name → 422 `INVALID_INPUT` | 422 with Elysia's default body (the validator's text) |
| A name that is only spaces | 201; the `transform` hook confirmed the plan's hypothesis (no plan B) |
| A name longer than 120 characters | 201 |
| Exactly 120 accepted; the name saved trimmed | Characterization. Mutation (limit 119, no trim): both failed |
| A name that is not text | Characterization (`t.String` and the `onError` already did it) |
| A body that is not valid JSON → 400 `INVALID_INPUT` | 400 with the parser's `Bad Request` text |
| Newest trip first | Insertion order |
| Another traveler's trips are not listed; an editor's trip is listed (member inserted in the database, D33); a new traveler lists none | Characterization. Mutations: no member filter (5 tests failed); owner's trips only ("lists a trip the traveler edits" failed) |
| An `ownerId` in the body is ignored | Characterization. A mutation taking the owner from the body did **not** fail: Elysia drops fields the `t.Object` doesn't declare before the handler, so two layers hold this |
| Creating without a session → 401 | Characterization. Mutation (no `traveler` on the POST): failed |
| Biome refuses `zod` in a `routes.ts` | A probe `src/probe/routes.ts` importing `zod` passed lint; with the rule, lint failed on it while a probe `schema.ts` with `zod` still passed. Probes deleted |
| The trips screen shows the API's trips | Missing module |
| Upcoming/Past tabs with counts, "N coming up" | No tabs |
| "No stops yet" on the card | The card had only the name |
| Only the "Plan a new trip" card with no trips | No such button |
| "No past trips yet" | The Past panel was empty |
| Loading is announced | No `status` |
| A failed list offers "Try again", which asks again | No alert |
| "New trip" opens the dialog with the name focused | No such button |
| An empty name, then one over 120 characters, show the field's error and send nothing | No error shown (one RED each) |
| Creating closes the dialog, shows the toast and the new card, and sends the trimmed name | The dialog stayed open |
| The form turns off while creating | Characterization (`Form` already does it). Mutation (`pending={false}`): failed |
| A failure keeps the dialog, the name and the error | No alert |
| Cancel and `Esc` close it and give the focus back; the card opens it too | Characterization (Radix). Mutations (Cancel without `DialogClose`; `Esc` and focus return prevented): failed |
| "Sign out" in the user menu | No menu |
| A 401 on the list goes to `/sign-in` | No navigation |
| A 401 on creating goes to `/sign-in` | Written after the code: the 401 handling of both hooks came in the previous GREEN. Mutation (no `onError` on the mutation): failed |
| Signing in opens `/trips` | Navigated to `/session` |
| The header shows who is signed in without asking again; a refresh with no session goes to `/sign-in` | Moved from the `SessionScreen` tests: characterization. Mutations (no redirect effect; session never fresh): failed |
| The screen in Portuguese, plural included | Characterization (pt-BR came with each text). Mutation (no plural in pt-BR): failed |
| axe on the screen (both tabs) and on the open dialog (with and without errors) | Characterization. axe flags `aria-hidden-focus` on the screen behind the open modal: Radix hides it with `aria-hidden` and keeps the focus in the dialog, so the dialog's test checks the dialog only |

**Fixes found by the tests:**

- The test fake returned the same array it later changed in place, so TanStack Query saw no change after the refetch; it now returns a copy, as the API's JSON always is.
- With the screen redirecting on its own when the session goes, the user menu also navigating made two `replace` calls; the menu now only refreshes the server components.

**Checked by hand** (API with a fake Resend key, so no email left the machine; web from `next build` + `next start`; two accounts confirmed in the database):

- `/trips` without a session → 307 `/sign-in`; with one → 200 with "Your trips", the traveler's name and the loading state. `/`, `/sign-in` and `/verify-email` with a session → 307 `/trips`; `/session` → 404.
- Through the web's origin: `GET /api/trips` without a session → 401 `UNAUTHORIZED`; `POST` with `"  Balkans Road Trip  "` → 201 with the trimmed name; `"   "` → 422 `INVALID_INPUT`; the owner lists it; the other account lists `[]`.

**Not checked yet** (for the project owner, before the PR): the "screen done" checklist in a real browser (360 px and 1280 px, keyboard only, Orca, 200% zoom, `prefers-reduced-motion`, the dialog full screen on a phone), and creating a trip by clicking through the real app.

## Known limits

- Elysia's 500 answers are not mapped to a code yet (out of scope, plan §7).
- No rate limit on the REST routes (Better Auth's only covers `/api/auth/*`); whether it becomes an open topic is plan C8, still with the project owner.
- No Playwright (plan B8): the web ↔ API flow is checked by hand.
