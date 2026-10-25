'use client'

import type { TripSummary } from '@caravan/core'
import { useTranslations } from 'next-intl'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useTrips } from '@/lib/trips'
import { TripCard } from './trip-card'

const NO_TRIPS: TripSummary[] = []

/** The trips page's client side: the traveler's trips, asked to the API. */
export function TripsScreen() {
	const t = useTranslations('trips')
	const { data: trips = NO_TRIPS } = useTrips()
	// A trip with no dates is still to come; M2 sorts by the dates its stops give it (architecture.md D44).
	const upcoming = trips
	const past = NO_TRIPS
	return (
		<main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-8">
			<Tabs defaultValue="upcoming" className="gap-8">
				<div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
					<div className="flex flex-col gap-2">
						<h1 className="font-heading text-5xl font-bold tracking-tight">
							{t('title')}
						</h1>
						<p className="text-muted-foreground">
							{t('comingUp', { count: upcoming.length })}
						</p>
					</div>
					<TabsList>
						<TabsTrigger value="upcoming">
							{t('upcoming')} <TabCount count={upcoming.length} />
						</TabsTrigger>
						<TabsTrigger value="past">
							{t('past')} <TabCount count={past.length} />
						</TabsTrigger>
					</TabsList>
				</div>
				<TabsContent value="upcoming">
					<TripGrid trips={upcoming} />
				</TabsContent>
				<TabsContent value="past">
					<TripGrid trips={past} />
				</TabsContent>
			</Tabs>
		</main>
	)
}

function TabCount({ count }: { count: number }) {
	return <span className="text-xs text-muted-foreground">{count}</span>
}

function TripGrid({ trips }: { trips: TripSummary[] }) {
	return (
		<ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{trips.map((trip) => (
				<li key={trip.id}>
					<TripCard trip={trip} />
				</li>
			))}
		</ul>
	)
}
