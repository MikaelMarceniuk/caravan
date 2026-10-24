# API (Elysia) + Drizzle

> Branch: `feat/api-and-database` · Milestone: M1, item "API (Elysia) + Drizzle".
> Plan: [`docs/planners/m1-foundation/3.api-and-database.md`](../planners/m1-foundation/3.api-and-database.md).

## What

The `apps/api` workspace: an Elysia app with Drizzle configured, no tables yet. Each feature adds its own tables and migration when it is built (D38). The first migration and the migration tests come with Better Auth (plan §10).

- **`src/app.ts`:** `createApp({ db })` builds the Elysia app without opening a port, so the tests exercise the real app through `app.handle(new Request(...))`.
- **`src/health/routes.ts`:**
  - `GET /healthz` → 200 `{ "status": "ok" }`. It never touches Postgres.
  - `GET /ready` → 200 `{ "status": "ok" }` when Postgres answers a `SELECT 1`, otherwise 503 `{ "status": "unavailable" }`. The driver's error never reaches the response. Redis joins with the first code that uses it.
- **`src/db/client.ts`:** `createDb(url)`, Drizzle on `Bun.sql`, with a pool of 10 (D30) and `casing: 'snake_case'` (D38).
- **`src/db/schema/index.ts`:** empty. Each feature adds its file and re-exports it.
- **`drizzle.config.ts`:** schema in `src/db/schema/`, migrations in `src/db/migrations/`, the same casing as the client.
- **`src/index.ts`:** reads `DATABASE_URL` (required) and `PORT` (default 3000) and starts the server.
- **Scripts:** `dev`, `start`, `lint`, `typecheck`, `test` and `db:generate`. The `.env` is described in `apps/api/.env.example`.
- **Test database:** `__tests__/support/test-database.ts` creates an empty `caravan_test` before each test file that uses it and drops it afterwards. It first drops whatever an interrupted run left behind.
- **CI:**
  - an `api` area in `.github/scripts/affected-areas.sh`, which also runs when `infra/` changes;
  - an `API` job that starts the compose Postgres and runs lint, typecheck, build and test for `@caravan/api`;
  - the `CI` summary check depends on it;
  - `turbo.json` declares `DATABASE_URL` for `test` and adds `drizzle.config.ts` to the inputs.

The commands are in `AGENTS.md` → Commands.

## Decisions

| Topic | Where it is recorded |
|---|---|
| The API comes with Drizzle, in one PR; tables and migrations come with their features | Plan Q1, Q3, Q13; `architecture.md` D38 |
| Drizzle 0.45.4 / kit 0.31.11; Elysia 1.4.30 (latest, no LTS exists) | Plan Q2, Q14; `architecture.md` D39 |
| snake_case in the database | Plan Q9; `architecture.md` D38 |
| `caravan_test` created and dropped per test file | Plan Q4 |
| `DATABASE_URL` required everywhere, tests included | Plan Q8 |
| `api` CI job with the compose Postgres, also triggered by `infra/` | Plan Q11 |
| `/ready` checks only Postgres for now | Plan Q12; `deploy.md` §3 |
| The migration tests, the contract marker and the additive rules | Plan §10 (auth item) |

## How it was verified

Every result below was observed on 2026-10-24, on an aarch64 machine (Asahi, 16 KB pages), Bun 1.4.3, TypeScript 7.0.2 and Postgres 18.6 from the compose file.

- **TDD cycles** (`bun test` in `apps/api`):
  1. `/healthz`: RED with `Cannot find module '../../src/app'`, then GREEN.
  2. `/ready` with Postgres: RED with `Cannot find module '../../src/db/client'`, then GREEN.
  3. `/ready` without Postgres (a Drizzle client on `127.0.0.1:1`): RED with `Expected: 503, Received: 500`, then GREEN. The refused connection fails in about 2.5 ms.
- **Test database:**
  - after a run, `pg_database` lists only `caravan`, `postgres`, `template0` and `template1`;
  - with a leftover `caravan_test` created by hand, the next run still passes;
  - the dev database `caravan` has no tables after the runs;
  - without `DATABASE_URL`, the harness prints `DATABASE_URL is not set: copy apps/api/.env.example to apps/api/.env and run bun run infra:up.` and `bun test` exits 1 ("1 error");
  - two test files that each sleep 300 ms run one after the other, not at the same time. So two files never share `caravan_test` at once.
