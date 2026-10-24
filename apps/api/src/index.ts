import { createApp } from './app'
import { createDb } from './db/client'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
	console.error(
		'DATABASE_URL is not set: copy apps/api/.env.example to apps/api/.env.',
	)
	process.exit(1)
}

const port = Number(process.env.PORT ?? 3000)
const app = createApp({ db: createDb(databaseUrl) }).listen(port)

console.log(`API listening on port ${app.server?.port}`)
