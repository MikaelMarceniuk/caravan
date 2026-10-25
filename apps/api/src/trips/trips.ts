import type { TripSummary } from '@caravan/core'
import { desc, eq } from 'drizzle-orm'
import type { Database } from '../db/client'
import { tripMembers, trips } from '../db/schema'

/** The trip and its owner as a member, together (architecture.md §13). */
export function createTrip(
	db: Database,
	ownerId: string,
	{ name }: { name: string },
): Promise<TripSummary> {
	return db.transaction(async (tx) => {
		const [trip] = await tx
			.insert(trips)
			.values({ name, ownerId })
			.returning({ id: trips.id, name: trips.name })
		if (!trip) throw new Error('Creating the trip returned no row.')
		await tx
			.insert(tripMembers)
			.values({ tripId: trip.id, userId: ownerId, role: 'owner' })
		return trip
	})
}

/** The trips the traveler is a member of, the newest first. */
export function listTrips(
	db: Database,
	userId: string,
): Promise<TripSummary[]> {
	return db
		.select({ id: trips.id, name: trips.name })
		.from(tripMembers)
		.innerJoin(trips, eq(trips.id, tripMembers.tripId))
		.where(eq(tripMembers.userId, userId))
		.orderBy(desc(trips.createdAt), desc(trips.id))
}