- **Running API** (`bun run --filter @caravan/api dev`):
  - `curl /healthz` → 200 `{"status":"ok"}` and `curl /ready` → 200 `{"status":"ok"}`;
  - after `infra:down`, `curl /ready` → 503 `{"status":"unavailable"}`; after `infra:up`, 200 again with no restart;
  - without `DATABASE_URL`, `bun src/index.ts` prints the message and exits 1.
- **`db:generate`** with the empty schema prints "No schema changes, nothing to migrate" and exits 0, but writes `src/db/migrations/meta/_journal.json` (see Deviations).
- **Affected areas:** `.github/scripts/affected-areas.sh` was simulated in a scratch clone.

  | Event | `packages` | `api` | `infra` |
  |---|---|---|---|
  | PR changing only `apps/api/src` | skipped | runs | skipped |
  | PR changing only `apps/api/drizzle.config.ts` | skipped | runs | skipped |
  | PR changing only `core` `src` | runs | skipped | skipped |
  | PR changing only `infra/compose.yml` | skipped | runs | runs |
  | PR changing only docs | skipped | skipped | skipped |
  | PR changing only `ci.yml` | runs | runs | runs |
  | Push to `master` | runs | runs | runs |

  `core` doesn't affect `api` yet because the app doesn't import it.
- **CI job, run locally:**
  - with `COMPOSE_FILE` and `DATABASE_URL` set as in the workflow and no `apps/api/.env`, `docker compose up -d --wait` and `turbo run lint typecheck build test --filter=@caravan/api --force` pass;
  - with the `env` entry removed from `turbo.json`, the same run fails with the harness message. This shows that Turbo's strict env mode needs the declaration.
- **Lint:** `actionlint` 1.7.12 and `shellcheck` (Docker images `rhysd/actionlint` and `koalaman/shellcheck`) pass; `bun run check` passes.

**Pending** (they need GitHub, after the push):

- the first real run of the `API` job on this PR. This PR changes `.github/`, `turbo.json` and `bun.lock`, so every area runs;
- the "PR without `apps/api/` or `infra/` changes → `API` skipped, `CI` green" case, checked on the next PR and noted here.

## Deviations from the plan

- **`apps/api/.env.example` came in F2, not F3:** the test harness already points to it.
- **Plan hypothesis H5 was wrong:** `drizzle-kit generate` writes an empty `src/db/migrations/meta/_journal.json` even when there are no changes, and `biome ci` fails on its compact format. So the Biome ignore of `src/db/migrations/meta`, planned for the auth item, came in now. The generated file was deleted and not committed: the folder is born with the first migration.
- **Area matching in `affected-areas.sh`:** Turbo reports `apps/api` with no trailing slash, so the planned `apps/api/` prefix never matched (found in the simulation). Workspace areas now match their path or anything below it (`^path(/|$)`).
- **`/healthz` test:** it uses a client on an unreachable port, which also shows that `/healthz` never touches Postgres.
- **The `API` job shows the container logs when a step fails,** like the `Infra` job.

## Known limits

- **`/ready` has no timeout:** a Postgres that accepts the connection but never answers would hang it. A timeout comes with the deploy, next to Caddy's health check.
- **`/ready` doesn't check Redis yet,** and doesn't return 503 during shutdown (graceful shutdown comes with the deploy).
- **Local `bun run check` needs the infra and the `.env`:** `bun run infra:up` and `apps/api/.env`.
- **Running `db:generate` now leaves an untracked `_journal.json`:** delete it until the first migration exists.
- **Elysia has no LTS:** 1.4 will probably stop getting patches once 2.0 (a rewrite) ships (D39).
- **Elysia's peer dependencies** (`@sinclair/typebox`, `exact-mirror`, `file-type`, `openapi-types`) are in `bun.lock`, even though the app doesn't use the `t` validator (D29).
- **The D29 check** (Eden infers the types and OpenAPI comes out right with Zod) waits for the first route that validates input, in REST trips.
