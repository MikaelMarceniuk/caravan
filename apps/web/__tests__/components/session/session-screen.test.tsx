import { describe, expect, test } from 'bun:test'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SessionScreen } from '@/components/session/session-screen'
import { SESSION_KEY, type Traveler } from '@/lib/auth'
import { fakeApi } from '../../support/fake-api'
import { navigation } from '../../support/navigation'
import { renderUi, testQueryClient } from '../../support/render'

const ana: Traveler = {
	id: '01a16ee4-c14f-7252-95a6-007731f85dbb',
	name: 'Ana',
	email: 'ana@example.com',
	emailVerified: true,
	locale: 'pt-BR',
}

const GET_SESSION = 'GET /auth/get-session'

describe('the session screen', () => {
	test('shows the session the server read, without asking again', () => {
		const api = fakeApi({
			[GET_SESSION]: () => ({ status: 200, data: { user: ana } }),
		})
		const queryClient = testQueryClient()
		queryClient.setQueryData(SESSION_KEY, ana)

		renderUi(<SessionScreen />, { queryClient })

		expect(screen.getByText('ana@example.com')).toBeTruthy()
		expect(api.requests).toEqual([])
	})

	test('goes to sign-in when a refresh finds the session over', async () => {
		fakeApi({ [GET_SESSION]: () => ({ status: 200, data: null }) })
		const queryClient = testQueryClient()
		// Read long ago: past its 30 s of freshness, so the screen refreshes it.
		queryClient.setQueryData(SESSION_KEY, ana, { updatedAt: 0 })

		renderUi(<SessionScreen />, { queryClient })

		await waitFor(() => expect(navigation.visited()).toEqual(['/sign-in']))
	})

	test('forgets the session as soon as the traveler signs out', async () => {
		fakeApi({
			'POST /auth/sign-out': () => ({ status: 200, data: { success: true } }),
		})
		const queryClient = testQueryClient()
		queryClient.setQueryData(SESSION_KEY, ana)
		renderUi(<SessionScreen />, { queryClient })

		await userEvent
			.setup()
			.click(screen.getByRole('button', { name: 'Sign out' }))

		await waitFor(() =>
			expect(screen.queryByText('ana@example.com')).toBeNull(),
		)
	})
})
