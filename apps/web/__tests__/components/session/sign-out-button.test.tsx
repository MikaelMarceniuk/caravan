import { describe, expect, test } from 'bun:test'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SignOutButton } from '@/components/session/sign-out-button'
import { fakeApi } from '../../support/fake-api'
import { navigation } from '../../support/navigation'
import { renderUi } from '../../support/render'

describe('signing out', () => {
	test('ends the session and goes back to sign-in', async () => {
		const api = fakeApi({
			'POST /auth/sign-out': () => ({ status: 200, data: { success: true } }),
		})
		renderUi(<SignOutButton />, { locale: 'pt-BR' })

		await userEvent.setup().click(screen.getByRole('button', { name: 'Sair' }))

		await waitFor(() => expect(navigation.visited()).toEqual(['/sign-in']))
		expect(api.requests.map(({ route }) => route)).toEqual([
			'POST /auth/sign-out',
		])
	})
})
