import { describe, expect, test } from 'bun:test'
import {
	createTestApp,
	PASSWORD,
	postAuth,
	signUpVerified,
	uniqueEmail,
} from '../support/auth-app'
import { createFakeMailer } from '../support/fake-mailer'
import { useTestDatabase } from '../support/test-database'

describe('POST /api/auth/sign-in/email', () => {
	const database = useTestDatabase()

	test('signs the traveler in with the right email and password', async () => {
		const mailer = createFakeMailer()
		const app = createTestApp(database.db, { mailer })
		const { email } = await signUpVerified(app, mailer)

		const response = await postAuth(app, '/sign-in/email', {
			email,
			password: PASSWORD,
		})

		expect(response.status).toBe(200)
		expect(response.headers.get('set-cookie')).toContain(
			'better-auth.session_token=',
		)
	})

	test('answers a wrong password and an unknown email the same way', async () => {
		const mailer = createFakeMailer()
		const app = createTestApp(database.db, { mailer })
		const { email } = await signUpVerified(app, mailer)

		const wrongPassword = await postAuth(app, '/sign-in/email', {
			email,
			password: 'not-the-password',
		})
		const unknownEmail = await postAuth(app, '/sign-in/email', {
			email: uniqueEmail(),
			password: PASSWORD,
		})

		// Nothing tells whether the email has an account.
		for (const response of [wrongPassword, unknownEmail]) {
			expect(response.status).toBe(401)
			expect(await response.json()).toMatchObject({
				code: 'INVALID_EMAIL_OR_PASSWORD',
			})
		}
	})

	test('ignores the case of the email', async () => {
		const mailer = createFakeMailer()
		const app = createTestApp(database.db, { mailer })
		const { email } = await signUpVerified(app, mailer)

		const response = await postAuth(app, '/sign-in/email', {
			email: email.toUpperCase(),
			password: PASSWORD,
		})

		expect(response.status).toBe(200)
	})
})
