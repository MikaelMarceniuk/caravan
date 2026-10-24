import { drizzle } from 'drizzle-orm/bun-sql'

// Pool of 10 connections per API instance (docs/project/architecture.md, D30).
const POOL_SIZE = 10

export function createDb(url: string) {
	return drizzle({
		connection: { url, max: POOL_SIZE },
		// camelCase in TypeScript, snake_case in the database.
		casing: 'snake_case',
	})
}

export type Database = ReturnType<typeof createDb>
