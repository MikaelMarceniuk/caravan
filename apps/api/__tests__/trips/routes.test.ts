import { describe, expect, test } from 'bun:test'
import type { TripSummary } from '@caravan/core'
import { requestApi } from '../support/api-request'
import { createTestApp, signUpVerified } from '../support/auth-app'
import { createFakeMailer } from '../support/fake-mailer'
import { useTestDatabase } from '../support/test-database'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

describe('the trips', () => {
	const database = useTestDatabase()

	/** A new traveler with a confirmed email, signed in. */
	async function signedIn() {
		const mailer = createFakeMailer()
		const app = createTestApp(database.db, { mailer })
		const { cookie } = await signUpVerified(app, mailer)
		return { app, cookie }
	}

	test('refuses to list trips without a session', async () => {
		const app = createTestApp(database.db)

		const response = await requestApi(app, 'GET', '/trips')

		expect(response.status).toBe(401)
		expect(await response.json()).toEqual({ code: 'UNAUTHORIZED' })
	})

	test('a traveler sees the trip they created', async () => {
		const { app, cookie } = await signedIn()

		const created = await requestApi(app, 'POST', '/trips', {
			cookie,
			body: { name: 'Balkans Road Trip' },
		})
		expect(created.status).toBe(201)
		const { trip } = (await created.json()) as { trip: TripSummary }
		const listed = await requestApi(app, 'GET', '/trips', { cookie })

		expect(trip).toEqual({
			id: expect.stringMatching(UUID),
			name: 'Balkans Road Trip',
		})
		expect(await listed.json()).toEqual({ trips: [trip] })
	})

	test('refuses a trip without a name', async () => {
		const { app, cookie } = await signedIn()

		const response = await requestApi(app, 'POST', '/trips', {
			cookie,
			body: {},
		})

		expect(response.status).toBe(422)
		expect(await response.json()).toEqual({ code: 'INVALID_INPUT' })
	})

	test('refuses a name that is only spaces', async () => {
		const { app, cookie } = await signedIn()

		const response = await requestApi(app, 'POST', '/trips', {
			cookie,
			body: { name: '   ' },
		})

		expect(response.status).toBe(422)
		expect(await response.json()).toEqual({ code: 'INVALID_INPUT' })
	})

	test('refuses a name longer than 120 characters', async () => {
		const { app, cookie } = await signedIn()

		const response = await requestApi(app, 'POST', '/trips', {
			cookie,
			body: { name: 'a'.repeat(121) },
		})

		expect(response.status).toBe(422)
		expect(await response.json()).toEqual({ code: 'INVALID_INPUT' })
	})

	test('accepts a name of exactly 120 characters', async () => {
		const { app, cookie } = await signedIn()

		const response = await requestApi(app, 'POST', '/trips', {
			cookie,
			body: { name: 'a'.repeat(120) },
		})

		expect(response.status).toBe(201)
	})

	test('saves the name without the spaces around it', async () => {
		const { app, cookie } = await signedIn()

		const response = await requestApi(app, 'POST', '/trips', {
			cookie,
			body: { name: '  Balkans Road Trip  ' },
		})

		expect(await response.json()).toMatchObject({
			trip: { name: 'Balkans Road Trip' },
		})
	})

	test('refuses a name that is not text', async () => {
		const { app, cookie } = await signedIn()

		const response = await requestApi(app, 'POST', '/trips', {
			cookie,
			body: { name: 42 },
		})

		expect(response.status).toBe(422)
		expect(await response.json()).toEqual({ code: 'INVALID_INPUT' })
	})

	test('refuses a body that is not valid JSON', async () => {
		const { app, cookie } = await signedIn()

		const response = await requestApi(app, 'POST', '/trips', {
			cookie,
			body: '{"name": ',
		})

		expect(response.status).toBe(400)
		expect(await response.json()).toEqual({ code: 'INVALID_INPUT' })
	})

	test('lists the newest trip first', async () => {
		const { app, cookie } = await signedIn()
		for (const name of ['Lisbon', 'Porto', 'Madeira']) {
			await requestApi(app, 'POST', '/trips', { cookie, body: { name } })
		}

		const response = await requestApi(app, 'GET', '/trips', { cookie })
		const { trips } = (await response.json()) as { trips: TripSummary[] }

		expect(trips.map((trip) => trip.name)).toEqual([
			'Madeira',
			'Porto',
			'Lisbon',
		])
	})
})
