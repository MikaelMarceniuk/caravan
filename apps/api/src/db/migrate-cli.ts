import { migrateDatabase } from './migrate'

// `bun run db:migrate`: what the deploy runs before starting the new release (deploy.md §5).
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
	console.error(
		'DATABASE_URL is not set: copy apps/api/.env.example to apps/api/.env.',
	)
	process.exit(1)
}

await migrateDatabase(databaseUrl)
console.log('Migrations applied.')
