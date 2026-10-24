import { describe, expect, test } from 'bun:test'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form'
import { descriptionOf } from '../../support/a11y'
import { axeViolations } from '../../support/axe'
import { fakeApi } from '../../support/fake-api'
import { renderUi } from '../../support/render'

const REQUEST = 'POST /auth/request-password-reset'

async function ask(email = 'ana@example.com') {
	const user = userEvent.setup()
	if (email) await user.type(screen.getByLabelText('Email'), email)
	await user.click(screen.getByRole('button', { name: 'Send link' }))
}

describe('the forgot password form', () => {
	test('asks for a link that leads back to the reset page', async () => {
		const api = fakeApi({ [REQUEST]: () => ({ status: 200, data: {} }) })
		renderUi(<ForgotPasswordForm />)

		await ask()

		await waitFor(() =>
			expect(api.requests).toEqual([
				{
					route: REQUEST,
					body: { email: 'ana@example.com', redirectTo: '/reset-password' },
				},
			]),
		)
	})

	// The answer never tells whether the email has an account (the API's doesn't either).
	test('confirms the same way whether or not there is an account', async () => {
		fakeApi({ [REQUEST]: () => ({ status: 200, data: { status: true } }) })
		renderUi(<ForgotPasswordForm />)

		await ask('ana@example.com')

		expect(
			await screen.findByRole('heading', { name: 'Check your email' }),
		).toBeTruthy()
		expect(
			screen.getByText(/If there is an account for ana@example.com/),
		).toBeTruthy()
	})

	test('points at an invalid email and sends nothing', async () => {
		const api = fakeApi({ [REQUEST]: () => ({ status: 200, data: {} }) })
		renderUi(<ForgotPasswordForm />)

		await ask('ana.example.com')

		expect(descriptionOf(screen.getByLabelText('Email'))).toBe(
			'Enter a valid email.',
		)
		expect(api.requests).toEqual([])
	})

	test('asks to wait after too many requests', async () => {
		fakeApi({ [REQUEST]: () => ({ status: 429 }) })
		renderUi(<ForgotPasswordForm />)

		await ask()

		expect((await screen.findByRole('alert')).textContent).toBe(
			'Too many attempts. Wait a moment and try again.',
		)
	})

	test('has no accessibility violations', async () => {
		const { container } = renderUi(<ForgotPasswordForm />)

		expect(await axeViolations(container)).toEqual([])
	})
})
