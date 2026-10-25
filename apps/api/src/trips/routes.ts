import { Elysia, t } from 'elysia'
import type { AppDependencies } from '../app'
import { sessionPlugin } from '../auth/session'
import { createTrip, listTrips } from './trips'

export function tripRoutes({ db, auth }: AppDependencies) {
	return (
		new Elysia({ prefix: '/api/trips' })
			.use(sessionPlugin(auth))
			// A code, never the validator's message (D34).
			.onError(({ code, status }) => {
				if (code === 'VALIDATION') return status(422, { code: 'INVALID_INPUT' })
			})
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
				{
					traveler: true,
					// Runs before the validation, so the limits apply to the name as it is saved.
					transform({ body }) {
						if (typeof body?.name === 'string') body.name = body.name.trim()
					},
					body: t.Object({ name: t.String({ minLength: 1 }) }),
				},
			)
	)
}
