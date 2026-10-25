# Caravan — Development standards

> How we write code in this project: what applies to every task, whatever the milestone.
> Architecture decisions are in [`architecture.md`](./architecture.md); the vocabulary, in [`CONTEXT.md`](../../CONTEXT.md).
> Draft: each section ends with what is still open.

---

## 1. Responsiveness and accessibility

**Rule:** they are part of "done" for every screen and component. There is no "make it responsive" or "make it accessible" milestone later.

**Target:** WCAG 2.2 level AA, on the web, on phone and desktop.

### Responsiveness

- **Mobile-first:** the base style is the phone's; larger screens come in through breakpoints.
- **Reference widths:** 360 px (phone), 768 px (tablet), 1280 px (desktop). No horizontal page scroll from 320 px up.
- **Touch:** touch targets of at least 44 × 44 px.
- **Nothing hover-only:** every action that shows on hover can also be reached by touch and keyboard.
- **Drag & drop** has three paths: pointer (mouse and touch), keyboard, and a non-drag alternative (e.g. a "Move to…" menu). The non-drag alternative is required by WCAG 2.5.7.
- **Sheets and dialogs** go full screen on phones.

### Accessibility

- **Semantic HTML first:** `button`, `a`, `label`, `nav`, `main`, headings in order. ARIA only when native HTML can't do it.
- **Keyboard:** everything works without a mouse, focus is always visible, focus order is logical. Sheets and dialogs trap focus, close with `Esc` and return focus to whatever opened them.
- **Forms:** every field has a `label`; errors are tied to the field (`aria-describedby`) and announced. This also covers server rejections (`stop_overlap`), when the form reopens with the user's data.
- **Real time:** relevant remote changes are announced through `aria-live="polite"`, throttled. A remote change never steals focus from someone who is editing.
- **Color:** AA contrast checked in the `tokens`, including text on the stop colors. Color is never the only signal (a member has a color **and** initials or a name).
- **Motion:** animations respect `prefers-reduced-motion`.
- **Zoom:** the interface works at 200% zoom.
- **Language:** the `<html>` `lang` follows the chosen language (`pt-BR` or `en-US`, D34).

### "Screen done" checklist

- [ ] Works at 360 px and at 1280 px
- [ ] Usable with the keyboard only, with visible focus
- [ ] Passed a screen reader (Orca or NVDA on desktop, TalkBack on Android)
- [ ] No axe violations
- [ ] Animations respect `prefers-reduced-motion`

### Open

- ~~Automated checking tools~~ Decided in the web setup (plan 4, B7): `axe-core` runs in the component tests with happy-dom for what needs no layout (names, labels, roles, ARIA); color contrast is the tokens' own test (`packages/tokens`); axe in a real browser comes with Playwright.
- Do breakpoints become theme tokens, or do we keep the UI library's defaults?

---

## 2. TDD

**Rule:** every change to production behavior starts from a failing test. **Red → Green → Refactor** cycle, one vertical slice at a time.

**Scope:** every change to production behavior, including configuration and infrastructure changes that change how the application behaves in production and have testable behavior to specify. The only ways out of the cycle are the exemptions and the TDD policy exceptions below.

Configuration and infrastructure changes that don't change the application's production behavior need no artificial RED → GREEN cycle, but they still need checks that fit their nature and impact, described in the PR under "How it was tested". Being outside the cycle doesn't mean skipping validation, and no check is reported as passed without evidence that it ran.

### The cycle

1. **Red:** write one focused test describing an observable behavior. Run it and confirm that it fails for the expected reason.
2. **Green:** only after observing a valid RED, implement the minimum production code needed to make that test pass. Run the test again.
3. **Refactor:** when there is a concrete improvement to make, refactor while the relevant tests are green. Preserve behavior and rerun the relevant tests.
4. Repeat for the next behavior, using what the previous cycle taught you.

- **Small increments:** prefer one behavior per cycle. Do not write an entire feature's test suite before implementing it.
- **No speculative implementation:** implement only what the current behavior requires.
- **Refactoring preserves behavior:** do not combine unrelated behavior changes with a refactor. Larger structural changes may be handled separately, with green tests as the safety net.
- **Bug fixes start with a regression test:** reproduce the bug and observe the expected failure before implementing the fix.
- **Test failures must be meaningful:** a missing dependency, broken test setup, or unrelated error does not establish the intended RED state. In the first test of new code, a missing module or export of the code under test counts as RED when that absence is the expected reason; a missing external package, a wrong import path, a broken runner or any other configuration or environment problem does not.
- **A test that passes on its first run has not shown RED:** find out why before writing the implementation.
- **Fix what can be fixed:** an invalid failure that can be fixed within the task is fixed, and the test runs again. It is a blocked test (below) only when it can't be resolved within the task's scope.
- **Verification is evidence:** never claim that a test passed without executing it and observing the result.

