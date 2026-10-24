import { describe, expect, test } from 'bun:test'
import { sql } from 'drizzle-orm'
import { migrateDatabase } from '../../src/db/migrate'
import { useTestDatabase } from '../support/test-database'

describe('migrations', () => {
	const database = useTestDatabase({ migrated: false })

	test('apply to an empty database', async () => {
		await migrateDatabase(database.url)

		const tables = await database.db.execute<{ table_name: string }>(
			sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`,
		)

		// Better Auth's core schema.
		expect(tables.map((row) => row.table_name)).toEqual([
			'account',
			'session',
			'user',
			'verification',
		])
	})

	test('applying them again changes nothing', async () => {
		await migrateDatabase(database.url)

		// Re-running a CREATE TABLE would throw here.
		await expect(migrateDatabase(database.url)).resolves.toBeUndefined()
	})
})
