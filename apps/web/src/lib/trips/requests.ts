import type { TripSummary } from '@caravan/core'
import { api } from '../api'

// The trips' REST routes, under /api/trips on the API (architecture.md D45).

/** The trips the traveler is a member of, the newest first. */
export async function fetchTrips() {
	const { data } = await api.get<{ trips: TripSummary[] }>('/trips')
	return data.trips
}
