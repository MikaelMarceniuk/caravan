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
- **Forms:** every field has a `label`; errors are tied to the field (`aria-describedby`) and announced. This also covers server rejections (`stop_overlap`, `outside_trip`), when the form reopens with the user's data.
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

- Automated checking tools (e.g. `@axe-core/playwright` in E2E, `axe-core` in component tests with happy-dom). Check during the web setup what axe can verify without a real browser.
- Do breakpoints become theme tokens, or do we keep the UI library's defaults?

---

## 2. TDD

**Rule:** production code starts from a failing test. **Red → green** cycle, one vertical slice at a time.

### The cycle

1. **Red:** write **one** test that describes a behavior and watch it fail for the right reason.
2. **Green:** write only the code needed to make it pass. Don't anticipate the next test.
3. Repeat. Each test is a *tracer bullet* that answers what the previous cycle taught.

- **Don't write all the tests first** (horizontal slice): they end up testing the imagined shape of the code, not its behavior.
- **Refactoring stays out of the cycle:** it happens during review, with green tests as the safety net.
- **A bug starts with a test** that reproduces it.

### What makes a good test

- **It tests behavior through a public interface** (*seam*), never internal details. If a test breaks in a refactor that didn't change behavior, the test was wrong.
- **Seams are agreed on first:** before writing tests for an area, we decide which public interfaces they will sit on.
- **The expected value comes from an independent source** (a known literal, an example from the design, the domain rule), never recomputed the way the code computes it.
- **The name describes the behavior** in domain language ([`CONTEXT.md`](../../CONTEXT.md)): "rejects a stop that overlaps another", not "tests validateStop". Test names are in English, like the code.

### Project seams (proposal)

| Area | Seam | How |
|---|---|---|
| `packages/core` | `decide()` and the mutations of each op | Pure functions: input → output, no mocks |
| `packages/sync` | The package's public API | `Transport`/`Storage`/`Clock` ports with fakes |
| `apps/api` | WS and REST | Real API + Postgres + Redis from the compose file |
| `apps/web` | What the user sees | `bun test` + Testing Library + happy-dom, querying by role and label (which also enforces accessibility) |
| Flows | Browser | Playwright |

The levels (unit, property, integration, chaos, E2E, load) and their tools are in [`architecture.md`](./architecture.md) §14.

### Where tests live

- One `__tests__/` directory per package or app, mirroring `src/`: `packages/core/src/stops/stop.ts` → `packages/core/__tests__/stops/stop.test.ts`.

### Mocks

- **Only at the system's edges:** external network (Photon, Resend), clock, randomness.
- **Never** mock one of our own modules or the database: integration tests run against real Postgres and Redis.

### When TDD is not needed

- **Spikes:** throwaway code that answers a question. If the answer is "it works", the real code is rewritten with TDD.
- **Pure visual style** (spacing, color): checked in the "screen done" checklist, not in a test.

### Open

- Minimum coverage in CI, or just "all tests pass"? Decide when setting up the tests. TDD is mandatory either way.

---

## 3. Repository conventions

### Commits

- **Conventional Commits, one line, no body:** `type(scope): description`, in English. The why goes in the PR description.
- **Types:** `feat`, `fix`, `test`, `refactor`, `perf`, `docs`, `ci`, `chore`.
- **Scope:** the part of the monorepo touched (`core`, `sync`, `api`, `web`, `tokens`, `deploy`). It can be left out when the commit spans several.

### Branches and PRs

- **No direct commits to `master`.** All work goes on a short `type/description` branch (e.g. `feat/stop-overlap`) and lands through a PR.
- **CI must pass** before merging, even when working alone.
- **Squash merge:** each PR becomes one commit on `master`, with the PR title as the message. That is why the PR title follows the commit format.
- The PR fills in the template (`.github/pull_request_template.md`).

### Language

| What | Language |
|---|---|
| Code, test names, commits, PRs | en-US |
| Project, feature and bugfix docs | en-US |
| README (for recruiters) | en-US (`README.md`) and pt-BR (`README.pt-BR.md`), linked to each other and updated in the same PR |
| Interface | pt-BR and en-US (D34) |

### Docs

```
docs/
  project/     project documentation: architecture, deploy, development, planner, open-topics
  design/      design screens
  features/    one doc per feature, named after the branch (feat/stop-overlap → stop-overlap.md)
  bugfix/      one doc per bugfix, named after the branch (fix/lock-renewal → lock-renewal.md)
CONTEXT.md     domain glossary
README.md      showcase in en-US, linking to README.pt-BR.md
```
