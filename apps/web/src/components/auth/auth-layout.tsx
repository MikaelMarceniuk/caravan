import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import { Logo } from '@/components/brand/logo'
import { Postcards } from './postcards'

const REPOSITORY = 'https://github.com/MikaelMarceniuk/caravan'

/** The two halves of the auth screens (docs/design/SignIn.png): the form, and the postcards on wide screens. */
export function AuthLayout({ children }: { children: ReactNode }) {
	const t = useTranslations('app')
	return (
		<div className="grid min-h-dvh lg:grid-cols-[minmax(0,640px)_1fr]">
			<div className="flex flex-col px-4 py-8 sm:px-12 lg:px-24 lg:py-10">
				<header>
					<Logo />
				</header>
				<main className="flex flex-1 flex-col justify-center py-10">
					<div className="w-full max-w-md">{children}</div>
				</main>
				<footer className="text-xs text-subtle">
					{t('footer')} ·{' '}
					<a
						href={REPOSITORY}
						className="rounded-sm underline underline-offset-2 hover:text-foreground"
					>
						{t('github')}
					</a>
				</footer>
			</div>
			<aside className="relative hidden overflow-hidden bg-canvas bg-[radial-gradient(var(--color-surface)_1.5px,transparent_1.5px)] bg-size-[24px_24px] lg:flex lg:flex-col lg:justify-between lg:px-20 lg:py-24">
				<div aria-hidden="true" className="flex flex-1 justify-center">
					<Postcards />
				</div>
				<p className="max-w-xl font-heading text-3xl leading-tight font-bold tracking-tight">
					{t('tagline')}{' '}
					<span className="text-subtle">{t('taglineMuted')}</span>
				</p>
			</aside>
		</div>
	)
}
