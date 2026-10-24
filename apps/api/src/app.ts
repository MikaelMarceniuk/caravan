import { Elysia } from 'elysia'
import type { Database } from './db/client'
import { healthRoutes } from './health/routes'

export type AppDependencies = {
	db: Database
}

export function createApp({ db }: AppDependencies) {
	return new Elysia().use(healthRoutes(db))
}
