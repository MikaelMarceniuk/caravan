'use client'

import { useTrips } from '@/lib/trips'
import { TripCard } from './trip-card'

/** The trips page's client side: the traveler's trips, asked to the API. */
export function TripsScreen() {
	const { data: trips } = useTrips()
	return (
		<main>
			<ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
				{trips?.map((trip) => (
					<li key={trip.id}>
						<TripCard trip={trip} />
					</li>
				))}
			</ul>
		</main>
	)
}
