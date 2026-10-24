## What and why

<!-- What changes and why. This is where the reasoning lives: commits are one line, with no body. -->

## How it was tested

<!-- Tests written first (TDD), plus any manual check. -->

**TDD policy exception or blocked test** (`docs/project/development.md` §2): <!-- Write "N/A" and delete the fields below when there is none. Spikes and purely visual changes that meet their criteria are not exceptions. -->

- Reason:
- Scope:
- Alternative checks:
- Pending / resolution plan:
- Approval: pending <!-- Only for a TDD policy exception; write "N/A" for a blocked test resolved without one. Only the project owner's explicit approval changes this. -->

## Checklist

- [ ] The PR title follows `type(scope): description`
- [ ] Every change in behavior started from a failing test, or is covered by the approved TDD policy exception above
- [ ] New or changed screen: passes the "screen done" checklist in `docs/project/development.md` (360 px and 1280 px, keyboard only, screen reader, axe, reduced motion)
- [ ] New UI text exists in both `pt-BR` and `en-US`
- [ ] Emits a new op or effect type: a previous release already reads it (P7 in `docs/project/deploy.md`)
- [ ] New decision: recorded in §0 of the right doc in `docs/project/`
- [ ] README changed: `README.md` and `README.pt-BR.md` both updated
