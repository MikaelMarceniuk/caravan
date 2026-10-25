import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createTrip, fetchTrips } from './requests'

/** The query key of the traveler's trips. */
export const TRIPS_KEY = ['trips'] as const

export function useTrips() {
	return useQuery({ queryKey: TRIPS_KEY, queryFn: fetchTrips })
}

export function useCreateTrip() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: createTrip,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: TRIPS_KEY }),
	})
}
