# Monorepo setup

> Branch: `chore/monorepo-setup` · Milestone: M1, item "Monorepo (Bun + Turborepo), Biome, basic CI".
> Plan: [`docs/planners/m1-foundation/1.monorepo.md`](../planners/m1-foundation/1.monorepo.md).

## What

The tooling base the rest of M1 builds on. It has no production code.

- **Workspace root:** Bun workspaces (`apps/*`, `packages/*`), exact version pins (`bunfig.toml`), `tsconfig.base.json` and `.gitignore`.
- **`packages/core`:** empty. Its `src/index.ts` exports nothing yet. It is isolated from runtime APIs (architecture §2) and has one temporary test (below).
- **Turborepo:** `lint`, `typecheck`, `build` and `test` tasks, cached locally. There is no remote cache.
- **Biome:** shared rules and formatting at the root, and a `biome.json` per workspace that extends them (D37).
- **CI:** `.github/workflows/ci.yml` on the ARM runner, with a job per affected area and a `CI` summary check (P10).

The commands are in `AGENTS.md` → Commands.

## Decisions

| Topic | Where it is recorded |
|---|---|
| Packages consumed as source; a package's "build" is its typecheck | `architecture.md` D36 |
| Shared Biome config with per-workspace additions; Markdown not formatted | `architecture.md` D37 |
| CI split by area, with one summary check | `deploy.md` P10 |
| Every test must pass; no minimum coverage | `development.md` §2, Coverage |
| `docs/planners/` and its language exception | `development.md` §3, `AGENTS.md` |

## How it was verified

These are configuration changes with no production behavior. Under `development.md` §2 they need no RED → GREEN cycle, so each slice was checked as follows. Every result below was observed.

- **Install:**
  - In a fresh clone of the branch, `bun install --frozen-lockfile` exits 0 and leaves `git status` clean.
- **`core` isolation, through `tsc -p packages/core/tsconfig.json`:**
  - `document.title`, `Bun.file(...)`, `process.env` and `require(...)` in `src/` fail.
  - An `import ... from 'node:fs'` in `src/` fails too.
- **`core` import rules, through Biome (`bun run lint` in `packages/core`):**
  - Importing `bun` or `bun:test` in `src/` fails with `noRestrictedImports`.
  - Importing `node:fs` or `fs` fails with `noNodejsModules`.
  - Importing `@caravan/sync` fails with `noRestrictedImports`.
  - Tests in `__tests__/` can still import `bun:test`.
- **Test runner:**
  - `bun test` runs the hello test and exits 0.
  - Changing its expected value makes it exit 1.
- **Root `bun run check`:**
  - It exits 0 on a clean tree.
  - It exits 1 when there is a failing test, a type error in `core`, or a badly formatted root JSON file.
  - Code with double quotes and a semicolon fails the format check.
- **Turborepo cache:**
  - A second `check` with no changes is `FULL TURBO`.
  - Changing the root `biome.json` makes every task run again (`globalDependencies`).
- **Affected areas:** `.github/scripts/affected-areas.sh` was simulated in a scratch clone.

  | Event | `packages` area |
  |---|---|
  | Push to `master` | runs |
  | PR with no changes | skipped |
  | PR changing only docs | skipped |
  | PR changing only the PR template | skipped |
  | PR changing only a `core` test | runs |
  | PR changing only `core` `src` | runs |
  | PR changing only `tsconfig.base.json` | runs |
  | PR changing only `ci.yml` | runs |
  | PR changing only `bun.lock` | runs |

- **Workflow lint:**
  - `actionlint` (Docker image `rhysd/actionlint`) passes on the workflow.
  - `shellcheck` passes on the script.

**Pending** (they need GitHub, after a push the project owner authorizes):

- the first real CI run on this PR;
- optional: a temporary commit with a failing test, to confirm that the `CI` check goes red;
- the "docs-only PR → `packages` skipped, `CI` green" case, checked on the first docs PR after the merge and noted here.

## Temporary hello test

`packages/core/__tests__/hello.test.ts` only proves that `bun test` finds and runs this package's tests. It tests no behavior. It is removed in the PR that adds `core`'s first real test.

There is no `--pass-with-no-tests`: each new workspace is born with the test of its first code (TDD). `bun test` exits 1 when it finds no tests.

## Known limits

- **Bun's version is in two places:** `mise.toml` and `packageManager` in the root `package.json`, which Turborepo requires. Change both together.
- **`tsconfig` alone doesn't isolate `core`:** `types: []` removes globals, but TypeScript still resolves `import ... from 'bun'` through `@types/bun`. Biome's import rules close that gap.
- **"Affected" is per workspace:** Turborepo marks a workspace as affected when any of its files changes, even one outside `src/` and `__tests__/` (a README, say). This errs on the side of running.
- **Biome 2.6 formats Markdown:** the docs are excluded (`!**/*.md`) so that their tables and code blocks keep their hand-written layout.

## Branch protection (project owner)

Do this after the first CI run, because GitHub only offers a check once it has run.

1. **Settings → General → Pull Requests:** allow only **squash merging**.
2. **Settings → Rules → Rulesets → New ruleset → New branch ruleset:**
   - Name: `master`. Enforcement status: **Active**.
   - Target branches: **Include default branch**.
   - Rules:
     - **Restrict deletions**;
     - **Block force pushes**;
     - **Require a pull request before merging**, with allowed merge method **Squash**;
     - **Require status checks to pass**: add the check **`CI`** (the summary job). Don't add the area jobs: they are skipped when their area isn't affected.
3. Save. From then on, a PR merges into `master` only when the `CI` check is green.
