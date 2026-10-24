import { describe, expect, test } from 'bun:test'
import { generateDrizzleJson, generateMigration } from 'drizzle-kit/api'
import { sql } from 'drizzle-orm'
import { migrateDatabase } from '../../src/db/migrate'
import { nonAdditiveStatements } from '../../src/db/migration-policy'
import * as schema from '../../src/db/schema'
import { useTestDatabase } from '../support/test-database'

const MIGRATIONS_FOLDER = new URL('../../src/db/migrations', import.meta.url)
	.pathname

async function latestSnapshot() {
	const journal = await Bun.file(
		`${MIGRATIONS_FOLDER}/meta/_journal.json`,
	).json()
	const latest = journal.entries.at(-1)
	const index = String(latest.idx).padStart(4, '0')
	return Bun.file(`${MIGRATIONS_FOLDER}/meta/${index}_snapshot.json`).json()
}

describe('every migration outside a contract phase', () => {
	test('is additive', async () => {
		const files = await Array.fromAsync(
			new Bun.Glob('*.sql').scan(MIGRATIONS_FOLDER),
		)
		const violations: Record<string, string[]> = {}
		for (const file of files.sort()) {
			// A contract phase is marked in the name: `db:generate --name contract_<reason>`.
			if (file.includes('_contract_')) continue
			const statements = nonAdditiveStatements(
				await Bun.file(`${MIGRATIONS_FOLDER}/${file}`).text(),
			)
			if (statements.length > 0) violations[file] = statements
		}

		expect(violations).toEqual({})
	})
})

describe('the Drizzle schema', () => {
	test('matches the migrations', async () => {
		const snapshot = await latestSnapshot()

		// Same casing as drizzle.config.ts.
		const current = generateDrizzleJson(
			schema,
			snapshot.id,
			undefined,
			'snake_case',
		)

		// A schema change without `db:generate` leaves statements to run.
		expect(await generateMigration(snapshot, current)).toEqual([])
	})
})

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
