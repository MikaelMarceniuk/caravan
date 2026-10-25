import type { TripSummary } from '@caravan/core'
import { useTranslations } from 'next-intl'

/** One trip of the list. Not a link until the trip has a page of its own (M2). */
export function TripCard({ trip }: { trip: TripSummary }) {
	const t = useTranslations('trips')
	return (
		<article className="flex min-h-44 flex-col gap-2 rounded-xl border bg-card p-6">
			<h2 className="font-heading text-2xl font-bold tracking-tight break-words">
				{trip.name}
			</h2>
			{/* M2 shows the dates, the nights and the route of the stops here. */}
			<p className="text-muted-foreground">{t('noStops')}</p>
		</article>
	)
}
