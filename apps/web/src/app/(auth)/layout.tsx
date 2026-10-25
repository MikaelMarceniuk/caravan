import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { getSession } from '@/lib/session'

// Signed in already: the auth screens have nothing to offer.
export default async function AuthScreensLayout({
	children,
}: {
	children: ReactNode
}) {
	if (await getSession()) redirect('/session')
	return children
}
