import { useTranslations } from 'next-intl'
import { Logo } from '@/components/brand/logo'
import type { Traveler } from '@/lib/auth'
import { SignOutButton } from './sign-out-button'

/** The temporary page after signing in, until /trips exists (plan B10). No design yet: kept simple. */
export function SessionView({ traveler }: { traveler: Traveler }) {
	const t = useTranslations()
	const rows = [
		[t('session.name'), traveler.name],
		[t('session.email'), traveler.email],
		[t('session.language'), t(`languages.${traveler.locale}`)],
		[
			t('session.emailConfirmed'),
			traveler.emailVerified ? t('session.yes') : t('session.no'),
		],
	]
	return (
		<div className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-10 px-4 py-8 sm:px-8">
			<header>
				<Logo />
			</header>
			<main className="flex flex-col gap-8">
				<div className="flex flex-col gap-2">
					<h1 className="font-heading text-4xl font-bold tracking-tight">
						{t('session.title')}
					</h1>
					<p className="text-muted-foreground">{t('session.subtitle')}</p>
				</div>
				<dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-xl border bg-card p-6 sm:grid-cols-[auto_1fr]">
					{rows.map(([term, value]) => (
						<div key={term} className="contents">
							<dt className="text-sm text-label">{term}</dt>
							<dd className="break-all">{value}</dd>
						</div>
					))}
				</dl>
				<SignOutButton />
			</main>
		</div>
	)
}
