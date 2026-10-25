import { describe, expect, test } from 'bun:test'
import { requestApi } from '../support/api-request'
import { createTestApp } from '../support/auth-app'
import { useTestDatabase } from '../support/test-database'

describe('the trips', () => {
	const database = useTestDatabase()

	test('refuses to list trips without a session', async () => {
		const app = createTestApp(database.db)

		const response = await requestApi(app, 'GET', '/trips')

		expect(response.status).toBe(401)
		expect(await response.json()).toEqual({ code: 'UNAUTHORIZED' })
	})
})
