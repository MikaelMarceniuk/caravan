import { createApp } from './app'
import { createAuth } from './auth/auth'
import { createDb } from './db/client'

function requiredEnv(name: string) {
	const value = process.env[name]
	if (!value) {
		console.error(
			`${name} is not set: copy apps/api/.env.example to apps/api/.env.`,
		)
		process.exit(1)
	}
	return value
}

const databaseUrl = requiredEnv('DATABASE_URL')
const authSecret = requiredEnv('BETTER_AUTH_SECRET')
const authUrl = requiredEnv('BETTER_AUTH_URL')

const port = Number(process.env.PORT ?? 3000)
const db = createDb(databaseUrl)
const auth = createAuth({ db, secret: authSecret, baseURL: authUrl })
const app = createApp({ db, auth }).listen(port)

console.log(`API listening on port ${app.server?.port}`)
