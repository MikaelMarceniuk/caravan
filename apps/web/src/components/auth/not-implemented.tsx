'use client'

import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { useFormPending } from '@/components/form/form'
import { Button } from '@/components/ui/button'
import { FieldSeparator } from '@/components/ui/field'

/** Shows the "not implemented yet" toast (plan B9). */
function useNotImplemented() {
	const t = useTranslations('app')
	return () => toast(t('notImplemented'))
}

// Google's "G", in its own colors; the button's text names it.
function GoogleMark() {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
			<path
				fill="#4285F4"
				d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z"
			/>
			<path
				fill="#34A853"
				d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9h-4v3.1C3.4 21.4 7.4 24 12 24z"
			/>
			<path
				fill="#FBBC05"
				d="M5.4 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.6.4-2.4V6.5h-4C.5 8.2 0 10 0 12s.5 3.8 1.4 5.5l4-3.1z"
			/>
			<path
				fill="#EA4335"
				d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0 7.4 0 3.4 2.6 1.4 6.5l4 3.1c.9-2.8 3.5-4.8 6.6-4.8z"
			/>
		</svg>
	)
}

/** "Continue with Google" and the "or with email" divider. Google sign-in comes in v1.x (architecture.md D9). */
export function GoogleSignIn() {
	const t = useTranslations('signIn')
	const notImplemented = useNotImplemented()
	return (
		<>
			<Button
				type="button"
				variant="outline"
				size="lg"
				disabled={useFormPending()}
				onClick={notImplemented}
			>
				<GoogleMark />
				{t('google')}
			</Button>
			<FieldSeparator>{t('orWithEmail')}</FieldSeparator>
		</>
	)
}

/** Looks like a link; the page it leads to doesn't exist yet. */
export function NotImplementedLink({ children }: { children: ReactNode }) {
	const notImplemented = useNotImplemented()
	return (
		<button
			type="button"
			onClick={notImplemented}
			className="rounded-sm underline underline-offset-2 hover:text-foreground"
		>
			{children}
		</button>
	)
}
