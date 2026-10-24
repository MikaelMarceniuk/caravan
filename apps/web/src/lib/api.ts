import axios, { isAxiosError } from 'axios'

/** The API, on the web's own origin: Caddy in production, Next's rewrites in development (deploy.md P2). */
export const api = axios.create({ baseURL: '/api' })

/** The code of a failed request (the API sends codes, never text: architecture.md D34, D40). */
export function errorCode(error: unknown) {
	if (!isAxiosError(error)) return undefined
	if (error.response?.status === 429) return 'TOO_MANY_REQUESTS'
	const data: unknown = error.response?.data
	return data && typeof data === 'object' && 'code' in data
		? String(data.code)
		: undefined
}
