# Caravan

Collaborative trip planner: a Bun monorepo with a server-authoritative sync engine.

## Docs

- `docs/project/planner.md`: product, scope and roadmap (milestones M1–M6).
- `docs/project/architecture.md`: technical reference. §0 lists every decision (D1, D2, ...).
- `docs/project/deploy.md`: infrastructure and deploy. §0 lists the decisions (P1, P2, ...).
- `docs/project/development.md`: TDD, accessibility, responsiveness and repo conventions.
- `docs/project/open-topics.md`: what is still undecided, and what each item blocks.
- `docs/features/<branch-slug>.md` and `docs/bugfix/<branch-slug>.md`: one doc per feature or bugfix.
- `docs/design/`: the design screens.
- `CONTEXT.md`: domain glossary. Code, protocol, docs and UI use these terms.

## Rules

- **TDD:** production code starts from a failing test. Tests live in `__tests__/` per package, mirroring `src/`.
- **Dependencies:** `core` imports nothing of ours; `sync` imports only `core`; no package uses DOM, Node, Bun or React Native APIs.
- **Language:** code, test names, commits, PRs and docs in en-US. Only the README is bilingual: `README.md` (en-US) links to `README.pt-BR.md`, and both change in the same PR. UI text in pt-BR and en-US; the server sends codes, never UI text.
- **Commits:** one line, no body: `type(scope): description`. Types: `feat`, `fix`, `test`, `refactor`, `perf`, `docs`, `ci`, `chore`. Scope: `core`, `sync`, `api`, `web`, `tokens` or `deploy`.
- **Branches:** never commit to `master`. Work on a short `type/description` branch and merge through a PR (squash, CI green).

## Commands

Added with the monorepo setup (M1).
