# Email and password auth + first migration

> Branch: `feat/email-sign-in` · Milestone: M1, item "Auth with Better Auth".
> Plan: [`docs/planners/m1-foundation/4.email-sign-in.md`](../planners/m1-foundation/4.email-sign-in.md) (PR 1 of 3; emails come in `feat/auth-emails`, the web in `feat/web-auth`).

## What

Better Auth in the API, with email and password, and the first migration with its tables. In this branch there is no email yet: signing up opens the session right away and the account keeps `emailVerified = false`.

- **`src/auth/auth.ts`:** `createAuth({ db, secret, baseURL })`.
  - Drizzle adapter on the application's `db` (`Bun.sql`).
  - Passwords through `src/auth/password.ts`: argon2id, 19 MiB, 2 iterations (D32).
  - Ids from Postgres: `generateId: false` + `DEFAULT uuidv7()` (D28).
  - `user.locale`: optional, `en-US` when missing; anything other than `pt-BR`/`en-US` → 400 `INVALID_LOCALE` (D40).
  - Rate limit on in every environment, in memory, with Better Auth's rules.
- **`src/app.ts`:** `createApp({ db, auth })` mounts Better Auth under `/api/auth/*`.
- **Endpoints used:** `POST /api/auth/sign-up/email`, `POST /api/auth/sign-in/email`, `GET /api/auth/get-session`, `POST /api/auth/sign-out`.
- **`src/db/schema/auth.ts`:** `user`, `session`, `account`, `verification`, generated once with `bunx --bun auth@1.7.12 generate` and revised (uuid ids, `timestamptz`, `locale`).
- **`src/db/migrations/0000_auth_tables.sql`:** the first migration.
- **`src/db/migrate.ts`:** `migrateDatabase(url)`, Drizzle's `bun-sql` migrator on a connection of its own. `bun run db:migrate` runs it on `DATABASE_URL`; the test harness runs it on `caravan_test`.
- **`src/db/migration-policy.ts`:** `nonAdditiveStatements(sql)`, the additive policy (`deploy.md` P11).
- **Migration tests** (`__tests__/db/migrations.test.ts`):
  1. the migrations apply to an empty database, and applying them again changes nothing;
  2. the Drizzle schema matches the latest snapshot (`drizzle-kit/api`);
  3. every migration outside a contract phase is additive.
- **Settings:** `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` are required, like `DATABASE_URL` (`apps/api/.env.example`).

## Decisions

| Topic | Where it is recorded |
|---|---|
| Better Auth configuration (limits, ids, `locale`, rate limit, `code` over `message`) | `architecture.md` D40; plan A2–A4 |
| Additive migrations, contract marker, schema × migrations check | `deploy.md` P11; plan A5–A7 |
| Migration test seam | `development.md` §2; plan A8 |
| Unique data per test, no `TRUNCATE` | Plan A9 |

## How it was verified

Observed on 2026-10-24: aarch64 (Asahi), Bun 1.4.3, TypeScript 7.0.2, Postgres 18.6 from the compose file.

**TDD cycles** (`bun test` in `apps/api`). RED is the failure observed before the code; a characterization test passed on its first run because it pins behavior that already existed (Better Auth's, or Drizzle's), and is listed as such.

