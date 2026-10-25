import { Elysia } from 'elysia'
import type { Auth } from './auth/auth'
import type { Database } from './db/client'
import { healthRoutes } from './health/routes'

export type AppDependencies = {
	db: Database
	auth: Auth
}

export function createApp({ db, auth }: AppDependencies) {
	// Better Auth answers under /api/auth/* (deploy.md §2).
	return new Elysia().use(healthRoutes(db)).mount(auth.handler)
}
