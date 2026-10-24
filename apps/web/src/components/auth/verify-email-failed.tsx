import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Alert, AlertDescription } from '@/components/ui/alert'

/** Where an invalid or expired confirmation link lands (/verify-email?error=INVALID_TOKEN). */
export function VerifyEmailFailed() {
	const t = useTranslations('verifyEmail')
	return (
		<div className="flex flex-col gap-8">
			<h1 className="font-heading text-4xl font-bold tracking-tight">
				{t('title')}
			</h1>
			<Alert variant="destructive">
				<AlertDescription>{t('invalidLink')}</AlertDescription>
			</Alert>
			<Link
				href="/sign-in"
				className="self-start rounded-sm font-semibold text-link underline-offset-4 hover:underline"
			>
				{t('signIn')}
			</Link>
		</div>
	)
}
