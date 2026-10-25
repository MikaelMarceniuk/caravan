# Web: sign up, sign in, session and sign out

> Branch: `feat/web-auth` (stacked on `feat/auth-emails`) · Milestone: M1, item "Web (Next.js)".
> Plan: [`docs/planners/m1-foundation/4.email-sign-in.md`](../planners/m1-foundation/4.email-sign-in.md) (PR 3 of 3).

## What

- **`packages/tokens`:** the colors read from the design, `contrastRatio()` (WCAG 2.2), the list of every text × background pair with the contrast it needs, and `themeCss()`, written to `theme.css` by `bun run --filter @caravan/tokens generate`.
- **`apps/web`:** Next.js 16.4.3 (App Router, `output: "standalone"`), Tailwind 4, shadcn on Radix (`button`, `input`, `input-group`, `field`, `alert`, `separator`, `sonner`), `next-intl` with no locale in the URL, axios + TanStack Query.

| Route | What it does |
|---|---|
| `/sign-up` | SignUp.png. Name, email, password with show/hide and the 8-character meter; sends the language in use; then "check your email". A taken email (if the API ever says so) goes to `/sign-in?email=…` |
| `/sign-in` | SignIn.png. `?email=` fills the field; `?reset=done` says the password was changed. Signing in stores `user.locale` in `NEXT_LOCALE` and opens `/session` |
| `/forgot-password` | Asks for the link; always answers the same way |
| `/reset-password` | `?token=` from the email → new password → `/sign-in?reset=done`; an invalid token or `?error=INVALID_TOKEN` → "ask for a new link" |
| `/verify-email` | Where the confirmation link lands: signed in → `/session`; `?error=INVALID_TOKEN` → "sign in to get a new one" |
| `/session` | Server component: forwards the request's cookie to the API's `get-session`; shows name, email, language and whether the email is confirmed; sign out. No session → `/sign-in` |
| `/` | `/session` or `/sign-in` |

The auth screens redirect to `/session` when there is already a session.

- **Language** (`src/proxy.ts`, `src/i18n/`): every page visit without a valid `NEXT_LOCALE` cookie gets one, from `Accept-Language` (`pt`, `pt-BR`, `pt-PT` → pt-BR; anything else → en-US). The first page already renders in it, and sign-up sends it to the API.
- **API access** (`src/lib/api.ts`, `auth.ts`, `session.ts`): one axios instance on `/api`. In development, Next's `rewrites` send `/api/*` to `API_URL` (default `http://localhost:3333`), so the browser sees one origin, as with Caddy in production. The server forwards `x-forwarded-for`/`cf-connecting-ip` with the cookie, so the API's rate limit counts the visitor, not the Next server.
- **CI:** a `web` area and job (lint, typecheck, build, test); Turbo knows the web's inputs and the `.next` output.

## Forms and queries (plan §11, revision 4)

- **`Form`** (`src/components/form/form.tsx`): react-hook-form + a zod schema (`src/lib/schemas/auth.ts`, messages as next-intl keys), wrapped in a fieldset. While pending, `useFormPending()` turns off every field, the show-password and Google buttons, and the `SubmitButton`, which shows shadcn's `Spinner` and `aria-busy="true"`. Forms that navigate on success (sign-in, new password) stay pending until the page changes.
- **Fields** (`form-fields.tsx`): `FormTextField`, `FormPasswordField` and `FormRootAlert` register in the form around and translate its errors; server errors come in with `setError` (`root` for the whole form).
- **Requests** (`src/lib/auth/`): `useSignUp`, `useSignIn` (refreshes the session query), `useSignOut` (empties it), `useRequestPasswordReset`, `useResetPassword` and `useSession`.
- **Session:** `/session` reads the cookie on the server, seeds the query and hydrates it; `useSession()` keeps it: fresh for 30 s, then every 60 s with the tab visible, on focus and on reconnect. When a refresh finds no session (signed out elsewhere, expired, password reset), the page goes to `/sign-in`. Signing out shows a busy button too.
- **Biome** (`apps/web/biome.json`): only `src/lib/**` may import `axios` or the `api` instance; only `src/components/form/**` and `*-form.tsx` may import `react-hook-form`.

| Behavior | RED |
|---|---|
| A form turns its controls off and the button busy while sending | Missing module; then happy-dom showed that a disabled fieldset doesn't disable its children there, so controls read `useFormPending()` |
| …and turns them back on when the request fails | Characterization |
| Sign-up, sign-in, forgot and new password turn their fields off while sending | One RED per form, on the old forms; their earlier tests held through the move to react-hook-form |
| The session screen shows what the server read, without asking again | Missing module |
| A refresh that finds the session over goes to sign-in | No navigation |
| Signing out forgets the session at once | The details stayed on screen |
| The sign-out button is busy while signing out | Characterization |
| The import rules | A probe component importing `axios`, `api` and `react-hook-form` passed lint; with the rules, 3 errors. In a `*-form.tsx`, only `api` is refused (`errorCode` stays allowed). Both probes deleted |

## Decisions

| Topic | Where it is recorded |
|---|---|
| axios + TanStack Query, no Eden; dev rewrites (web 3000, API 3333) | `architecture.md` D42; plan B5, B6 |
| Design adaptations, the language cookie, the input outline, no `dark:` styles | `architecture.md` D43; plan B9, A14 |
| axe in component tests; the web's test edges | `development.md` §1 and §2; plan B6, B7 |
| No Playwright in this item | Plan B8 |
| Forms and requests by default | Plan §11 (R1–R4); `development.md` §2; `architecture.md` D42 |

## How it was verified

Observed on 2026-10-24: aarch64 (Asahi), Bun 1.4.3, Node 24.20.0, TypeScript 7.0.2. `bun run check` passes: 23 tests in `tokens`, 53 in `web`.

