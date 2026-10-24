import type { Metadata } from 'next'
import { Bricolage_Grotesque, DM_Sans, JetBrains_Mono } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getTranslations } from 'next-intl/server'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Providers } from './providers'
import './globals.css'

// Picked from the design's PNGs (docs/design); there is no font file in the design.
const display = Bricolage_Grotesque({
	subsets: ['latin'],
	variable: '--font-display',
})
const body = DM_Sans({ subsets: ['latin'], variable: '--font-body' })
const code = JetBrains_Mono({ subsets: ['latin'], variable: '--font-code' })

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations('app')
	return { title: 'Caravan', description: t('description') }
}

export default async function RootLayout({
	children,
}: {
	children: ReactNode
}) {
	// The language the proxy resolved and stored in the cookie (architecture.md D35).
	const locale = await getLocale()
	return (
		<html
			lang={locale}
			className={cn(display.variable, body.variable, code.variable)}
		>
			<body>
				<NextIntlClientProvider>
					<Providers>{children}</Providers>
				</NextIntlClientProvider>
			</body>
		</html>
	)
}
