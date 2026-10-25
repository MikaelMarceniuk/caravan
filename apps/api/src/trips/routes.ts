import { Elysia, t } from 'elysia'
import type { AppDependencies } from '../app'
import { sessionPlugin } from '../auth/session'
import { createTrip, listTrips } from './trips'

export function tripRoutes({ db, auth }: AppDependencies) {
	return new Elysia({ prefix: '/api/trips' })
		.use(sessionPlugin(auth))
		.get(
			'/',
			async ({ traveler }) => ({
				trips: await listTrips(db, traveler.id),
			}),
			{ traveler: true },
		)
		.post(
			'/',
			async ({ body, traveler, status }) =>
				status(201, { trip: await createTrip(db, traveler.id, body) }),
			{ traveler: true, body: t.Object({ name: t.String() }) },
		)
}
