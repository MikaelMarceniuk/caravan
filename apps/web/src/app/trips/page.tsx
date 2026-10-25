import {
	dehydrate,
	HydrationBoundary,
	QueryClient,
} from '@tanstack/react-query'
import { redirect } from 'next/navigation'
import { TripsScreen } from '@/components/trips/trips-screen'
import { SESSION_KEY } from '@/lib/auth/session-query'
import { getSession } from '@/lib/session'

// The server reads the session from the cookie and hands it to the client's query (plan 4, §11, R3).
// The trips come from the client, with their own loading state (plan 5, C7).
export default async function TripsPage() {
	const traveler = await getSession()
	if (!traveler) redirect('/sign-in')
	const queryClient = new QueryClient()
	queryClient.setQueryData(SESSION_KEY, traveler)
	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<TripsScreen />
		</HydrationBoundary>
	)
}
