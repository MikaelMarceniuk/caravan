import type { TripSummary } from '@caravan/core'

/** One trip of the list. Not a link until the trip has a page of its own (M2). */
export function TripCard({ trip }: { trip: TripSummary }) {
	return (
		<article className="flex min-h-44 flex-col gap-2 rounded-xl border bg-card p-6">
			<h2 className="font-heading text-2xl font-bold tracking-tight break-words">
				{trip.name}
			</h2>
		</article>
	)
}
