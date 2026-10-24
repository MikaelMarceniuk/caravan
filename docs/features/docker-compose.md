# Docker Compose (Postgres, Redis)

> Branch: `chore/docker-compose` · Milestone: M1, item "Docker Compose (Postgres, Redis)".
> Plan: [`docs/planners/m1-foundation/2.docker-compose.md`](../planners/m1-foundation/2.docker-compose.md).

## What

Local Postgres and Redis with the production configuration (`deploy.md` §3), for development and for the integration tests that come next. It has no production code.

- **`infra/compose.yml`:** the base that production will reuse.
  - Services: `postgres:18.6` and `redis:8.10.2`.
  - Healthchecks, a `backend` network and the `pgdata` volume.
  - No published ports.
- **`infra/compose.dev.yml`:** the dev overlay.
  - Ports on `127.0.0.1` only: 5433 (Postgres) and 6380 (Redis).
  - Dev credentials `caravan`/`caravan`, database `caravan`.
  - Both can be overridden in `infra/.env` (`infra/.env.example`).
- **`infra/postgres/postgresql.conf`:** only what differs from the defaults (CAX11 values).
- **`infra/check.sh`:** checks the running services against `deploy.md` §3 and exits 1 at the first mismatch. CI and development both use it.
- **Root scripts:** `infra:up`, `infra:check`, `infra:down` and `infra:reset`.
- **CI:** an `infra` area in `.github/scripts/affected-areas.sh`, detected by path (`^infra/`), and an `Infra` job that the `CI` summary check depends on.

The commands are in `AGENTS.md` → Commands.

## Decisions

| Topic | Where it is recorded |
|---|---|
| Separate PR, ports 5433/6380, test database created by the test harness, `infra` CI job, migration tests in the schema item | Plan §8, P1–P5 |
| `infra` area detected by path, next to the workspace areas | Plan P6; `deploy.md` P10 |
| One check script for CI and local | Plan P7 |
| `shm_size: 256mb` for Postgres | Plan P8; `deploy.md` §3 |
| Postgres healthcheck over TCP | Plan P9 |
| `postgresql.conf` holds the CAX11 values; CAX21 values come with `compose.prod.yml` | Plan P10 |
| Exact image tags, no digest, updated by hand | Plan P11 |
| `vm.overcommit_memory = 1` on the production host | `deploy.md` §6 (M5) |

## How it was verified

These are infrastructure changes with no production behavior. Under `development.md` §2 they need no RED → GREEN cycle, so each slice was checked as follows. Every result below was observed on 2026-10-24, on an aarch64 machine with 16 KB pages (Asahi), Docker 29.9.2 and Compose v5.6.1.

- **Spikes before the code** (temporary containers):
  - `redis:8` (8.10.2, jemalloc 5.3.0) runs on 16 KB pages: 141 MB allocated and more than 126,000 keys with no allocator abort.
  - `postgres:18` (18.6) declares `VOLUME /var/lib/postgresql`, with `PGDATA=/var/lib/postgresql/18/docker`.
  - With the default 64 MB `/dev/shm`, a parallel hash join over 4 million rows fails with `could not resize shared memory segment ... No space left on device`. With 256 MB it passes.
  - The entrypoint starts its temporary init server with `listen_addresses=''`. So only a TCP `pg_isready` waits for the final server.
- **Start and ports:**
  - `docker compose ... config -q` passes.
  - `bun run infra:up` returns in about 4 s with both services `healthy`.
  - `ss -ltn` shows 5433 and 6380 on `127.0.0.1` only.
  - `docker compose -f infra/compose.yml config` has no `ports`.
  - `CARAVAN_POSTGRES_PORT=5444` in `infra/.env` moves Postgres to 5444, and `git check-ignore` confirms the file is ignored.
- **`infra:check`:**
  - On a fresh stack it prints 9 `ok` lines: `max_connections` 50, `shared_buffers` 256MB, `effective_cache_size` 1GB, `uuidv7()` is a version 7 UUID, `/dev/shm` 256 MB, Redis `PING`, `maxmemory` 268435456, empty `save` and `appendonly no`.
  - With `max_connections = 60` it fails with `FAIL postgres max_connections: expected '50', got '60'` and exits 1.
  - Against a Redis started without the config, it fails on `maxmemory` (`got '0'`).
- **Persistence:**
  - A Postgres table survives `infra:down` + `infra:up`, and is gone after `infra:reset` + `infra:up`.
  - A Redis key is gone after `docker compose restart redis`.
- **CI job, run locally:** with `COMPOSE_FILE` set as in the workflow, `config -q`, `up -d --wait`, `infra/check.sh` and `down -v` all pass, and the volume is removed.
- **Affected areas:** `.github/scripts/affected-areas.sh` was simulated in a scratch clone.

  | Event | `packages` | `infra` |
  |---|---|---|
  | PR changing only `infra/compose.yml` | skipped | runs |
  | PR changing only `core` `src` | runs | skipped |
  | PR changing only docs | skipped | skipped |
  | PR changing only `ci.yml` | runs | runs |
  | Push to `master` | runs | runs |

- **Lint:**
  - `actionlint` 1.7.7 (Docker image `rhysd/actionlint`) passes on the workflow.
  - `shellcheck` 0.10.0 (Docker image `koalaman/shellcheck`) passes on both scripts.
  - `bun run check` passes.

**Pending** (they need GitHub, after a push the project owner authorizes):

- the first real run of the `Infra` job on this PR. This PR changes `.github/` and `package.json`, so every area runs;
- the "PR without `infra/` changes → `Infra` skipped, `CI` green" case, checked on the next PR and noted here.

## Deviations from the plan

- **CI uses `COMPOSE_FILE`:** the job sets it once instead of repeating `-f infra/compose.yml -f infra/compose.dev.yml` in every step. The files are the same as in the root scripts.
- **CI shows the container logs when a step fails.** This was not in the plan.
- **Healthchecks use `start_interval: 1s`:** fast checks while starting, then every 10 s.

## Known limits

- **The base compose doesn't run alone:** Postgres needs `POSTGRES_PASSWORD`, which only the dev overlay sets today. The future `compose.prod.yml` will require it with no default.
- **The compose file list is repeated:** in the four `infra:*` scripts, in `infra/check.sh` and in the CI job. Change them together.
- **The image tags are updated by hand.** There is no Renovate or Dependabot (P11).
- **The `redis:8` image loads modules** (JSON, Search, Bloom, TimeSeries). We don't use them. They cost a little memory and are left as they are.
- **Redis warns that `vm.overcommit_memory` is off.** It is harmless here (`save ""`, no background save). It is fixed on the production host (`deploy.md` §6).
- **Redis test isolation is still open:** pub/sub ignores the database index. It is decided with the first test that uses Redis.
- **Docker only:** Podman is not supported.
