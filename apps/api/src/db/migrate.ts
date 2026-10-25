import { drizzle } from 'drizzle-orm/bun-sql'
import { migrate } from 'drizzle-orm/bun-sql/migrator'

const MIGRATIONS_FOLDER = new URL('./migrations', import.meta.url).pathname

/** Applies every pending migration, on a connection of its own, outside the application's pool. */
export async function migrateDatabase(url: string) {
	const db = drizzle({ connection: { url, max: 1 } })
	try {
		await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
	} finally {
		await db.$client.close()
	}
}
