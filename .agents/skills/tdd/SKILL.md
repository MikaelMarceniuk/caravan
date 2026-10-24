---
name: tdd
description: Mandatory test-driven development for the changes to production behavior that the project's TDD policy covers, including features and bug fixes. Use before implementing or fixing that behavior, when the user mentions "red-green-refactor", or when writing integration tests. The policy defines which tasks need it.
---

# Test-Driven Development

TDD follows the red → green → refactor cycle. This skill is the reference that makes each cycle produce tests worth keeping: what a good test is, where tests go, the anti-patterns, and the rules of the cycle. Every section applies on every cycle: consult them before and during the cycle, not after.

`docs/project/development.md` §2 is the normative source for scope, exemptions, exceptions and blocked tests. When this skill and that document differ, the document prevails.

When exploring the codebase, read `CONTEXT.md` so test names and interface vocabulary match the project's domain language, and respect the decisions in `docs/project/architecture.md` §0 and `docs/project/deploy.md` §0 that apply to the area you're touching.

## What a good test is

Tests verify behavior through public interfaces, not implementation details. Code can change entirely; tests shouldn't. A good test reads like a specification: "user can checkout with valid cart" tells you exactly what capability exists, and it survives refactors because it doesn't care about internal structure.

See [tests.md](tests.md) for examples and [mocking.md](mocking.md) for mocking guidelines.

## Seams: where tests go

A **seam** is the public boundary where a test observes or isolates behavior without reaching inside. Tests live at seams, never against internals, and a test seam does not mean creating a new architecture port.

**Test at the documented seams.** The "Project seams" table in `docs/project/development.md` §2 is the default reference: a task that uses a listed seam, without changing or contradicting it, needs no new confirmation. Ask the project owner before writing the tests that depend on the choice of seam when the area has no documented seam, the change creates or changes a public interface or a port, there is more than one reasonable architectural option, or the change contradicts the documented seam. You can't test everything, so agreeing the seams up front is how testing effort lands on the critical paths and complex logic instead of every edge case.

In those cases, ask: "What's the public interface, and which seams should we test?" Present the options with their trade-offs, giving each proposed seam a one-line note on what it catches and what it misses, and recommend one with its reasoning. Wait for the project owner's decision before writing the tests that depend on it, and record a new seam as `docs/project/development.md` §2 describes.

## Anti-patterns

- **Implementation-coupled**: mocks internal collaborators, tests private methods, or verifies through a side channel (querying the database instead of using the interface). The tell: the test breaks when you refactor but behavior hasn't changed.
- **Abstraction for mocking**: an interface, repository layer or port created only so a test can mock it. A new port must match a real boundary: an external service or a port the project's architecture defines.
- **Tautological**: the assertion recomputes the expected value the way the code does (`expect(add(a, b)).toBe(a + b)`, a snapshot derived by hand the same way, a constant asserted equal to itself), so it passes by construction and can never disagree with the code. Expected values must come from an independent source of truth: a known-good literal, a worked example, the spec.
- **Horizontal slicing**: writing all tests first, then all implementation. Bulk tests verify _imagined_ behavior: you test the _shape_ of things rather than user-facing behavior, the tests go insensitive to real changes, and you commit to test structure before understanding the implementation. Work in **vertical slices** instead: one test → one implementation → repeat, each test a **tracer bullet** that responds to what the last cycle taught you.

## Rules of the loop

- **Red before green.** Write the failing test first and confirm that it fails for the expected reason, as `docs/project/development.md` §2 defines; don't move to green without that valid red. Then write only enough code to pass it. Don't anticipate future tests or add speculative features.
- **One slice at a time.** One seam, one test, one minimal implementation per cycle.
- **Refactor when justified.** Refactoring is part of the red → green → refactor cycle. After the test passes, refactor only when there is a concrete improvement to make. Preserve behavior and rerun the relevant tests. Do not mix unrelated behavior changes into a refactor, and do not refactor merely to complete the cycle.
