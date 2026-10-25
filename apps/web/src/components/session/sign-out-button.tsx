'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useSignOut } from '@/lib/auth'

export function SignOutButton() {
	const t = useTranslations('session')
	const router = useRouter()
	const signOut = useSignOut()
	const pending = signOut.isPending || signOut.isSuccess
	return (
		<Button
			variant="outline"
			size="lg"
			className="self-start"
			disabled={pending}
			aria-busy={pending || undefined}
			onClick={() =>
				signOut.mutate(undefined, {
					onSuccess() {
						router.replace('/sign-in')
						// The server components read the session again, now without one.
						router.refresh()
					},
				})
			}
		>
			{pending && (
				<Spinner
					data-icon="inline-start"
					role="presentation"
					aria-hidden="true"
				/>
			)}
			{t('signOut')}
		</Button>
	)
}
