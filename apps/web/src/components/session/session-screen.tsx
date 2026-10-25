'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useSession } from '@/lib/auth'
import { SessionView } from './session-view'

/** The session page's client side: the session the server prefetched, kept fresh by the query. */
export function SessionScreen() {
	const router = useRouter()
	const { data: traveler } = useSession()

	// Signed out elsewhere, expired, or every session ended by a password reset.
	useEffect(() => {
		if (traveler === null) router.replace('/sign-in')
	}, [traveler, router])

	if (!traveler) return null
	return <SessionView traveler={traveler} />
}
