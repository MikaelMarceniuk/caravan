import { describe, expect, test } from 'bun:test'
import {
	createTestApp,
	getAuth,
	postAuth,
	signUpVerified,
} from '../support/auth-app'
import { createFakeMailer, linkIn } from '../support/fake-mailer'
import { useTestDatabase } from '../support/test-database'

describe('the session', () => {
	const database = useTestDatabase()

	test('tells who is signed in, with their language', async () => {
		const mailer = createFakeMailer()
		const app = createTestApp(database.db, { mailer })
		const { email, cookie } = await signUpVerified(app, mailer, {
			locale: 'pt-BR',
		})

		const session = await getAuth(app, '/get-session', { cookie })

		expect(session.status).toBe(200)
		expect((await session.json()) as unknown).toMatchObject({
			user: { email, locale: 'pt-BR' },
		})
	})

	test('is empty without a session cookie', async () => {
		const app = createTestApp(database.db)

		const session = await getAuth(app, '/get-session')

		expect(await session.json()).toBeNull()
	})

	test('ends when the traveler signs out', async () => {
		const mailer = createFakeMailer()
		const app = createTestApp(database.db, { mailer })
		const { cookie } = await signUpVerified(app, mailer)

		const signOut = await postAuth(app, '/sign-out', {}, { cookie })
		const session = await getAuth(app, '/get-session', { cookie })

		expect(signOut.status).toBe(200)
		expect(await session.json()).toBeNull()
	})
})

describe('the session cookie', () => {
	const database = useTestDatabase()

	const sessionSetCookie = (response: Response) =>
		response.headers
			.getSetCookie()
			.find((header) => header.includes('session_token='))

	test('is out of reach of scripts and of cross-site requests', async () => {
		const mailer = createFakeMailer()
		const app = createTestApp(database.db, { mailer })

		const { confirmation } = await signUpVerified(app, mailer)

		const cookie = sessionSetCookie(confirmation)
		expect(cookie).toContain('HttpOnly')
		expect(cookie).toContain('SameSite=Lax')
	})

	test('is only sent over HTTPS when the site is served over HTTPS', async () => {
		const mailer = createFakeMailer()
		const app = createTestApp(database.db, {
			baseURL: 'https://caravan.example',
			mailer,
		})
		await app.handle(
			new Request('https://caravan.example/api/auth/sign-up/email', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					origin: 'https://caravan.example',
				},
				body: JSON.stringify({
					name: 'Ana',
					email: `traveler+${crypto.randomUUID()}@example.com`,
					password: 'a-long-password',
				}),
			}),
		)

		const confirmation = await app.handle(new Request(linkIn(mailer.sent[0])))

		expect(sessionSetCookie(confirmation)).toContain('Secure')
	})
})
