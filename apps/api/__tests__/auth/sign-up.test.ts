import { describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import { account } from '../../src/db/schema'
import { createTestApp, postAuth, uniqueEmail } from '../support/auth-app'
import { useTestDatabase } from '../support/test-database'

// RFC 9562: version nibble 7, variant 10xx.
const UUID_V7 =
	/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('POST /api/auth/sign-up/email', () => {
	const database = useTestDatabase()

	test('creates the account and signs the traveler in', async () => {
		const app = createTestApp(database.db)
		const email = uniqueEmail()

		const response = await postAuth(app, '/sign-up/email', {
			name: 'Ana',
			email,
			password: 'a-long-password',
		})

		expect(response.status).toBe(200)
		const body = (await response.json()) as { user: unknown }
		expect(body.user).toMatchObject({ name: 'Ana', email })
		expect(response.headers.get('set-cookie')).toContain(
			'better-auth.session_token=',
		)
	})

	test('gives the traveler a UUIDv7 id', async () => {
		const app = createTestApp(database.db)

		const response = await postAuth(app, '/sign-up/email', {
			name: 'Ana',
			email: uniqueEmail(),
			password: 'a-long-password',
		})

		const { user } = (await response.json()) as { user: { id: string } }
		expect(user.id).toMatch(UUID_V7)
	})

	test('saves the language the traveler signed up in', async () => {
		const app = createTestApp(database.db)

		const response = await postAuth(app, '/sign-up/email', {
			name: 'Ana',
			email: uniqueEmail(),
			password: 'a-long-password',
			locale: 'pt-BR',
		})

		const { user } = (await response.json()) as { user: { locale: string } }
		expect(user.locale).toBe('pt-BR')
	})

	test('falls back to English when no language is sent', async () => {
		const app = createTestApp(database.db)

		const response = await postAuth(app, '/sign-up/email', {
			name: 'Ana',
			email: uniqueEmail(),
			password: 'a-long-password',
		})

		const { user } = (await response.json()) as { user: { locale: string } }
		expect(user.locale).toBe('en-US')
	})

	test('rejects a language the interface does not have', async () => {
		const app = createTestApp(database.db)

		const response = await postAuth(app, '/sign-up/email', {
			name: 'Ana',
			email: uniqueEmail(),
			password: 'a-long-password',
			locale: 'fr-FR',
		})

		expect(response.status).toBe(400)
		expect(await response.json()).toMatchObject({ code: 'INVALID_LOCALE' })
	})

	// Better Auth's limits are 8 to 128 characters; the project keeps them (plan A2).
	test('rejects a password shorter than 8 characters', async () => {
		const app = createTestApp(database.db)

		const response = await postAuth(app, '/sign-up/email', {
			name: 'Ana',
			email: uniqueEmail(),
			password: 'seven77',
		})

		expect(response.status).toBe(400)
		expect(await response.json()).toMatchObject({ code: 'PASSWORD_TOO_SHORT' })
	})

	test('accepts a password of exactly 8 characters', async () => {
		const app = createTestApp(database.db)

		const response = await postAuth(app, '/sign-up/email', {
			name: 'Ana',
			email: uniqueEmail(),
			password: 'eight888',
		})

		expect(response.status).toBe(200)
	})

	test('rejects a password longer than 128 characters', async () => {
		const app = createTestApp(database.db)

		const response = await postAuth(app, '/sign-up/email', {
			name: 'Ana',
			email: uniqueEmail(),
			password: 'x'.repeat(129),
		})

		expect(response.status).toBe(400)
		expect(await response.json()).toMatchObject({ code: 'PASSWORD_TOO_LONG' })
	})

	test('rejects an invalid email', async () => {
		const app = createTestApp(database.db)

		const response = await postAuth(app, '/sign-up/email', {
			name: 'Ana',
			email: 'not-an-email',
			password: 'a-long-password',
		})

		// Rejected by the body schema, before INVALID_EMAIL would apply.
		expect(response.status).toBe(400)
		expect(await response.json()).toMatchObject({ code: 'VALIDATION_ERROR' })
	})

	// The stored format is the contract: changing it later means rehashing every password (D32).
	test('stores the password as an argon2id hash', async () => {
		const app = createTestApp(database.db)

		const response = await postAuth(app, '/sign-up/email', {
			name: 'Ana',
			email: uniqueEmail(),
			password: 'a-long-password',
		})
		const { user } = (await response.json()) as { user: { id: string } }

		const [credential] = await database.db
			.select({ password: account.password })
			.from(account)
			.where(eq(account.userId, user.id))
		expect(credential?.password).toStartWith('$argon2id$v=19$m=19456,t=2,p=1$')
	})
})
