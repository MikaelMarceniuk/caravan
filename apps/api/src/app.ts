import { Elysia } from 'elysia'
import type { Auth } from './auth/auth'
import type { Database } from './db/client'
import { healthRoutes } from './health/routes'
import { tripRoutes } from './trips/routes'

export type AppDependencies = {
	db: Database
	auth: Auth
}

export function createApp({ db, auth }: AppDependencies) {
	// Better Auth answers under /api/auth/*; our REST routes, under the rest of /api/* (deploy.md §2).
	return new Elysia()
		.use(healthRoutes(db))
		.use(tripRoutes({ db, auth }))
		.mount(auth.handler)
}
