'use client'

import { ChevronDownIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { type Traveler, useSignOut } from '@/lib/auth'

/** Up to two initials: "Ana Souza" → "AS". */
function initialsOf(name: string) {
	const words = name.trim().split(/\s+/)
	const letters = [words[0], words.length > 1 ? words.at(-1) : undefined]
	return letters
		.map((word) => word?.[0] ?? '')
		.join('')
		.toUpperCase()
}

/** The signed-in traveler's initials and name, with their email and "Sign out" behind. */
export function UserMenu({ traveler }: { traveler: Traveler }) {
	const t = useTranslations('userMenu')
	const router = useRouter()
	const signOut = useSignOut()

	function leave() {
		// useSignOut forgets the session, and the screen goes to sign-in on its own;
		// the server components read the session again, now without one.
		signOut.mutate(undefined, { onSuccess: () => router.refresh() })
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="lg" className="gap-3 px-2">
					<span
						aria-hidden="true"
						className="flex size-8 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background"
					>
						{initialsOf(traveler.name)}
					</span>
					<span className="max-w-40 truncate">{traveler.name}</span>
					<ChevronDownIcon aria-hidden="true" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-56">
				<DropdownMenuLabel className="flex flex-col gap-0.5">
					<span className="truncate">{traveler.name}</span>
					<span className="truncate text-xs font-normal text-muted-foreground">
						{traveler.email}
					</span>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					disabled={signOut.isPending || signOut.isSuccess}
					onSelect={leave}
				>
					{t('signOut')}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
