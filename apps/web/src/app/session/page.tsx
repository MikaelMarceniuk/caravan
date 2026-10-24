import { redirect } from 'next/navigation'
import { SessionView } from '@/components/session/session-view'
import { getSession } from '@/lib/session'

export default async function SessionPage() {
	const traveler = await getSession()
	if (!traveler) redirect('/sign-in')
	return <SessionView traveler={traveler} />
}
