'use client'

import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog'
import { NewTripForm } from './new-trip-form'

/**
 * "Plan a new trip", opened by `children`. Radix traps the focus, closes on Esc and gives the focus back
 * to what opened it (development.md §1); full screen on phones.
 */
export function NewTripDialog({ children }: { children: ReactNode }) {
	const t = useTranslations('newTrip')
	return (
		<Dialog>
			<DialogTrigger asChild>{children}</DialogTrigger>
			<DialogContent
				closeLabel={t('close')}
				className="h-dvh max-w-full gap-6 rounded-none p-6 sm:h-auto sm:max-w-xl sm:rounded-xl"
			>
				<DialogHeader>
					<DialogTitle className="font-heading text-3xl font-bold tracking-tight">
						{t('title')}
					</DialogTitle>
					<DialogDescription>{t('subtitle')}</DialogDescription>
				</DialogHeader>
				<NewTripForm />
			</DialogContent>
		</Dialog>
	)
}
