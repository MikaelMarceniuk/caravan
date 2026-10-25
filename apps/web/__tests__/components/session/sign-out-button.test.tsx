import { describe, expect, test } from 'bun:test'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SignOutButton } from '@/components/session/sign-out-button'
import { isDisabled } from '../../support/a11y'
import { fakeApi, pendingReply } from '../../support/fake-api'
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

	test('shows it is busy while signing out', async () => {
		const reply = pendingReply()
		fakeApi({ 'POST /auth/sign-out': reply.route })
		renderUi(<SignOutButton />)

		await userEvent
			.setup()
			.click(screen.getByRole('button', { name: 'Sign out' }))

		const button = screen.getByRole('button', { name: 'Sign out' })
		await waitFor(() => expect(button.getAttribute('aria-busy')).toBe('true'))
		expect(isDisabled(button)).toBe(true)
		reply.send({ status: 200, data: { success: true } })
	})
})
