import { describe, expect, test } from 'bun:test'
import {
	BASE_URL,
	createTestApp,
	getAuth,
	PASSWORD,
	postAuth,
	sessionCookie,
	signUpVerified,
	uniqueEmail,
} from '../support/auth-app'
import { createFakeMailer, linkIn } from '../support/fake-mailer'
import { useTestDatabase } from '../support/test-database'

describe('email verification', () => {
	const database = useTestDatabase()

	test("sign-up sends one verification email in the traveler's language", async () => {
		const mailer = createFakeMailer()
		const app = createTestApp(database.db, { mailer })
		const email = uniqueEmail()

		await postAuth(app, '/sign-up/email', {
			name: 'Ana',
			email,
			password: PASSWORD,
			locale: 'pt-BR',
			callbackURL: '/verify-email',
		})

		expect(mailer.sent).toHaveLength(1)
		expect(mailer.sent[0]).toMatchObject({
			to: email,
			subject: 'Confirme seu email no Caravan',
		})
	})

	test('sign-up does not sign the traveler in before the email is confirmed', async () => {
		const app = createTestApp(database.db)

		const response = await postAuth(app, '/sign-up/email', {
			name: 'Ana',
			email: uniqueEmail(),
			password: PASSWORD,
		})

		expect(response.status).toBe(200)
		expect(response.headers.getSetCookie()).toEqual([])
	})

	test('the link confirms the email and signs the traveler in', async () => {
		const mailer = createFakeMailer()
		const app = createTestApp(database.db, { mailer })
		await postAuth(app, '/sign-up/email', {
			name: 'Ana',
			email: uniqueEmail(),
			password: PASSWORD,
			callbackURL: '/verify-email',
		})

		const confirmation = await app.handle(new Request(linkIn(mailer.sent[0])))

		expect(confirmation.status).toBe(302)
		expect(confirmation.headers.get('location')).toBe('/verify-email')
		const session = await getAuth(app, '/get-session', {
			cookie: sessionCookie(confirmation),
		})
		expect(await session.json()).toMatchObject({
			user: { emailVerified: true },
		})
	})

	test('a broken link sends the traveler back with INVALID_TOKEN', async () => {
		const app = createTestApp(database.db)

		const confirmation = await app.handle(
			new Request(
				`${BASE_URL}/api/auth/verify-email?token=not-a-token&callbackURL=%2Fverify-email`,
			),
		)

		expect(confirmation.status).toBe(302)
		expect(confirmation.headers.get('location')).toBe(
			'/verify-email?error=INVALID_TOKEN',
		)
	})

	test('signing up with a registered email looks the same and sends nothing', async () => {
		const mailer = createFakeMailer()
		const app = createTestApp(database.db, { mailer })
		const { email } = await signUpVerified(app, mailer)
		const sentBefore = mailer.sent.length

		const again = await postAuth(app, '/sign-up/email', {
			name: 'Someone else',
			email,
			password: PASSWORD,
		})
		const fresh = await postAuth(app, '/sign-up/email', {
			name: 'Someone else',
			email: uniqueEmail(),
			password: PASSWORD,
		})

		expect(again.status).toBe(fresh.status)
		expect(shape(await again.json())).toEqual(shape(await fresh.json()))
		expect(mailer.sent.filter((sent) => sent.to === email)).toHaveLength(
			sentBefore,
		)
	})
})

/** The keys of a response body, nested, without the values. */
function shape(value: unknown): unknown {
	if (value === null || typeof value !== 'object') return typeof value
	return Object.fromEntries(
		Object.entries(value)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([key, nested]) => [key, shape(nested)]),
	)
}
