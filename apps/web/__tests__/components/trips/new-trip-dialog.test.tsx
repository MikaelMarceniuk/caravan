import { describe, expect, test } from 'bun:test'
import type { TripSummary } from '@caravan/core'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TripsScreen } from '@/components/trips/trips-screen'
import { SESSION_KEY, type Traveler } from '@/lib/auth'
import { descriptionOf } from '../../support/a11y'
import { fakeApi } from '../../support/fake-api'
import { renderUi, testQueryClient } from '../../support/render'

const ana: Traveler = {
	id: '01a16ee4-c14f-7252-95a6-007731f85dbb',
	name: 'Ana Souza',
	email: 'ana@example.com',
	emailVerified: true,
	locale: 'en-US',
}

const LIST_TRIPS = 'GET /trips'
const CREATE_TRIP = 'POST /trips'

const TRIP_ID = '01a16ee4-c14f-7252-95a6-007731f85dbc'

/** The trips screen of a signed-in traveler with no trips yet, loaded. Returns the requests the API got. */
async function renderTripsScreen(routes: Parameters<typeof fakeApi>[0] = {}) {
	const api = fakeApi({
		[LIST_TRIPS]: () => ({ status: 200, data: { trips: [] } }),
		...routes,
	})
	const queryClient = testQueryClient()
	queryClient.setQueryData(SESSION_KEY, ana)
	renderUi(<TripsScreen />, { queryClient })
	await screen.findByRole('tab', { name: 'Upcoming 0' })
	return api
}

/** Opens the dialog, types the name (if any) and sends it. */
async function createTrip(name: string) {
	const user = userEvent.setup()
	await user.click(screen.getByRole('button', { name: 'New trip' }))
	if (name) {
		await user.click(screen.getByLabelText('Trip name'))
		await user.paste(name)
	}
	await user.click(screen.getByRole('button', { name: 'Create trip' }))
}

/** The routes the API was asked for, besides the trip list the screen loads. */
function sentBesidesTheList(
	api: Awaited<ReturnType<typeof renderTripsScreen>>,
) {
	return api.requests.filter(({ route }) => route !== LIST_TRIPS)
}

describe('the new trip dialog', () => {
	test('opens with the name focused', async () => {
		await renderTripsScreen()

		await userEvent
			.setup()
			.click(screen.getByRole('button', { name: 'New trip' }))

		expect(screen.getByRole('dialog', { name: 'Plan a new trip' })).toBeTruthy()
		expect(document.activeElement).toBe(screen.getByLabelText('Trip name'))
	})

	test('asks for a name, and sends nothing', async () => {
		const api = await renderTripsScreen()

		await createTrip('   ')

		expect(descriptionOf(screen.getByLabelText('Trip name'))).toBe(
			'Give the trip a name.',
		)
		expect(sentBesidesTheList(api)).toEqual([])
	})

	test('refuses a name longer than 120 characters', async () => {
		const api = await renderTripsScreen()

		await createTrip('a'.repeat(121))

		expect(descriptionOf(screen.getByLabelText('Trip name'))).toBe(
			'Use at most 120 characters.',
		)
		expect(sentBesidesTheList(api)).toEqual([])
	})

	test('closes and shows the new trip after creating it', async () => {
		// The API as it behaves: the trip it creates is in the next list.
		const trips: TripSummary[] = []
		const api = await renderTripsScreen({
			[LIST_TRIPS]: () => ({ status: 200, data: { trips: [...trips] } }),
			[CREATE_TRIP]: ({ name }) => {
				const trip = { id: TRIP_ID, name: String(name) }
				trips.unshift(trip)
				return { status: 201, data: { trip } }
			},
		})

		await createTrip('  Balkans Road Trip ')

		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
		expect(await screen.findByText('Trip created')).toBeTruthy()
		const [card] = await screen.findAllByRole('article')
		expect(within(card as HTMLElement).getByRole('heading').textContent).toBe(
			'Balkans Road Trip',
		)
		expect(sentBesidesTheList(api)).toEqual([
			{ route: CREATE_TRIP, body: { name: 'Balkans Road Trip' } },
		])
	})
})
