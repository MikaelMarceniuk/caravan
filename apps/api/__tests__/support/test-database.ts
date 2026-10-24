import { afterAll, beforeAll } from 'bun:test'
import { SQL } from 'bun'
import { createDb, type Database } from '../../src/db/client'

// Same container as the dev database, never the dev database itself (docs/planners/m1-foundation/2.docker-compose.md, P3).
const TEST_DATABASE = 'caravan_test'

/**
 * Creates an empty `caravan_test` before the tests of the calling file or `describe` block
 * and drops it after them. Connects as the `DATABASE_URL` user, which must be able to create databases.
 */
export function useTestDatabase() {
	const url = process.env.DATABASE_URL
	if (!url) {
		throw new Error(
			'DATABASE_URL is not set: copy apps/api/.env.example to apps/api/.env and run `bun run infra:up`.',
		)
	}

	const admin = new SQL(url)
	const testUrl = new URL(url)
	testUrl.pathname = `/${TEST_DATABASE}`
	let db: Database | undefined

	beforeAll(async () => {
		// A run that was interrupted may have left it behind.
		await admin.unsafe(`DROP DATABASE IF EXISTS ${TEST_DATABASE} WITH (FORCE)`)
		await admin.unsafe(`CREATE DATABASE ${TEST_DATABASE}`)
		db = createDb(testUrl.href)
	})

	afterAll(async () => {
		await db?.$client.close()
		await admin.unsafe(`DROP DATABASE IF EXISTS ${TEST_DATABASE} WITH (FORCE)`)
		await admin.close()
	})

	return {
		get db() {
			if (!db)
				throw new Error('The test database is only available inside tests.')
			return db
		},
	}
}
