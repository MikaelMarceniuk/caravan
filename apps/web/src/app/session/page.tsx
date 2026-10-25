import {
	dehydrate,
	HydrationBoundary,
	QueryClient,
} from '@tanstack/react-query'
import { redirect } from 'next/navigation'
import { SessionScreen } from '@/components/session/session-screen'
import { SESSION_KEY } from '@/lib/auth/session-query'
import { getSession } from '@/lib/session'

// The server reads the session from the cookie and hands it to the client's query (plan §11, R3).
export default async function SessionPage() {
	const traveler = await getSession()
	if (!traveler) redirect('/sign-in')
	const queryClient = new QueryClient()
	queryClient.setQueryData(SESSION_KEY, traveler)
	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<SessionScreen />
		</HydrationBoundary>
	)
}
