import { describe, expect, test } from 'bun:test'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ResetPasswordForm } from '@/components/auth/reset-password-form'
import { descriptionOf, isDisabled } from '../../support/a11y'
import { axeViolations } from '../../support/axe'
import { fakeApi, pendingReply } from '../../support/fake-api'
import { navigation } from '../../support/navigation'
import { renderUi } from '../../support/render'

const RESET = 'POST /auth/reset-password'

async function choose(password = 'a-brand-new-password') {
	const user = userEvent.setup()
	if (password) await user.type(screen.getByLabelText('New password'), password)
	await user.click(screen.getByRole('button', { name: 'Save password' }))
}

describe('the reset password form', () => {
	test("saves the new password with the link's token", async () => {
		const api = fakeApi({ [RESET]: () => ({ status: 200, data: {} }) })
		renderUi(<ResetPasswordForm token="token-from-link" />)

		await choose()

		await waitFor(() =>
			expect(navigation.visited()).toEqual(['/sign-in?reset=done']),
		)
		expect(api.requests).toEqual([
			{
				route: RESET,
				body: { token: 'token-from-link', newPassword: 'a-brand-new-password' },
			},
		])
	})

	test('points at a password shorter than 8 characters and sends nothing', async () => {
		const api = fakeApi({ [RESET]: () => ({ status: 200, data: {} }) })
		renderUi(<ResetPasswordForm token="token-from-link" />)

		await choose('seven77')

		expect(descriptionOf(screen.getByLabelText('New password'))).toContain(
			'Use at least 8 characters.',
		)
		expect(api.requests).toEqual([])
	})

	test('offers a new link when the token is no longer valid', async () => {
		fakeApi({
			[RESET]: () => ({ status: 400, data: { code: 'INVALID_TOKEN' } }),
		})
		renderUi(<ResetPasswordForm token="expired-token" />)

		await choose()

		expect(
			await screen.findByText('This link is invalid or has expired.'),
		).toBeTruthy()
		expect(
			screen
				.getByRole('link', { name: 'Ask for a new link' })
				.getAttribute('href'),
		).toBe('/forgot-password')
	})

	test('says the link is invalid when it came without a token', () => {
		renderUi(<ResetPasswordForm />, { locale: 'pt-BR' })

		expect(screen.getByText('Este link é inválido ou expirou.')).toBeTruthy()
		expect(screen.queryByLabelText('Nova senha')).toBeNull()
	})

	test('has no accessibility violations', async () => {
		const { container } = renderUi(<ResetPasswordForm token="token" />)

		expect(await axeViolations(container)).toEqual([])
	})

	test('turns the field off while saving the password', async () => {
		const reply = pendingReply()
		fakeApi({ [RESET]: reply.route })
		renderUi(<ResetPasswordForm token="token-from-link" />)

		await choose()

		await waitFor(() =>
			expect(isDisabled(screen.getByLabelText('New password'))).toBe(true),
		)
		expect(
			screen
				.getByRole('button', { name: 'Save password' })
				.getAttribute('aria-busy'),
		).toBe('true')
		reply.send({ status: 200, data: {} })
	})
})
