'use client'

import type { TripSummary } from '@caravan/core'
import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useTrips } from '@/lib/trips'
import { PlanTripCard } from './plan-trip-card'
import { TripCard } from './trip-card'

const NO_TRIPS: TripSummary[] = []

/** The trips page's client side: the traveler's trips, asked to the API. */
export function TripsScreen() {
	const t = useTranslations('trips')
	const trips = useTrips()
	return (
		<main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-8">
			{trips.isSuccess ? (
				<TripTabs trips={trips.data} />
			) : (
				<>
					<Title />
					{trips.isError ? (
						<div className="flex flex-col items-start gap-4">
							<Alert variant="destructive">
								<AlertDescription>{t('loadFailed')}</AlertDescription>
							</Alert>
							<Button
								variant="outline"
								size="lg"
								disabled={trips.isFetching}
								aria-busy={trips.isFetching || undefined}
								onClick={() => trips.refetch()}
							>
								{t('tryAgain')}
							</Button>
						</div>
					) : (
						<p
							role="status"
							className="flex items-center gap-2 text-muted-foreground"
						>
							<Spinner aria-hidden="true" role="presentation" />
							{t('loading')}
						</p>
					)}
				</>
			)}
		</main>
	)
}

function Title({ children }: { children?: ReactNode }) {
	const t = useTranslations('trips')
	return (
		<div className="flex flex-col gap-2">
			<h1 className="font-heading text-5xl font-bold tracking-tight">
				{t('title')}
			</h1>
			{children}
		</div>
	)
}

function TripTabs({ trips }: { trips: TripSummary[] }) {
	const t = useTranslations('trips')
	// A trip with no dates is still to come; M2 sorts by the dates its stops give it (architecture.md D44).
	const upcoming = trips
	const past = NO_TRIPS
	return (
		<Tabs defaultValue="upcoming" className="gap-8">
			<div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
				<Title>
					<p className="text-muted-foreground">
						{t('comingUp', { count: upcoming.length })}
					</p>
				</Title>
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
				<TripGrid trips={upcoming}>
					<PlanTripCard />
				</TripGrid>
			</TabsContent>
			<TabsContent value="past">
				{past.length > 0 ? (
					<TripGrid trips={past} />
				) : (
					<p className="py-12 text-center text-muted-foreground">
						{t('noPastTrips')}
					</p>
				)}
			</TabsContent>
		</Tabs>
	)
}

function TabCount({ count }: { count: number }) {
	return <span className="text-xs text-muted-foreground">{count}</span>
}

function TripGrid({
	trips,
	children,
}: {
	trips: TripSummary[]
	children?: ReactNode
}) {
	return (
		<ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{trips.map((trip) => (
				<li key={trip.id}>
					<TripCard trip={trip} />
				</li>
			))}
			{children && <li>{children}</li>}
		</ul>
	)
}
