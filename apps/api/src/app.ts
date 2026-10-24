import { Elysia } from 'elysia'
import { healthRoutes } from './health/routes'

export function createApp() {
	return new Elysia().use(healthRoutes)
}
