'use client'

import { Logo } from '@/components/brand/logo'
import { useSession } from '@/lib/auth'
import { UserMenu } from './user-menu'

/** The header of the signed-in screens: the logo and the traveler's menu. */
export function AppHeader() {
	const { data: traveler } = useSession()
	return (
		<header className="border-b">
			<div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-8">
				<Logo />
				{traveler && <UserMenu traveler={traveler} />}
			</div>
		</header>
	)
}
