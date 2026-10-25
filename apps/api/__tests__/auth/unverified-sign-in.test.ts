import { describe, expect, test } from 'bun:test'
import { createTestApp, PASSWORD, postAuth, signUp } from '../support/auth-app'
import { createFakeMailer } from '../support/fake-mailer'
import { useTestDatabase } from '../support/test-database'

describe('signing in before confirming the email', () => {
	const database = useTestDatabase()

	test('is refused with EMAIL_NOT_VERIFIED', async () => {
		const app = createTestApp(database.db)
		const { email } = await signUp(app)

		const response = await postAuth(app, '/sign-in/email', {
			email,
			password: PASSWORD,
		})

		expect(response.status).toBe(403)
		expect(await response.json()).toMatchObject({ code: 'EMAIL_NOT_VERIFIED' })
	})

	test('with the right password, sends a new confirmation link', async () => {
		const mailer = createFakeMailer()
		const app = createTestApp(database.db, { mailer })
		const { email } = await signUp(app)

		await postAuth(app, '/sign-in/email', { email, password: PASSWORD })

		// One from sign-up, one from this sign-in.
		expect(mailer.sent.filter((sent) => sent.to === email)).toHaveLength(2)
	})

	test('with a wrong password, sends nothing', async () => {
		const mailer = createFakeMailer()
		const app = createTestApp(database.db, { mailer })
		const { email } = await signUp(app)

		await postAuth(app, '/sign-in/email', {
			email,
			password: 'not-the-password',
		})

		expect(mailer.sent.filter((sent) => sent.to === email)).toHaveLength(1)
	})
})
