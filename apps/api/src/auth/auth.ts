import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { APIError } from 'better-auth/api'
import type { Database } from '../db/client'
import * as schema from '../db/schema'
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
}

export function createAuth({ db, secret, baseURL }: AuthOptions) {
	return betterAuth({
		secret,
		baseURL,
		database: drizzleAdapter(db, { provider: 'pg', schema }),
		emailAndPassword: {
			enabled: true,
			password: { hash: hashPassword, verify: verifyPassword },
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
		advanced: {
			// Postgres generates the ids: DEFAULT uuidv7() (architecture.md D28).
			database: { generateId: false },
		},
	})
}

export type Auth = ReturnType<typeof createAuth>
