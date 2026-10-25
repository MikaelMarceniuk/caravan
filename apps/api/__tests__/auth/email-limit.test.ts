import { describe, expect, test } from 'bun:test'
import { createTestApp, postAuth, signUpVerified } from '../support/auth-app'
import { createFakeMailer } from '../support/fake-mailer'
import { useTestDatabase } from '../support/test-database'

describe('emails to one address', () => {
	const database = useTestDatabase()

	test('stop at 3 an hour, while the answers stay the same', async () => {
		const mailer = createFakeMailer()
		const app = createTestApp(database.db, { mailer })
		// The verification email is the first of the 3.
		const { email } = await signUpVerified(app, mailer)

		const answers = []
		for (let i = 0; i < 3; i++) {
			const response = await postAuth(app, '/request-password-reset', {
				email,
				redirectTo: '/reset-password',
			})
			answers.push([response.status, await response.json()])
		}

		expect(mailer.sent.filter((sent) => sent.to === email)).toHaveLength(3)
		expect(answers[2]).toEqual(answers[0] as unknown[])
	})
})