### What makes a good test

- **It tests behavior through a public interface** (*seam*), never internal details. If a test breaks in a refactor that didn't change behavior, the test was wrong. A test seam is the public boundary where behavior is observed or isolated; it does not mean creating a new architecture port.
- **Seams are agreed on first:** tests sit on the seams in "Project seams" below, which also says when the project owner must be consulted.
- **The expected value comes from an independent source** (a known literal, an example from the design, the domain rule), never recomputed the way the code computes it.
- **The name describes the behavior** in domain language ([`CONTEXT.md`](../../CONTEXT.md)): "rejects a stop that overlaps another", not "tests validateStop". Test names are in English, like the code.

### Project seams

These seams are the default reference for tests. A task that uses a listed seam, without changing or contradicting it, needs no new confirmation. The table does not by itself authorize architecture changes.

| Area | Seam | How |
|---|---|---|
| `packages/core` | `decide()` and the mutations of each op | Pure functions: input → output, no mocks |
| `packages/sync` | The package's public API | `Transport`/`Storage`/`Clock` ports with fakes |
| `apps/api` | WS and REST | Real API + Postgres + Redis from the compose file |
| `apps/api` migrations | The migrations folder and the Drizzle schema | Applied to a real, empty Postgres; schema × migrations through `drizzle-kit/api`; the additive policy (`deploy.md` P11) as a pure function tested with literal SQL |
| `apps/web` | What the user sees | `bun test` + Testing Library + happy-dom, querying by role and label (which also enforces accessibility). The network edge is the axios instance's adapter (`__tests__/support/fake-api.ts`) and `next/navigation` gets a stand-in; server components stay thin and are checked by hand |
| Flows | Browser | Playwright |

**API, by default** (`architecture.md` D29):

- Everything an Elysia route validates (`body`, `query`, `params` and `headers`) is declared on the route with Elysia's `t` (TypeBox): `body: t.Object({ ... })`. Never Zod for route input. Response schemas are not declared for now.
- Routes live in `routes.ts` files (`src/<area>/routes.ts`), and those files never import `zod`.
- Limits the clients share (e.g. the length of a name) come from `core` as constants and feed the `t` schema, so the route and the web form use the same numbers without sharing a schema.
- Zod is still fine everywhere else in the API: WS ops and messages (the schemas in `core`), and any other parsing that is not route input.
- Input that fails validation or can't be parsed answers with a code, never with the validator's message (D34).

**Web, by default** (Biome enforces the imports in `apps/web/biome.json`):

- Every form is a `Form` (`src/components/form/form.tsx`): react-hook-form with a zod schema from `src/lib/schemas/`, fields from `form-fields.tsx`, and a `SubmitButton`. While the request is on its way, every control is off and the button shows a spinner with `aria-busy`. Our controls read `useFormPending()`, because happy-dom ignores a disabled fieldset.
- Every request goes through a TanStack Query hook in `src/lib/` (`useMutation`/`useQuery`). Only `src/lib/**` imports `axios` or the `api` instance; only the form components and `*-form.tsx` import `react-hook-form`.

Ask the project owner before writing the tests that depend on the choice of seam when:

- the area has no documented seam;
- the change creates or changes a public interface or a port;
- there is more than one reasonable architectural option;
- the change contradicts the documented seam.

When there are alternatives, present the options, their trade-offs and a reasoned recommendation, and wait for the project owner's decision before writing the tests that depend on it. A new seam is added to this table; if it changes the architecture, the decision is also recorded in [`architecture.md`](./architecture.md) §0, like any other decision.

The levels (unit, property, integration, chaos, E2E, load) and their tools are in [`architecture.md`](./architecture.md) §14.

### Where tests live

- One `__tests__/` directory per package or app, mirroring `src/`: `packages/core/src/stops/stop.ts` → `packages/core/__tests__/stops/stop.test.ts`.
- Test files are named `*.test.ts` (or `*.test.tsx` for components).

### Mocks

