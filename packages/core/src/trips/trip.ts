/** The longest trip name, in characters (architecture.md §18, Limits). */
export const TRIP_NAME_MAX = 120

/** A trip as the trip list shows it. M2 adds its dates, derived from the stops (D44). */
export type TripSummary = {
	id: string
	name: string
}
