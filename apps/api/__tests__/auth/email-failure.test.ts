import { afterAll, afterEach, describe, expect, spyOn, test } from 'bun:test'
import {
	createTestApp,
	PASSWORD,
	postAuth,
	uniqueEmail,
} from '../support/auth-app'
import { useTestDatabase } from '../support/test-database'

describe('when the email provider fails', () => {
	const database = useTestDatabase()
	const consoleError = spyOn(console, 'error').mockImplementation(() => {})
	afterEach(() => consoleError.mockClear())
	afterAll(() => consoleError.mockRestore())

	const failingMailer = {
		send: () => Promise.reject(new Error('Resend refused the email: 500')),
	}

	test('sign-up still answers as usual', async () => {
		const app = createTestApp(database.db, { mailer: failingMailer })

		const response = await postAuth(app, '/sign-up/email', {
			name: 'Ana',
			email: uniqueEmail(),
			password: PASSWORD,
		})

		expect(response.status).toBe(200)
	})

	test('the log says which email failed, never to whom', async () => {
		const app = createTestApp(database.db, { mailer: failingMailer })
		const email = uniqueEmail()

		await postAuth(app, '/sign-up/email', {
			name: 'Ana',
			email,
			password: PASSWORD,
		})
		await Bun.sleep(0)

		const logged = consoleError.mock.calls.flat().map(String).join('\n')
		expect(logged).toContain('Failed to send the verification email')
		expect(logged).not.toContain(email)
	})
})
