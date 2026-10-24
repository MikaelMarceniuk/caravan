import { describe, expect, test } from 'bun:test'
import {
	BASE_URL,
	createTestApp,
	getAuth,
	PASSWORD,
	postAuth,
	signUpVerified,
	uniqueEmail,
} from '../support/auth-app'
import {
	createFakeMailer,
	type FakeMailer,
	linkIn,
} from '../support/fake-mailer'
import { useTestDatabase } from '../support/test-database'

describe('forgot password', () => {
	const database = useTestDatabase()

	test("emails a reset link in the traveler's language", async () => {
		const mailer = createFakeMailer()
		const app = createTestApp(database.db, { mailer })
		const { email } = await signUpVerified(app, mailer, { locale: 'pt-BR' })

		const response = await postAuth(app, '/request-password-reset', {
			email,
			redirectTo: '/reset-password',
		})

		expect(response.status).toBe(200)
		expect(mailer.sent.at(-1)).toMatchObject({
			to: email,
			subject: 'Redefina sua senha do Caravan',
		})
	})

	test('answers an unknown email the same way and sends nothing', async () => {
		const mailer = createFakeMailer()
		const app = createTestApp(database.db, { mailer })
		const { email } = await signUpVerified(app, mailer)
		const known = await requestReset(app, email)
		const sentBefore = mailer.sent.length

		const unknown = await requestReset(app, uniqueEmail())

		expect(unknown.status).toBe(known.status)
		expect(await unknown.json()).toEqual(await known.json())
		expect(mailer.sent).toHaveLength(sentBefore)
	})

	test('the link leads to the reset page with a token', async () => {
		const mailer = createFakeMailer()
		const app = createTestApp(database.db, { mailer })
		const { email } = await signUpVerified(app, mailer)
		await requestReset(app, email)

		const page = await app.handle(new Request(linkIn(mailer.sent.at(-1))))

		expect(page.status).toBe(302)
		// Absolute, on the web's origin (unlike the verification redirect, which is relative).
		expect(page.headers.get('location')).toMatch(
			/^http:\/\/localhost:3001\/reset-password\?token=[\w-]+$/,
		)
	})

	test('the new password works and the old one no longer does', async () => {
		const mailer = createFakeMailer()
		const app = createTestApp(database.db, { mailer })
		const { email } = await signUpVerified(app, mailer)

		const reset = await resetPassword(
			app,
			mailer,
			email,
			'a-brand-new-password',
		)
		const withNew = await postAuth(app, '/sign-in/email', {
			email,
			password: 'a-brand-new-password',
		})
		const withOld = await postAuth(app, '/sign-in/email', {
			email,
			password: PASSWORD,
		})

		expect(reset.status).toBe(200)
		expect(withNew.status).toBe(200)
		expect(withOld.status).toBe(401)
	})

	test('signs the traveler out everywhere', async () => {
		const mailer = createFakeMailer()
		const app = createTestApp(database.db, { mailer })
		const { email, cookie } = await signUpVerified(app, mailer)

		await resetPassword(app, mailer, email, 'a-brand-new-password')

		const session = await getAuth(app, '/get-session', { cookie })
		expect(await session.json()).toBeNull()
	})

	test('refuses a token that is not valid', async () => {
		const app = createTestApp(database.db)

		const reset = await postAuth(app, '/reset-password', {
			token: 'not-a-token',
			newPassword: 'a-brand-new-password',
		})

		expect(reset.status).toBe(400)
		expect(await reset.json()).toMatchObject({ code: 'INVALID_TOKEN' })
	})
})

function requestReset(app: ReturnType<typeof createTestApp>, email: string) {
	return postAuth(app, '/request-password-reset', {
		email,
		redirectTo: '/reset-password',
	})
}

/** Asks for a reset, follows the emailed link to get the token, and sets the new password. */
async function resetPassword(
	app: ReturnType<typeof createTestApp>,
	mailer: FakeMailer,
	email: string,
	newPassword: string,
) {
	await requestReset(app, email)
	const page = await app.handle(new Request(linkIn(mailer.sent.at(-1))))
	const location = new URL(page.headers.get('location') ?? '', BASE_URL)
	return postAuth(app, '/reset-password', {
		token: location.searchParams.get('token'),
		newPassword,
	})
}
