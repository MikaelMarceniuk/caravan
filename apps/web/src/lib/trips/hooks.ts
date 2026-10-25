import { useQuery } from '@tanstack/react-query'
import { fetchTrips } from './requests'

/** The query key of the traveler's trips. */
export const TRIPS_KEY = ['trips'] as const

export function useTrips() {
	return useQuery({ queryKey: TRIPS_KEY, queryFn: fetchTrips })
}
