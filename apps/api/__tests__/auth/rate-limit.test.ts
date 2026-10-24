import { describe, expect, test } from 'bun:test'
import { createTestApp, PASSWORD, postAuth } from '../support/auth-app'
import { useTestDatabase } from '../support/test-database'

// Better Auth's own rule for /sign-in: 3 requests per address every 10 seconds.
const ALLOWED_SIGN_INS = 3

describe('sign-in rate limit', () => {
	const database = useTestDatabase()

	const signInFrom = (app: ReturnType<typeof createTestApp>, address: string) =>
		postAuth(
			app,
			'/sign-in/email',
			{ email: 'nobody@example.com', password: PASSWORD },
			{ 'x-forwarded-for': address },
		)

	test('turns away an address that keeps trying', async () => {
		const app = createTestApp(database.db)
		for (let i = 0; i < ALLOWED_SIGN_INS; i++)
			await signInFrom(app, '203.0.113.7')

		const response = await signInFrom(app, '203.0.113.7')

		expect(response.status).toBe(429)
	})

	test('still lets other addresses try', async () => {
		const app = createTestApp(database.db)
		for (let i = 0; i < ALLOWED_SIGN_INS; i++)
			await signInFrom(app, '203.0.113.7')

		const response = await signInFrom(app, '198.51.100.2')

		expect(response.status).toBe(401)
	})
})
