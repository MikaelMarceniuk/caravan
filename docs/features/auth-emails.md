# Auth emails: required verification and forgot password

> Branch: `feat/auth-emails` (stacked on `feat/email-sign-in`) · Milestone: M1, item "Auth with Better Auth".
> Plan: [`docs/planners/m1-foundation/4.email-sign-in.md`](../planners/m1-foundation/4.email-sign-in.md) (PR 2 of 3).

## What

The API now sends email through Resend. Signing in needs a confirmed email, and a forgotten password can be reset by email.

- **Port `Mailer`** (`src/email/mailer.ts`): `send({ to, subject, html, text })`. `createResendMailer({ apiKey, from, baseUrl? })` calls `POST https://api.resend.com/emails` with `fetch` and throws `Resend refused the email: <status>` when Resend says no (only the status: the body may echo the address). Tests use `__tests__/support/fake-mailer.ts`.
- **Templates** (`src/email/templates.ts`): `verificationEmail` and `resetPasswordEmail`, `{ locale, name, url }` → `{ subject, html, text }`, in pt-BR or en-US by `user.locale`. Everything in the HTML is escaped, the name included.
- **Better Auth** (`src/auth/auth.ts`):
  - `requireEmailVerification: true`. With it, sign-up never opens a session and answers a taken email exactly like a new one, sending nothing.
  - `emailVerification`: `sendOnSignUp`, `sendOnSignIn` (signing in with the right password sends a new link), `autoSignInAfterVerification`.
  - `sendResetPassword` and `revokeSessionsOnPasswordReset: true`.
  - Emails are never awaited; a failure is logged as `Failed to send the <kind> email:` with the error, never the address, the body or the link.
  - **At most 3 emails per address an hour** (`src/email/send-limit.ts`), verification and reset together, in memory. Over it, nothing is sent (`Skipped a <kind> email: the address reached its limit.`) and the answer doesn't change.
- **Settings:** `RESEND_API_KEY` and `EMAIL_FROM` are required (`apps/api/.env.example`). `EMAIL_FROM` is `"Caravan <onboarding@resend.dev>"` until the domain is verified.

**Flows for a client** (paths under `/api/auth`):

| Flow | Request | What happens |
|---|---|---|
| Sign-up | `POST /sign-up/email` `{ name, email, password, locale?, callbackURL: '/verify-email' }` | 200, no cookie; the verification email goes out |
| Confirm | the emailed link (`GET /verify-email?token=…&callbackURL=/verify-email`) | 302 to `/verify-email` with the session cookie; a bad or expired link → 302 to `/verify-email?error=INVALID_TOKEN` |
| Sign-in before confirming | `POST /sign-in/email` | 403 `EMAIL_NOT_VERIFIED`; with the right password, a new link goes out |
| Forgot password | `POST /request-password-reset` `{ email, redirectTo: '/reset-password' }` | 200 with the same body whether the account exists or not |
| Reset link | the emailed link (`GET /reset-password/<token>?callbackURL=/reset-password`) | 302 to `<web origin>/reset-password?token=…` (absolute) |
| New password | `POST /reset-password` `{ token, newPassword }` | 200, and every session is gone; a bad token → 400 `INVALID_TOKEN` |

## Decisions

| Topic | Where it is recorded |
|---|---|
| `Mailer` port, Resend over `fetch`, templates, not awaiting, per-address limit | `architecture.md` D41; plan B1–B4 |
| Roadmap: forgot password and auth emails move from M4 to M1; the domain gates sign-up in production | `planner.md` §8; plan A12 |
| Shared counters with 2 instances | `open-topics.md` item 24 |

## How it was verified

Observed on 2026-10-24: aarch64 (Asahi), Bun 1.4.3, TypeScript 7.0.2, Postgres 18.6 from the compose file. `bun test` in `apps/api`: 64 tests pass.

| Behavior | RED |
|---|---|
| Verification email in Portuguese / in English | Missing module; then `Received: "Confirme seu email no Caravan"` for English |
| The link is in the HTML (escaped `&amp;`) and in the text | `html` was undefined |
| The name is plain text in the HTML | Characterization (everything was escaped since the link cycle) |
| The reset email, in both languages, with the link | `Export named 'resetPasswordEmail' not found` |
| Resend gets the message with the API key | Missing module |
| Resend refusing the message fails the send | The promise resolved |
| Sign-up sends one verification email in the traveler's language | `Expected length: 1, Received length: 0` |
| Sign-up doesn't sign in before confirming | A session cookie was set |
| The link confirms the email and signs in | `The response set no session cookie.` |
| A broken link → `INVALID_TOKEN` | Characterization |
| A taken email looks the same and sends nothing | Characterization (Better Auth with required verification) |
| Sign-in before confirming → 403 `EMAIL_NOT_VERIFIED` | Characterization |
| …with the right password, a new link | `Expected length: 2, Received length: 1` |
| …with a wrong password, nothing | Characterization (H12) |
| Forgot password emails the link in the traveler's language | `Expected: 200, Received: 400` (no `sendResetPassword`) |
| Unknown email answers the same and sends nothing; the link leads to the page with a token; the new password works and the old doesn't; a bad token → `INVALID_TOKEN` | Characterization |
| A reset signs out every session | The old session was still there |
| A failing provider: sign-up answers as usual; the log has the kind, not the address | Characterization (the guard came with the first email) |
| Send limit: 3 then refuse; again after an hour; per address, any case | Missing module; then `[false]` where `true` was expected; then the case |
| Emails to one address stop at 3 an hour while the answers stay the same | `Expected length: 3, Received length: 4` |

The first 7 sign-in, session and cookie tests of `feat/email-sign-in` assumed sign-up opened a session; they now confirm the email through the fake mailer's link first (`signUpVerified`).

**End to end over HTTP** (a scratch script: the real app on port 3000, the real Resend adapter pointed at a local stand-in for Resend):

- sign-up → 200, no cookie;
- one email, from `Caravan <onboarding@resend.dev>`, subject `Confirme seu email no Caravan`, link on `http://localhost:3001/api/auth/verify-email`;
- the link → 302 `/verify-email` with a session; `get-session` → verified, `locale: "pt-BR"`.

Without `RESEND_API_KEY` or `EMAIL_FROM`, the API prints `<NAME> is not set: …` and exits 1.

**Plan hypotheses:** H12 (403 `EMAIL_NOT_VERIFIED`, new link only with the right password), H13 (same answer for unknown emails) and H14 (both tokens last 1 hour by default, as the reset email says) confirmed.

## Deviations from the plan

- **The verification error is `INVALID_TOKEN`**, uppercase, like the reset one; Better Auth's docs say `invalid_token`.
- **The reset link redirects to an absolute URL** on the web's origin; the verification link redirects to the relative path.
- **No per-IP `customRules`:** plan B4 was changed to 3 emails per address an hour. Better Auth's own per-IP rule for `request-password-reset` and `send-verification-email` (3 per 60 s) still applies.
- **`index.ts` reads `RESEND_API_KEY`/`EMAIL_FROM` since the verification commit**, which needed the mailer.

## Pending

- **A real email through Resend** (H15): needs `RESEND_API_KEY` in `apps/api/.env`. With `onboarding@resend.dev`, only the Resend account owner's address receives it.

## Known limits

- **Sign-up in production waits for the domain:** until it is verified in Resend, nobody but the account owner gets the link.
- **The send limit is in memory:** reset on restart, per instance (open-topics item 24).
- **A traveler over the limit gets no email and no notice** (the answer can't differ without revealing the account).
