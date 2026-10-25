import { describe, expect, test } from 'bun:test'
import type { TripSummary } from '@caravan/core'
import { screen, within } from '@testing-library/react'
import { TripsScreen } from '@/components/trips/trips-screen'
import { SESSION_KEY, type Traveler } from '@/lib/auth'
import { fakeApi } from '../../support/fake-api'
import { renderUi, testQueryClient } from '../../support/render'

const ana: Traveler = {
	id: '01a16ee4-c14f-7252-95a6-007731f85dbb',
	name: 'Ana Souza',
	email: 'ana@example.com',
	emailVerified: true,
	locale: 'en-US',
}

const balkans: TripSummary = {
	id: '01a16ee4-c14f-7252-95a6-007731f85dbc',
	name: 'Balkans Road Trip',
}
const japan: TripSummary = {
	id: '01a16ee4-c14f-7252-95a6-007731f85dbd',
	name: 'Japan in Autumn',
}

const LIST_TRIPS = 'GET /trips'

/** The trips screen of a signed-in traveler, as the server hands it over. */
function renderTripsScreen() {
	const queryClient = testQueryClient()
	queryClient.setQueryData(SESSION_KEY, ana)
	return renderUi(<TripsScreen />, { queryClient })
}

/** The names on the trip cards, in order. */
async function tripNames() {
	const cards = await screen.findAllByRole('article')
	return cards.map((card) => within(card).getByRole('heading').textContent)
}

describe('the trips screen', () => {
	test('shows the trips the API lists', async () => {
		fakeApi({
			[LIST_TRIPS]: () => ({ status: 200, data: { trips: [balkans, japan] } }),
		})

		renderTripsScreen()

		expect(await tripNames()).toEqual(['Balkans Road Trip', 'Japan in Autumn'])
	})

	test('counts the upcoming trips', async () => {
		fakeApi({
			[LIST_TRIPS]: () => ({ status: 200, data: { trips: [balkans, japan] } }),
		})

		renderTripsScreen()

		expect(
			await screen.findByRole('tab', { name: 'Upcoming 2', selected: true }),
		).toBeTruthy()
		expect(screen.getByRole('tab', { name: 'Past 0' })).toBeTruthy()
		expect(screen.getByText('2 coming up')).toBeTruthy()
	})

	test('tells a trip has no stops yet', async () => {
		fakeApi({
			[LIST_TRIPS]: () => ({ status: 200, data: { trips: [balkans] } }),
		})

		renderTripsScreen()

		const [card] = await screen.findAllByRole('article')
		expect(card?.textContent).toContain('No stops yet')
	})
})
