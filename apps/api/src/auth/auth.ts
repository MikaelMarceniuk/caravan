import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { APIError } from 'better-auth/api'
import type { Database } from '../db/client'
import * as schema from '../db/schema'
import type { EmailMessage, Mailer } from '../email/mailer'
import { type Locale, verificationEmail } from '../email/templates'
import { hashPassword, verifyPassword } from './password'

// The interface languages (architecture.md D34).
const LOCALES = ['pt-BR', 'en-US'] as const

// Better Auth types the field as an enum but does not check the input at runtime.
function rejectUnknownLocale(user: Record<string, unknown>) {
	if (
		user.locale !== undefined &&
		!LOCALES.includes(user.locale as (typeof LOCALES)[number])
	) {
		throw new APIError('BAD_REQUEST', {
			code: 'INVALID_LOCALE',
			message: 'Unknown locale',
		})
	}
}

export type AuthOptions = {
	db: Database
	secret: string
	/** The web's public origin: email links and cookies belong to it (deploy.md P2). */
	baseURL: string
	mailer: Mailer
}

type Traveler = { email: string; name: string; locale?: unknown }

export function createAuth({ db, secret, baseURL, mailer }: AuthOptions) {
	// Not awaited: how long the provider takes must not tell whether an account exists (Better Auth's advice).
	function send(kind: string, message: EmailMessage) {
		void mailer.send(message).catch((error: unknown) => {
			// The kind and the error only: never the address, the body or the link.
			console.error(`Failed to send the ${kind} email:`, error)
		})
	}
	const emailFor = (user: Traveler, url: string) => ({
		locale: user.locale as Locale,
		name: user.name,
		url,
	})

	return betterAuth({
		secret,
		baseURL,
		database: drizzleAdapter(db, { provider: 'pg', schema }),
		emailAndPassword: {
			enabled: true,
			// Signing in waits for the confirmed email; sign-up then answers alike for new and taken emails.
			requireEmailVerification: true,
			password: { hash: hashPassword, verify: verifyPassword },
		},
		emailVerification: {
			sendOnSignUp: true,
			autoSignInAfterVerification: true,
			sendVerificationEmail: async ({ user, url }) =>
				send('verification', {
					to: user.email,
					...verificationEmail(emailFor(user, url)),
				}),
		},
		user: {
			additionalFields: {
				// The source of truth for the traveler's language (architecture.md D35).
				locale: {
					type: [...LOCALES],
					required: false,
					defaultValue: 'en-US',
				},
			},
		},
		databaseHooks: {
			user: {
				create: { before: async (user) => rejectUnknownLocale(user) },
				update: { before: async (user) => rejectUnknownLocale(user) },
			},
		},
		// On everywhere, not only in production, so it is the same in tests. In memory: one API instance until M5.
		rateLimit: { enabled: true },
		advanced: {
			// Postgres generates the ids: DEFAULT uuidv7() (architecture.md D28).
			database: { generateId: false },
		},
	})
}

export type Auth = ReturnType<typeof createAuth>
