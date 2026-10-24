import { createApp } from '../../src/app'
import { createAuth } from '../../src/auth/auth'
import type { Database } from '../../src/db/client'

// The web's origin: Better Auth only trusts requests from its base URL.
export const BASE_URL = 'http://localhost:3001'
const SECRET = 'test-secret-that-is-at-least-32-characters-long'

/** The real app with a Better Auth instance of its own, so in-memory state (rate limits) never leaks between tests. */
export function createTestApp(db: Database, { baseURL = BASE_URL } = {}) {
	return createApp({
		db,
		auth: createAuth({ db, secret: SECRET, baseURL }),
	})
}

/** The `name=value` pair of the session cookie a response set, ready for a `cookie` header. */
export function sessionCookie(response: Response) {
	const cookie = response.headers
		.getSetCookie()
		.find((header) => header.includes('session_token='))
	if (!cookie) throw new Error('The response set no session cookie.')
	return cookie.split(';')[0] as string
}

export function getAuth(
	app: ReturnType<typeof createApp>,
	path: string,
	headers: Record<string, string> = {},
) {
	return app.handle(
		new Request(`${BASE_URL}/api/auth${path}`, {
			headers: { origin: BASE_URL, ...headers },
		}),
	)
}

/** A different address per test, so tests in the same file never share an account. */
export function uniqueEmail() {
	return `traveler+${crypto.randomUUID()}@example.com`
}

export const PASSWORD = 'a-long-password'

/** Creates an account through the API and returns its email and the response. */
export async function signUp(
	app: ReturnType<typeof createApp>,
	{ email = uniqueEmail(), locale }: { email?: string; locale?: string } = {},
) {
	const response = await postAuth(app, '/sign-up/email', {
		name: 'Ana',
		email,
		password: PASSWORD,
		locale,
	})
	if (!response.ok) throw new Error(`Sign-up failed: ${response.status}`)
	return { email, response }
}

export function postAuth(
	app: ReturnType<typeof createApp>,
	path: string,
	body: unknown,
	headers: Record<string, string> = {},
) {
	return app.handle(
		new Request(`${BASE_URL}/api/auth${path}`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				origin: BASE_URL,
				...headers,
			},
			body: JSON.stringify(body),
		}),
	)
}
