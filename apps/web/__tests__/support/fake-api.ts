import {
	AxiosError,
	type AxiosResponse,
	type InternalAxiosRequestConfig,
} from 'axios'
import { api } from '@/lib/api'

type Reply = { status: number; data?: unknown }
type Route = (body: Record<string, unknown>) => Reply | Promise<Reply>

/**
 * Answers the API calls the way the API would, at the network edge (development.md §2): no request leaves the test.
 * Each key is `METHOD /path` (relative to /api). Returns the requests it got.
 */
export function fakeApi(routes: Record<string, Route>) {
	const requests: { route: string; body: Record<string, unknown> }[] = []
	api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
		const route = `${config.method?.toUpperCase()} ${config.url}`
		const body = typeof config.data === 'string' ? JSON.parse(config.data) : {}
		requests.push({ route, body })
		const reply = (await routes[route]?.(body)) ?? { status: 404 }
		const response: AxiosResponse = {
			data: reply.data ?? null,
			status: reply.status,
			statusText: String(reply.status),
			headers: {},
			config,
		}
		if (reply.status >= 400)
			throw new AxiosError(
				`Request failed with status code ${reply.status}`,
				AxiosError.ERR_BAD_REQUEST,
				config,
				null,
				response,
			)
		return response
	}
	return { requests }
}

/** A reply the test sends when it wants: the request stays pending until then. */
export function pendingReply() {
	let send: (reply: Reply) => void = () => {}
	const reply = new Promise<Reply>((resolve) => {
		send = resolve
	})
	return { route: () => reply, send }
}
