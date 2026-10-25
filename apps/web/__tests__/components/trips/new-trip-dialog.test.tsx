import { describe, expect, test } from 'bun:test'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

const LIST_TRIPS = 'GET /trips'

/** The trips screen of a signed-in traveler with no trips yet, loaded. */
async function renderTripsScreen() {
	fakeApi({ [LIST_TRIPS]: () => ({ status: 200, data: { trips: [] } }) })
	const queryClient = testQueryClient()
	queryClient.setQueryData(SESSION_KEY, ana)
	renderUi(<TripsScreen />, { queryClient })
	await screen.findByRole('tab', { name: 'Upcoming 0' })
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
})
