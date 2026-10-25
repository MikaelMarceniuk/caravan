import type { TripSummary } from '@caravan/core'
import { api } from '../api'

// The trips' REST routes, under /api/trips on the API (architecture.md D45).

/** The trips the traveler is a member of, the newest first. */
export async function fetchTrips() {
	const { data } = await api.get<{ trips: TripSummary[] }>('/trips')
	return data.trips
}

/** Creates a trip with the traveler as its owner. */
export async function createTrip(input: { name: string }) {
	const { data } = await api.post<{ trip: TripSummary }>('/trips', input)
	return data.trip
}
