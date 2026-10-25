import type { createApp } from '../../src/app'
import { BASE_URL } from './auth-app'

type ApiRequest = {
	cookie?: string
	/** Sent as JSON; a string goes as is, for bodies that are not valid JSON. */
	body?: unknown
}

/** A request to our REST routes (`/api/*`, deploy.md §2), as the web sends it. */
export function requestApi(
	app: ReturnType<typeof createApp>,
	method: 'GET' | 'POST',
	path: string,
	{ cookie, body }: ApiRequest = {},
) {
	const headers: Record<string, string> = { origin: BASE_URL }
	if (cookie) headers.cookie = cookie
	if (body !== undefined) headers['content-type'] = 'application/json'
	return app.handle(
		new Request(`${BASE_URL}/api${path}`, {
			method,
			headers,
			body:
				body === undefined || typeof body === 'string'
					? body
					: JSON.stringify(body),
		}),
	)
}