| Behavior | RED |
|---|---|
| Migrations apply to an empty database | `Cannot find module '../../src/db/migrate'` |
| Applying them again changes nothing | Characterization (Drizzle's migrator) |
| The schema matches the migrations | A temporary column in the schema: `ALTER TABLE "user" ADD COLUMN "temporary_check" text;` left to run |
| `nonAdditiveStatements`: dropped table, dropped column, dropped type/schema, rename, type change, `SET NOT NULL`/`DROP DEFAULT`, required column without default | One RED per rule (the previous rules returned `[]`); the first one, a missing module |
| It allows additive statements | Characterization (guards against false positives) |
| Every migration outside a contract phase is additive | A temporary `9999_temporary.sql` with `DROP TABLE` failed; renamed `9999_contract_temporary.sql`, it passed; then deleted |
| Passwords hashed with argon2id at 19 MiB, t=2 | `Cannot find module '../../src/auth/password'` |
| A hash only matches its own password | `Export named 'verifyPassword' not found` |
| Sign-up creates the account and signs in | `Cannot find module '../../src/auth/auth'` |
| The user id is a UUIDv7 | Characterization (the `DEFAULT uuidv7()` from the migration) |
| Sign-up saves the language | `Expected: "pt-BR", Received: undefined` |
| No language → `en-US` | Characterization (`defaultValue`) |
| An unknown language → 400 `INVALID_LOCALE` | `Expected: 400, Received: 200` (twice: see Deviations) |
| Password < 8 / exactly 8 / > 128, invalid email | Characterization (Better Auth's defaults) |
| The password is stored as argon2id | `Received: "9e2f…:5f7f…"` (Better Auth's scrypt) |
| Sign-in: right credentials; wrong password and unknown email answer the same; email case ignored | Characterization. Mutation check: with `verifyPassword` always `false`, 2 of the 3 tests failed |
| Session: who is signed in, empty without cookie, ends on sign-out; cookie `HttpOnly`, `SameSite=Lax`, `Secure` on HTTPS | Characterization |
| Rate limit: the 4th sign-in from one address in 10 s → 429; another address still gets 401 | `Expected: 429, Received: 401` |

**Running API** (`bun src/index.ts` with `apps/api/.env`):

- `bun run db:migrate` twice on the dev database: `Migrations applied.` both times; `user`, `session`, `account` and `verification` exist.
- `curl`:
  - sign-up → 200 with `locale: "pt-BR"`, `emailVerified: false` and a UUIDv7 id;
  - `get-session` with the cookie → the session; `sign-out` → `{"success":true}`; `get-session` afterwards → `null`;
  - sign-in → 200; a wrong password → `{"message":"Invalid email or password","code":"INVALID_EMAIL_OR_PASSWORD"}`.
- Without each of `DATABASE_URL`, `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`, the API prints `<NAME> is not set: copy apps/api/.env.example to apps/api/.env.` and exits 1.
- `bun run check` passes.

**Plan hypotheses:**

| # | Result |
|---|---|
| H1 Better Auth on `Bun.sql` | Confirmed |
| H2 uuid ids from `DEFAULT uuidv7()` with `generateId: false` | Confirmed |
| H3 the CLI | Confirmed, but only with `bunx --bun`: under Node, it can't load the `bun-sql` driver |
| H4 the `bun-sql` migrator, twice | Confirmed |
| H5 `drizzle-kit/api` with `snake_case` | Confirmed |
| H6 rate limit | Confirmed: `x-forwarded-for` by default; sign-in/sign-up 3 per 10 s; `request-password-reset`/`send-verification-email` 3 per 60 s |
| H7 `Origin` equal to `baseURL` | Confirmed |
| H8 `locale` enum | **Partly wrong:** the enum type is not checked at runtime. Plan B applied: a `databaseHooks.user` hook (create and update) |
| H9 email case | Confirmed |
| H10 TypeScript 7 | Confirmed |
| H11 `.mount` | Confirmed |

## Deviations from the plan

- **Invalid email code:** the body schema rejects it first, with `VALIDATION_ERROR`, not `INVALID_EMAIL`. The web maps `VALIDATION_ERROR`.
- **`locale` validation:** a database hook (H8, plan B), so `update-user` is covered too.
- **Rate limit counters are shared by every Better Auth instance in the process** (a module-level map), so a new instance per test does not isolate them (plan A9 assumed it did). The test helpers send a random `x-forwarded-for` per request; only the rate limit tests fix the address.
- **Timestamps are `timestamptz`** (the CLI generates `timestamp` without a time zone).
- **The `index.ts` change came in with sign-up** (F5), because `createApp` needs `auth` from then on.

## Known limits

- **No email yet:** sign-up signs in directly and accounts stay unverified (next branch).
- **Rate limit in memory:** reset on restart, not shared between instances (M5). Calling the API directly without `x-forwarded-for` (e.g. `curl` on port 3000) logs a warning and puts every client in one bucket; behind Cloudflare, the deploy sets `cf-connecting-ip`.
- **Exposed but not covered by our tests** (plan A10): `change-password`, `update-user`, `list-sessions`, `revoke-session`, `revoke-sessions`, `revoke-other-sessions`, `change-email`, `delete-user` (off by default).
- **Better Auth's error bodies carry an English `message`**: clients use only `code` (D40).
