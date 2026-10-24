import { sql } from 'drizzle-orm'
import { Elysia } from 'elysia'
import type { Database } from '../db/client'

// docs/project/deploy.md §3. Redis joins /ready with the first code that uses it.
export function healthRoutes(db: Database) {
	return new Elysia()
		.get('/healthz', () => ({ status: 'ok' }))
		.get('/ready', async ({ status }) => {
			try {
				await db.execute(sql`SELECT 1`)
			} catch {
				// The driver's error stays out of the response.
				return status(503, { status: 'unavailable' })
			}
			return { status: 'ok' }
		})
}
