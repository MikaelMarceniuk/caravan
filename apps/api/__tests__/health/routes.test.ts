import { describe, expect, test } from 'bun:test'
import { createDb } from '../../src/db/client'
import { createTestApp } from '../support/auth-app'
import { useTestDatabase } from '../support/test-database'

// Nothing listens on port 1: connections to it are refused.
const UNREACHABLE_DATABASE_URL =
	'postgres://caravan:caravan@127.0.0.1:1/caravan'

describe('GET /healthz', () => {
	test('reports the process as alive without touching Postgres', async () => {
		const db = createDb(UNREACHABLE_DATABASE_URL)

		const response = await createTestApp(db).handle(
			new Request('http://localhost/healthz'),
		)

		expect(response.status).toBe(200)
		expect(await response.json()).toEqual({ status: 'ok' })
	})
})

describe('GET /ready', () => {
	const database = useTestDatabase()

	test('is ready when Postgres answers', async () => {
		const response = await createTestApp(database.db).handle(
			new Request('http://localhost/ready'),
		)

		expect(response.status).toBe(200)
		expect(await response.json()).toEqual({ status: 'ok' })
	})
})

describe('GET /ready without Postgres', () => {
	test('is not ready when Postgres does not answer', async () => {
		const db = createDb(UNREACHABLE_DATABASE_URL)

		const response = await createTestApp(db).handle(
			new Request('http://localhost/ready'),
		)

		// The body carries only the code, never the driver's error.
		expect(response.status).toBe(503)
		expect(await response.json()).toEqual({ status: 'unavailable' })
	})
})
