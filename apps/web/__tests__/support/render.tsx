import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import type { ReactNode } from 'react'
import { Toaster } from '@/components/ui/sonner'
import type { Locale } from '@/i18n/locale'
import enUS from '../../messages/en-US.json'
import ptBR from '../../messages/pt-BR.json'

const MESSAGES = { 'en-US': enUS, 'pt-BR': ptBR }

/** Renders a piece of the interface with what the app wraps it in: language, queries and toasts. */
export function renderUi(
	ui: ReactNode,
	{ locale = 'en-US' }: { locale?: Locale } = {},
) {
	const queryClient = new QueryClient({
		defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
	})
	return render(
		<NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
			<QueryClientProvider client={queryClient}>
				{ui}
				<Toaster />
			</QueryClientProvider>
		</NextIntlClientProvider>,
	)
}
