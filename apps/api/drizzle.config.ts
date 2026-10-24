import { defineConfig } from 'drizzle-kit'

export default defineConfig({
	dialect: 'postgresql',
	schema: './src/db/schema',
	out: './src/db/migrations',
	// Same as the client (src/db/client.ts): camelCase in TypeScript, snake_case in the database.
	casing: 'snake_case',
})
