import { Elysia } from 'elysia'
import type { AppDependencies } from '../app'
import { sessionPlugin } from '../auth/session'

export function tripRoutes({ auth }: AppDependencies) {
	return new Elysia({ prefix: '/api/trips' })
		.use(sessionPlugin(auth))
		.get('/', () => ({ trips: [] }), { traveler: true })
}