- **Only at system edges:** external network services (Photon, Resend), clock, and randomness. The filesystem may be mocked or faked only when real filesystem behavior is not part of the contract under test.
- **Never mock the database in integration tests:** integration tests that validate persistence, queries, constraints, transactions, or database behavior run against real test instances of Postgres and Redis.
- **Unit-test mock exception** (a mocking rule, not a TDD policy exception): a unit test may use a mock or fake of a repository interface to isolate the unit's business logic, if that interface already exists as a legitimate part of the architecture. This does not replace integration tests against the real database.
- **No abstractions only for mocks:** never create an interface, repository layer or abstraction just to make mocking easier. A new port must match a real, justified boundary: an external service or a port the architecture defines (`architecture.md` §4 and §10).
- **No implementation-coupled mocks:** do not mock our own modules or internal collaborators merely to make tests pass or verify implementation details.

### When TDD is not needed

These two exemptions need no individual justification in the PR, as long as the change really meets their criteria.

- **Spikes:** throwaway code written during a technical investigation, with an exploratory goal: it answers a question that guides a decision. Spike code is disposable and is never carried over into the final implementation: if the answer is "it works", the real code is rewritten with TDD. A spike shared in a PR is marked as exploratory, not as production-ready.
- **Pure visual style** (spacing, color): needs no new behavioral test when it changes no behavior. It is still checked in the "screen done" checklist. A change that alters behavior is not purely visual, and the normal TDD rule applies.

### TDD policy exceptions

Any other change in scope that skips the cycle is a **TDD policy exception**. It needs:

1. A specific justification, limited to the affected change.
2. A record in the PR description, under "How it was tested".
3. The alternative checks that were done and the validations still pending.
4. A plan to resolve what is pending, when applicable.
5. Explicit approval from the project owner before the exception is treated as authorized. Recording the exception is not approval, and opening the PR does not authorize it.

An exception only waives writing the test first. It never turns a test that did not run into a passing test, and CI must still pass before merging (section 3).

### Blocked tests

- As in the cycle above, a failure caused by a missing dependency or a broken environment is not RED.
- When a required test cannot run, report the blocker and never claim that it passed.
- Don't continue the affected implementation as if its cycle were validated. Independent work that doesn't depend on the blocked validation may continue.
- Record in the PR the blocked test, its known cause, the alternative checks and what is still pending.
- Moving on without that validation is a TDD policy exception and follows the process above.
- **Postgres or Redis unavailable:** independent unit tests may still be written or run when useful, but they don't replace the integration tests that need those services.

### Legacy code

Before changing the behavior of legacy code, write a characterization test that captures the relevant current behavior, when feasible, then follow the normal cycle for the change. When a characterization test is not feasible, the change is a TDD policy exception.

### Coverage

CI requires every test to pass, with no minimum coverage threshold (decided in M1). TDD is mandatory either way.

---

## 3. Repository conventions

### Commits

- **Conventional Commits, one line, no body:** `type(scope): description`, in English. The why goes in the PR description.
- **Types:** `feat`, `fix`, `test`, `refactor`, `perf`, `docs`, `ci`, `chore`.
- **Scope:** the part of the monorepo touched (`core`, `sync`, `api`, `web`, `tokens`, `deploy`). It can be left out when the commit spans several, or when none of them applies (e.g. changes only to docs, skills or repo configuration).

### Branches and PRs

- **No direct commits to `master`.** All work goes on a short `type/description` branch (e.g. `feat/stop-overlap`) and lands through a PR.
- **CI must pass** before merging, even when working alone. Until CI exists (M1), a PR that contains only documentation, skill instructions and files, the PR template, or tool or repository configuration that adds no production code merges without CI checks; that does not mean CI passed. The first PR that adds production code also adds the CI that validates it, and from then on the rule applies to every PR. Never claim that CI or a test passed without evidence that it ran.
- **Squash merge:** each PR becomes one commit on `master`, with the PR title as the message. That is why the PR title follows the commit format.
- The PR fills in the template (`.github/pull_request_template.md`).

### Language

| What | Language |
|---|---|
| Code, test names, commits, PRs | en-US |
| Project, feature and bugfix docs | en-US |
| Implementation plans (`docs/planners/`) | pt-BR or en-US |
| README (for recruiters) | en-US (`README.md`) and pt-BR (`README.pt-BR.md`), linked to each other and updated in the same PR |
| Interface | pt-BR and en-US (D34) |

### Docs

```
docs/
  project/     project documentation: architecture, deploy, development, planner, open-topics
  design/      design screens
  features/    one doc per feature, named after the branch (feat/stop-overlap → stop-overlap.md)
  bugfix/      one doc per bugfix, named after the branch (fix/lock-renewal → lock-renewal.md)
  planners/    implementation plans per milestone, written before the code (m1-foundation/1.monorepo.md)
CONTEXT.md     domain glossary
README.md      showcase in en-US, linking to README.pt-BR.md
```
