# Caravan — Deploy

> Production and development infrastructure. The application architecture is in [`architecture.md`](./architecture.md).
> Last revised: 2026-10-24.

---

## 0. Decisions

| # | Decision | Reason |
|---|---|---|
| P1 | **All of production on one Hetzner ARM VPS**, with Docker Compose. It starts on a CAX11 (2 vCPU, 4 GB) and moves up to a CAX21 (4 vCPU, 8 GB) before the load test or when RAM gets tight | Cost ~€6.49/month (CAX21: ~€10.99); Postgres and Redis on the same machine as the API (section 1); production is reproducible with one compose file. A CPU/RAM-only upgrade keeps the disk and can be rolled back |
| P2 | **Web on the same VPS and the same origin** as the API (no Vercel) | No CORS/preflight and no cross-subdomain cookies; a single pipeline; the CDN comes from Cloudflare |
| P3 | **Caddy** as proxy/LB | TLS, LB with active health checks and WS in a few lines; a single binary |
| P4 | **Cloudflare** (DNS + proxy + Registrar) | DDoS protection, static asset caching, free origin certificate |
| P5 | **ARM end to end** | aarch64 dev machine, free ARM runner on GitHub, cheaper Hetzner ARM; no emulation |
| P6 | **On-demand staging** on a separate CAX11, created for a branch and deleted on its own after 1h without use (section 14) | Hetzner bills stopped servers, so saving money means deleting. Staging tests what the local compose can't: a real phone (the SW requires HTTPS), real Cloudflare/Caddy/WS and the P7 rolling deploy |
| P7 | **"Reader before writer" protocol** (expand/contract for ops and effects too) | Rolling deploys with mixed instances and automatic rollback without divergence (section 5) |
| P8 | **Dual stack: IPv4 + IPv6** (IPv4 at ~€0.50/month per server) | IPv6-only breaks outbound traffic to services without IPv6 (GitHub/GHCR, Grafana Cloud, Photon) and SSH from GitHub runners, which have no IPv6 |
| P9 | **Public repository** on GitHub | It is a portfolio showcase, and the ARM runner and Actions are only free for public repos. Secrets never go into the repo (section 6) |
| P10 | **CI split by area, with one summary check**: `ci.yml` has a job per area (`packages` today; `api`, `web` and `mobile` when they exist) that runs only when the area is affected: its `src/`, `__tests__/` or config changed, or one of its dependencies did (Turborepo's graph). Areas that are not workspaces, like `infra` (the compose files), are detected by path. Root config and the CI itself affect every area, and a push to `master` runs everything. A final `ci` job is the only required check | Unaffected areas cost nothing. With path filters at the workflow level, a PR that touches no code would leave the required check pending forever; the summary job always reports |

**Alternative considered:** Oracle Cloud Always Free (A1: 2 OCPU / 12 GB, €0). Rejected because of the risks of idle instance reclamation, lack of capacity in the region and account termination. Hetzner costs ~€6.49/month and is predictable. Provisioning as code (section 6) keeps migrating cheap in both directions.

---

## 1. Why a VPS and not a PaaS or a managed database

Each op holds the trip lock (`FOR UPDATE`) for ~5–6 queries.

| Postgres | RTT per query | Lock per op | Ceiling per trip |
|---|---|---|---|
| Same host | ~0.1 ms | ~1–2 ms | hundreds to thousands of ops/s |
| Managed (Neon, Supabase) | 2–20 ms | 30–100 ms | tens of ops/s |

- **Managed Redis** (Upstash) charges per command, and cursors over pub/sub every 50 ms are the worst case.
- **Fly, Railway and Render** cost 3–5× more and hide the "2 instances behind a LB" that the landing page shows off.

---

## 2. Topology

```
Browser ──HTTPS/WSS──► Cloudflare (proxy, caches /_next/static/*)
                            │  Full (strict) · origin certificate
                            ▼
      Hetzner Cloud Firewall: 443 only from Cloudflare IPs · 22 key-only
                            ▼
      ┌──────────────── VPS CAX11 · Docker Compose ─────────────────┐
      │ caddy :443                                                   │
      │   /api/*, /ws  → api-1, api-2   (least_conn, /ready every 5s)│
      │   /*           → web-1, web-2   (round_robin, /healthz)      │
      │ api-1, api-2   Bun · compiled binary                         │
      │ web-1, web-2   Next.js standalone (Node 24)                  │
      │ postgres 18    local volume                                  │
      │ redis 8        no persistence                                │
      │ backup         cron: pg_dump → Cloudflare R2                 │
      └──────────────────────────────────────────────────────────────┘
```

**Routes (same origin `caravan.x`):**

| Path | Target |
|---|---|
| `/api/auth/*` | Better Auth (inside the API) |
| `/api/*` | REST |
| `/ws` | WebSocket gateway |
| `/*` | Next.js |

Only Caddy is on the `edge` network. Postgres and Redis live on the internal network, **with no published port**. Docker bypasses ufw, so the host firewall doesn't protect published ports; access control lives in the Hetzner Cloud Firewall.

---

## 3. Services

| Service | Image | Memory (limit) | Notes |
|---|---|---|---|
| caddy | `caddy:2` | 64 MB | Cloudflare origin certificate in a file (15 years, no ACME) |
| api-1/2 | `ghcr.io/<user>/caravan-api:<sha>` | 256 MB each | `bun build --compile` on `distroless/base-nossl`; graceful shutdown (section 5) |
| web-1/2 | `ghcr.io/<user>/caravan-web:<sha>` | 256 MB each | `output: "standalone"` on `node:24-slim` |
| postgres | `postgres:18` | 1 GB | `shared_buffers=256MB`, `effective_cache_size=1GB`, `max_connections=50`, in `infra/postgres/postgresql.conf`. On the CAX21: 2 GB, `shared_buffers=1GB`, `effective_cache_size=4GB`. `shm_size: 256mb`: Docker's default 64 MB `/dev/shm` makes parallel queries fail |
| redis | `redis:8` | 300 MB | `maxmemory 256mb`, `save ""`, `appendonly no` (presence, pub/sub, cache and rate limiting are ephemeral) |
| backup | small image with `pg_dump` + `rclone` | 128 MB | Daily, 7-day retention on R2 |

**Health checks:**
- `api`: `/healthz` (process alive) and `/ready` (Postgres and Redis answering; returns 503 during shutdown).
- `web`: `/healthz`.

---

## 4. Cache and Cloudflare

- `/_next/static/*` → `Cache-Control: public, max-age=31536000, immutable`. Cloudflare caches it with no extra rule.
- **`/sw.js` and `/manifest.webmanifest` → `no-cache`.** If the Service Worker gets cached, clients never receive updates.
- `/api/*` and `/ws` → never cached (`Cache-Control: no-store`).
- WebSocket through the Cloudflare proxy: the idle timeout is 100 s; the client pings every 25 s.
- Real client IP: `CF-Connecting-IP`, trustworthy only because the origin accepts nothing but Cloudflare IPs.

---

## 5. Deploy pipeline (zero downtime)

```
push to master
 ├─ CI: typecheck · Biome · unit/property · integration (compose) · Playwright
 ├─ parallel build on the ubuntu-24.04-arm runner → push to GHCR (tag = sha)
 │    caravan-api   caravan-web
 └─ deploy (ssh, scripts/deploy.sh <sha>)
     1. docker compose pull
     2. docker compose run --rm api migrate         ← additive migrations only
     3. API rolling deploy: for each api-N
          SIGTERM → /ready returns 503 → Caddy takes it out of the pool
          closes the WS with code 1012 (Service Restart) → clients reconnect to the other instance, no backoff
          drains in-flight ops (10 s timeout) → exits
          starts the new version → waits for /ready → next
     4. web rolling deploy (same process, without the WS part)
     5. smoke test: GET /api/healthz + hello over WS + GET /
     6. failed? deploy.sh <previous sha> (old images stay on the host)
```

**`master` goes straight to production** (it only receives PR merges, never direct commits). Staging (section 14) is for testing a branch before merging, not a mandatory step.

**Every deploy exercises real reconnection.** It is a chaos test that runs by itself.

**Protocol compatibility: reader before writer (P7).** The Service Worker can keep an old version running for days, and during a rolling deploy (or a rollback) instances N and N+1 run at the same time.
- **A new op or effect type takes two releases:** in N+1, the API, web and `core` **understand** the new type, but nobody emits it; in N+2, it starts being emitted. That way, mixed instances and a 1-release rollback are always safe. Removing a type goes the other way (stop emitting, then stop understanding).
- `hello` carries `protocolVersion`, and the server accepts the current and the previous one.
  - A client older than that → `upgrade_required`: the SW updates and the page reloads. With no offline queue, there are no pending ops to preserve (in-flight ones last milliseconds).
  - A client **newer** than the server (rollback) → `server_behind`: the client goes read-only and retries with backoff.
- **Effects encoded per connection:** the gateway serializes the `effects` in each connection's protocol version. If an effect has no representation in the client's version, that connection gets `upgrade_required`, because ignoring the effect would cause divergence.
- **Versioned pub/sub and `ops_log`:** every message on `trip:{id}` and every `effects_json` carries `v`. `core` exports `Mutation` *upcasters* (for the `ops_log`) from each old version to the current one. The IndexedDB read cache needs no upcaster: an incompatible format is discarded and downloaded again.
- **Compatibility test in CI:** fixtures of the previous version's messages and `ops_log`; and an integration test with API N and N+1 side by side and clients of both versions.

**Two-phase migrations (expand/contract):** in release N, add a nullable column and have the code write both formats; in release N+1, remove the old format.

---

## 6. Provisioning

- `infra/provision/cloud-init.yaml`: Docker, a `deploy` user (SSH key only, no root), `unattended-upgrades`, 2 GB swap, `vm.overcommit_memory = 1` (Redis warns at startup without it; found in the M1 Docker Compose spike), the `/srv/caravan` directory.
- `infra/provision/tofu/` (optional, but recommended for the résumé): OpenTofu with the `hcloud` and `cloudflare` providers, creating the VPS, the firewall, the DNS records and the origin certificate. About 60 lines.
- **Hetzner projects:** `caravan-prod` and `caravan-homol`, each with its own API token. The staging token can't see production.
- **Reserved primary IPs** (`auto_delete: false`): the server can be recreated without changing DNS.
- **Secrets:** `/srv/caravan/.env` (mode 600), created by hand once; the variables are documented in `.env.example`. On GitHub, only the deploy SSH key and the GHCR token.

---

## 7. Local development

`docker compose -f compose.yml -f compose.dev.yml up` starts:
- Postgres, Redis, Caddy (`caravan.localhost`, with Caddy's own local certificate), api ×2 and web.
- **mailpit**: catches invite and password reset emails.
- **toxiproxy**, in the `chaos` profile: between the API and Postgres/Redis.

Day to day, you can also run only Postgres and Redis in compose and the API/web with `bun dev`, with hot reload.

**Today (M1):** the compose files have only Postgres and Redis, started with `bun run infra:up` (commands in `AGENTS.md`). The dev overlay publishes them on `127.0.0.1` only, on ports 5433 and 6380 by default, so they don't clash with another local Postgres or Redis; `infra/.env` overrides them. Caddy, api, web and mailpit (M4) and toxiproxy (M5) join when their milestones need them.

---

## 8. Observability (all on free tiers)

| What | Tool |
|---|---|
| Errors (web + API) | Sentry |
| Metrics (`/metrics`: WS connections, ops/s, pipeline latency, broadcast p95) | Grafana Alloy → Grafana Cloud |
| Logs | JSON stdout → Alloy → Loki (Grafana Cloud) |
| Uptime | UptimeRobot on `/api/healthz` and `/` |

A public Grafana dashboard can go in the README.

---

## 9. Load tests

- k6 runs from a **temporary** Hetzner VPS (billed hourly: create, run, destroy, costs cents), never from the production VPS itself, or the numbers get skewed.
- The tests hit **the origin directly**: the k6 IP is temporarily allowed in the firewall, with `insecureSkipTLSVerify` because the certificate is an origin certificate. Through Cloudflare, the result would measure the CDN, and the traffic could be blocked as an attack.
- The numbers (concurrent connections, broadcast p95) go into the README and the landing page.

---

## 10. Backup and recovery

- Daily `pg_dump -Fc` → R2, with 7-day retention.
- `scripts/restore.sh <date>`: **tested once a month** in a throwaway container. A backup that has never been restored doesn't count.
- Redis has no backup, by design: clients rebuild presence on the next heartbeat.

---

## 11. Cost

| Item | Cost |
|---|---|
| Hetzner CAX11 (production) | ~€6.49/month with IPv4 (CAX21: ~€10.99). October 2026 prices, after the June increase |
| Staging (CAX11 by the hour) | cents per month + ~€0.50/month for the reserved IPv4 |
| Domain (Cloudflare Registrar) | ~US$10–15/year |
| Cloudflare, R2 (10 GB), GHCR, Actions (public repo), Resend, Sentry, Grafana Cloud, UptimeRobot | free |

---

## 12. Layout

```
infra/
  compose.yml            base services and networks
  compose.dev.yml        ports, mailpit, toxiproxy (chaos profile), local Caddy
  compose.prod.yml       GHCR images, memory limits, backup, origin certificate
  compose.homol.yml      on top of prod: no backup, mailpit, seed
  caddy/Caddyfile
  postgres/postgresql.conf
  scripts/               deploy.sh · backup.sh · restore.sh · smoke.sh · idle-reaper.sh
  provision/             cloud-init.yaml · tofu/
  k6/                    load scenarios
.github/workflows/
  ci.yml                 PRs and master: a job per affected area + the `ci` summary check (P10)
  deploy.yml             master → ARM build → GHCR → deploy.sh
  homol.yml              branch → ARM build → GHCR → create staging → deploy.sh
```

---

## 13. Scaling beyond this (not for the MVP)

The architecture already supports N instances. The path would be:
1. Postgres on a dedicated VPS, on Hetzner's private network.
2. API and web on 2+ VPSs behind a Hetzner Load Balancer (~€6/month).
3. A read replica for the full-state `welcome`.

Nothing changes in the code.

---

## 14. Staging

Files and names use `homol` (short for *homologação*, staging in Portuguese).

**Lifecycle:**

```
workflow_dispatch (pick the branch) or the `homol` label on the PR
 ├─ ARM build → GHCR (the same as the production deploy)
 ├─ does staging exist? no → OpenTofu creates the CAX11 in the caravan-homol project, with the reserved IP
 ├─ deploy.sh <sha> with compose.prod.yml + compose.homol.yml
 └─ migrate + seed (the trip from the design)

idle-reaper (systemd timer, every 10 min, on staging itself)
 └─ GET /internal/idle (localhost only): no open WS and no request for more than 1h?
     └─ yes → DELETE /servers/{id} on the Hetzner API (the reserved IP stays)
```

- **Same images and same `deploy.sh` as production:** what passes on staging is what goes to production. It runs api ×2 to rehearse the rolling deploy and P7 compatibility.
- **Throwaway database:** each creation starts from the seed. Nothing on staging has to outlive it.
- **Emails go to mailpit**, never outside.
- **Closed access:** `homol.caravan.x` behind Cloudflare Access (free up to 50 users). Search engines don't index it, and nobody outside stumbles onto it.
- **Later (v1.x): wake on access.** A Cloudflare Worker on `homol.caravan.x` creates the server through the Hetzner API when it doesn't exist and shows "Starting staging…" until `/ready` answers (~2 min).
