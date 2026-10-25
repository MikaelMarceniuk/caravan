import {
	type QueryClient,
	useMutation,
	useQuery,
	useQueryClient,
} from '@tanstack/react-query'
import { errorCode } from '../api'
import { SESSION_KEY } from '../auth/session-query'
import { createTrip, fetchTrips } from './requests'

/** The query key of the traveler's trips. */
export const TRIPS_KEY = ['trips'] as const

/** The API says the session is over: forgetting it sends the screen to sign-in. */
function forgetEndedSession(queryClient: QueryClient, error: unknown) {
	if (errorCode(error) === 'UNAUTHORIZED')
		queryClient.setQueryData(SESSION_KEY, null)
}

export function useTrips() {
	const queryClient = useQueryClient()
	return useQuery({
		queryKey: TRIPS_KEY,
		async queryFn() {
			try {
				return await fetchTrips()
			} catch (error) {
				forgetEndedSession(queryClient, error)
				throw error
			}
		},
	})
}

export function useCreateTrip() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: createTrip,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: TRIPS_KEY }),
		onError: (error) => forgetEndedSession(queryClient, error),
	})
}