**TDD cycles.** RED is the failure observed first; "characterization" means the test passed on its first run because the code it pins came in an earlier GREEN, and is listed as such.

| Area | Cycles (RED) |
|---|---|
| `contrastRatio` | 21:1 for black on white (missing module); 1:1 and WebAIM's 4.48:1 for #777 on white (characterization) |
| Tokens AA | Every pair: **the design's input outline failed with 1.42:1**, then `#6b6980` passed |
| `theme.css` | `themeCss` missing; then the file test with `ENOENT` until `generate` |
| `resolveLocale` | pt-BR (missing module); other languages; the browser's first choice by `q`; the cookie wins; a bad cookie and no header (characterization) |
| Proxy | Cookie on the first visit (missing module); a valid cookie stays, a bad one is replaced, a year/`Path=/`/`SameSite=Lax` (characterization) |
| Auth layout | The tagline in Portuguese (missing module); postcards hidden from screen readers, GitHub link, axe (characterization) |
| Sign-up | Request with the language (missing module); check your email; empty name; invalid email; short password; registered email → sign-in; 429 and unexpected errors; show/hide; the length meter; Google and Terms/Privacy toasts — each a RED first. Long password and axe: characterization |
| Sign-in | Opens `/session` (missing module); stores `NEXT_LOCALE`; `?email=`; wrong credentials; unconfirmed email; field validation; the "password changed" notice — each a RED first. Google toast, links, axe: characterization |
| Forgot password | Request (missing module); same confirmation; invalid email; 429. axe: characterization |
| Reset password | Saves with the token (missing module); short password; invalid token → new link. Missing token and axe: characterization |
| Confirmation failed, session page, sign out | Missing modules; axe: characterization |

**Fixes found by the tests:**

- happy-dom's `Request`/`Headers` drop the `cookie` header like a browser, so the proxy tests failed in the full run: the test setup keeps Bun's own fetch classes.
- Sonner replays active toasts to the next test's `Toaster`: the setup dismisses them after each test.

**Running app** (API on 3000 with the real Resend adapter pointed at a local stand-in that kept the emails; `next dev` on 3001; `curl` as the browser):

1. First visit to `/sign-up` with `Accept-Language: pt-PT` → `Set-Cookie: NEXT_LOCALE=pt-BR; Max-Age=31536000; SameSite=lax`, `<html lang="pt-BR">`, "Entre na viagem".
2. Sign-up through `localhost:3001/api/...` → 200 `token: null`; the email "Confirme seu email no Caravan" with a link on `localhost:3001`.
3. The link, through the rewrite → 302 `/verify-email` with `better-auth.session_token` (H18 confirmed: the rewrite passes cookies and redirects); `/verify-email` → 307 `/session`; `/session` → 200 with the email, "Português (Brasil)", "Sim".
4. `/sign-in` while signed in → 307 `/session`; sign-out → `/session` → 307 `/sign-in`.
5. Sign-in → 200; forgot password → 200 and "Redefina sua senha do Caravan"; its link → `/reset-password?token=…` (200); new password → 200; the old session → 307 `/sign-in`; `/sign-in?reset=done` shows the notice.
6. `/verify-email?error=INVALID_TOKEN` and `/reset-password?error=INVALID_TOKEN` show their messages.

**Screens** (Firefox headless screenshots, compared with the PNGs): sign-in and sign-up at 1440 × 900 match the design's layout, sizes and postcards (inputs and buttons 48 px, the form column 640 px); at 360 px and 320 px the postcards are gone and nothing scrolls sideways.

**Plan hypotheses:** H16 (`next build` with TypeScript 7), H17 (happy-dom with next-intl, TanStack Query and Sonner), H18 (rewrites), H19 (shadcn on Radix in the monorepo, preset `nova` + `--base radix`), H20 (Biome with Tailwind directives, `tailwindDirectives: true`), H21 (axios adapter) and H22 (calling `proxy` in `bun test`) confirmed.

## Deviations from the plan

- **`API_URL` has a default** (`http://localhost:3333`) instead of being required: Next bakes the rewrites at build time, and CI builds without one.
- **The rewrites are always on:** in production Caddy routes `/api/*` before Next, so they are never reached.
- **The Google button, Terms and Privacy** are buttons styled as links where they open nothing (B9).
- **Next 16.4's generated `AGENTS.md`** is turned off (`agentRules: false`): the repo has its own.
- **shadcn files were restyled** for the design (input and button heights, the input fill, the outline button) and the toaster is dark only (`next-themes` removed). Biome's `useSemanticElements`, `noDoubleEquals`, `noArrayIndexKey` and `useKeyWithClickEvents` are off in `src/components/ui/**` (vendored code).
- **The `<html lang>` check** is manual (the curl in step 1), not a component test: the root layout is an async server component.

## Pending (for the project owner)

- **The "screen done" checklist by hand:** keyboard only, Orca, 200% zoom and `prefers-reduced-motion` were not run (no desktop session here). The automated part passed: axe in every component test, AA contrast in the tokens, layouts at 1440/360/320.
- **Fonts and palette review** (B9): Bricolage Grotesque (titles), DM Sans (text) and JetBrains Mono (postcards) were picked from the PNGs; the colors were read from their pixels.
- **A real email** needs `RESEND_API_KEY` in `apps/api/.env` (see `auth-emails.md`).

## Known limits

- **Server components are only checked by hand** (the session read and the redirects); Playwright comes later (plan B8).
- **The postcards' text is English in both languages:** it is part of the illustration and hidden from screen readers.
- **`next/font/google` downloads the fonts at build time:** a build without network fails.
- **If the API is down, `/`, `/session` and the auth screens show Next's error page** (they ask the API for the session).
