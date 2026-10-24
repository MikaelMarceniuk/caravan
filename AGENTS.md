# Caravan

Collaborative trip planner: a Bun monorepo with a server-authoritative sync engine.

## Docs

- `docs/project/planner.md`: product, scope and roadmap (milestones M1–M6).
- `docs/project/architecture.md`: technical reference. §0 lists every decision (D1, D2, ...).
- `docs/project/deploy.md`: infrastructure and deploy. §0 lists the decisions (P1, P2, ...).
- `docs/project/development.md`: TDD, accessibility, responsiveness and repo conventions.
- `docs/project/open-topics.md`: what is still undecided, and what each item blocks.
- `docs/features/<branch-slug>.md` and `docs/bugfix/<branch-slug>.md`: one doc per feature or bugfix.
- `docs/planners/<milestone>/<n>.<item>.md`: the implementation plan of a roadmap item, written before the code.
- `docs/design/`: the design screens.
- `CONTEXT.md`: domain glossary. Code, protocol, docs and UI use these terms.

## Rules

- **TDD (mandatory):** For every behavior-changing production-code change, follow Red → Green → Refactor in small increments. Before implementation, read and follow `.agents/skills/tdd/SKILL.md` and the relevant rules in `docs/project/development.md`. Write a focused test first, run it, and verify that it fails for the expected reason. Then implement the minimum code needed to pass, rerun the test, and refactor only while tests remain green. Never implement an entire feature before writing its tests. For bug fixes, reproduce the bug with a failing regression test first. Do not claim tests were run unless they actually were. Skip the cycle only under the exemptions or TDD policy exceptions in `docs/project/development.md` §2, which also covers blocked tests and legacy code.
- **Dependencies:** `core` imports nothing of ours; `sync` imports only `core`; no package uses DOM, Node, Bun or React Native APIs.
- **Language:** code, test names, commits, PRs and docs in en-US. The exceptions: implementation plans in `docs/planners/` may be in pt-BR, and the README is bilingual: `README.md` (en-US) links to `README.pt-BR.md`, and both change in the same PR. UI text in pt-BR and en-US; the server sends codes, never UI text.
- **Commits:** one line, no body: `type(scope): description`. Types: `feat`, `fix`, `test`, `refactor`, `perf`, `docs`, `ci`, `chore`. Scope: `core`, `sync`, `api`, `web`, `tokens` or `deploy`; it can be left out when the commit spans several, or when none of them applies (e.g. docs, skills or repo configuration only).
- **Branches:** never commit to `master`. Work on a short `type/description` branch and merge through a PR (squash, CI green; before CI exists, only PRs limited to docs, skills, the PR template, or tool or repo configuration with no production code merge without it, as `docs/project/development.md` §3 describes).
- **Git actions:** any agent creates commits, pushes, opens PRs, approves PRs or merges only when the project owner explicitly asks for that action. Being asked to implement or audit a task does not authorize any of them.

## Commands

Tool versions come from `mise.toml` (`mise install`). Bun's version is also in the root `package.json` (`packageManager`, which Turborepo needs): change both together.

- `bun install`: install dependencies. CI uses `bun install --frozen-lockfile`.
- `bun run check`: what CI runs. Biome on the root files, then lint, typecheck, build and test in every workspace, through Turborepo (cached).
- `bun run lint`, `bun run typecheck`, `bun run build`, `bun run test`: one step in every workspace.
- `bun run format`: apply Biome's formatting and safe fixes to the whole repo.
- `bunx turbo run test --filter=@caravan/core`: one workspace only.
- Tests live in each workspace's `__tests__/` and are named `*.test.ts`; `bun test` runs them.
- `bun run infra:up`: start Postgres (`127.0.0.1:5433`) and Redis (`127.0.0.1:6380`) with Docker Compose and wait until they are healthy. Credentials `caravan`/`caravan`, database `caravan`. Ports and credentials can be overridden in `infra/.env` (see `infra/.env.example`).
- `bun run infra:check`: check that the running Postgres and Redis match `docs/project/deploy.md` §3. CI runs it too.
- `bun run infra:down`: stop them, keeping the Postgres data. `bun run infra:reset`: stop them and delete the data.
- The API reads `DATABASE_URL` (required, with no default) and `PORT` (default 3000) from `apps/api/.env`: copy `apps/api/.env.example` once. The API tests also need `bun run infra:up`; they create `caravan_test` next to the dev database and drop it after each test file.
- `bun run --filter @caravan/api dev`: start the API with hot reload. `GET /healthz` and `GET /ready` answer on `localhost:3000`.
- `bun run --filter @caravan/api db:generate`: write a migration from the Drizzle schema in `apps/api/src/db/schema/`. Each feature adds its own tables and migration; there are none yet.
