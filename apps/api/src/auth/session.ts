import { Elysia } from 'elysia'
import type { Auth } from './auth'

/** A route with `{ traveler: true }` only answers with a session, and gets who is signed in. */
export function sessionPlugin(auth: Auth) {
	return new Elysia().macro({
		traveler: {
			async resolve({ request: { headers }, status }) {
				const session = await auth.api.getSession({ headers })
				if (!session) return status(401, { code: 'UNAUTHORIZED' })
				return { traveler: { id: session.user.id } }
			},
		},
	})
}
