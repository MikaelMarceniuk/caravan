import { describe, expect, test } from 'bun:test'
import { createApp } from '../../src/app'

describe('GET /healthz', () => {
	test('reports the process as alive', async () => {
		const response = await createApp().handle(
			new Request('http://localhost/healthz'),
		)

		expect(response.status).toBe(200)
		expect(await response.json()).toEqual({ status: 'ok' })
	})
})
