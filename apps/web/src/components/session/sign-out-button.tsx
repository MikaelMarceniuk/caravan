'use client'

import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { signOut } from '@/lib/auth'

export function SignOutButton() {
	const t = useTranslations('session')
	const router = useRouter()
	const mutation = useMutation({
		mutationFn: signOut,
		onSuccess() {
			router.replace('/sign-in')
			// The server components read the session again, now without one.
			router.refresh()
		},
	})
	return (
		<Button
			variant="outline"
			size="lg"
			className="self-start"
			disabled={mutation.isPending}
			onClick={() => mutation.mutate()}
		>
			{t('signOut')}
		</Button>
	)
}
