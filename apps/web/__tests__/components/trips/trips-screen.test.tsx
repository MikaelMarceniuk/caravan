import { describe, expect, test } from 'bun:test'
import type { TripSummary } from '@caravan/core'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TripsScreen } from '@/components/trips/trips-screen'
import { SESSION_KEY, type Traveler } from '@/lib/auth'
import { fakeApi, pendingReply } from '../../support/fake-api'
import { navigation } from '../../support/navigation'
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

/**
 * The trips screen of a signed-in traveler, as the server hands it over.
 * `sessionReadAt` 0 stands for a session read long ago, past its 30 s of freshness.
 */
function renderTripsScreen({ sessionReadAt }: { sessionReadAt?: number } = {}) {
	const queryClient = testQueryClient()
	queryClient.setQueryData(SESSION_KEY, ana, { updatedAt: sessionReadAt })
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

	test('shows only the new trip card when there are no trips', async () => {
		fakeApi({ [LIST_TRIPS]: () => ({ status: 200, data: { trips: [] } }) })

		renderTripsScreen()

		expect(
			await screen.findByRole('button', { name: 'Plan a new trip' }),
		).toBeTruthy()
		expect(screen.queryAllByRole('article')).toEqual([])
	})

	test('has no past trips yet', async () => {
		fakeApi({
			[LIST_TRIPS]: () => ({ status: 200, data: { trips: [balkans] } }),
		})
		renderTripsScreen()

		await userEvent
			.setup()
			.click(await screen.findByRole('tab', { name: 'Past 0' }))

		const past = screen.getByRole('tabpanel')
		expect(past.textContent).toBe('No past trips yet')
	})

	test('tells the trips are loading', async () => {
		const reply = pendingReply()
		fakeApi({ [LIST_TRIPS]: reply.route })

		renderTripsScreen()

		expect(screen.getByRole('status').textContent).toBe('Loading your trips…')
		expect(screen.queryByRole('tab')).toBeNull()
		reply.send({ status: 200, data: { trips: [] } })
		await screen.findByRole('tab', { name: 'Upcoming 0' })
	})

	test('offers to try again when the list fails', async () => {
		let replies = [{ status: 500 }, { status: 200, data: { trips: [balkans] } }]
		fakeApi({
			[LIST_TRIPS]: () => {
				const [reply, ...rest] = replies
				replies = rest
				return reply ?? { status: 500 }
			},
		})
		renderTripsScreen()

		expect((await screen.findByRole('alert')).textContent).toContain(
			"We couldn't load your trips.",
		)
		await userEvent
			.setup()
			.click(screen.getByRole('button', { name: 'Try again' }))

		expect(await tripNames()).toEqual(['Balkans Road Trip'])
	})

	test('signs out from the user menu', async () => {
		const api = fakeApi({
			[LIST_TRIPS]: () => ({ status: 200, data: { trips: [] } }),
			'POST /auth/sign-out': () => ({ status: 200, data: { success: true } }),
		})
		renderTripsScreen()
		const user = userEvent.setup()

		await user.click(screen.getByRole('button', { name: 'Ana Souza' }))
		await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }))

		await waitFor(() => expect(navigation.visited()).toEqual(['/sign-in']))
		expect(api.requests.map(({ route }) => route)).toContain(
			'POST /auth/sign-out',
		)
	})

	test('goes to sign-in when the API says the session is over', async () => {
		fakeApi({
			[LIST_TRIPS]: () => ({ status: 401, data: { code: 'UNAUTHORIZED' } }),
		})

		renderTripsScreen()

		await waitFor(() => expect(navigation.visited()).toEqual(['/sign-in']))
	})

	test('shows who is signed in without asking the API again', async () => {
		const api = fakeApi({
			[LIST_TRIPS]: () => ({ status: 200, data: { trips: [] } }),
		})

		renderTripsScreen()

		expect(screen.getByRole('button', { name: 'Ana Souza' })).toBeTruthy()
		await screen.findByRole('tab', { name: 'Upcoming 0' })
		expect(api.requests.map(({ route }) => route)).toEqual([LIST_TRIPS])
	})

	test('goes to sign-in when a refresh finds the session over', async () => {
		fakeApi({
			[LIST_TRIPS]: () => ({ status: 200, data: { trips: [] } }),
			'GET /auth/get-session': () => ({ status: 200, data: null }),
		})

		renderTripsScreen({ sessionReadAt: 0 })

		await waitFor(() => expect(navigation.visited()).toEqual(['/sign-in']))
	})
})
