import { describe, expect, test } from 'bun:test'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SignInForm } from '@/components/auth/sign-in-form'
import { descriptionOf } from '../../support/a11y'
import { axeViolations } from '../../support/axe'
import { fakeApi } from '../../support/fake-api'
import { navigation } from '../../support/navigation'
import { renderUi } from '../../support/render'

const SIGN_IN = 'POST /auth/sign-in/email'

const traveler = (locale = 'en-US') => ({
	status: 200,
	data: {
		user: {
			id: '01a16ee4-c14f-7252-95a6-007731f85dbb',
			name: 'Ana',
			email: 'ana@example.com',
			emailVerified: true,
			locale,
		},
	},
})

async function signIn({
	email = 'ana@example.com',
	password = 'a-long-password',
} = {}) {
	const user = userEvent.setup()
	if (email) await user.type(screen.getByLabelText('Email'), email)
	if (password) await user.type(screen.getByLabelText('Password'), password)
	await user.click(screen.getByRole('button', { name: 'Sign in' }))
}

describe('the sign-in form', () => {
	test('signs the traveler in and opens the session page', async () => {
		const api = fakeApi({ [SIGN_IN]: () => traveler() })
		renderUi(<SignInForm />)

		await signIn()

		await waitFor(() => expect(navigation.visited()).toEqual(['/session']))
		expect(api.requests).toEqual([
			{
				route: SIGN_IN,
				body: { email: 'ana@example.com', password: 'a-long-password' },
			},
		])
	})

	// architecture.md D35: the account's language wins over the browser's.
	test("switches the interface to the traveler's own language", async () => {
		fakeApi({ [SIGN_IN]: () => traveler('pt-BR') })
		renderUi(<SignInForm />)

		await signIn()

		await waitFor(() => expect(document.cookie).toContain('NEXT_LOCALE=pt-BR'))
	})

	test('starts with the email the link carried', () => {
		renderUi(<SignInForm email="ana@example.com" />)

		expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe(
			'ana@example.com',
		)
	})

	test('answers wrong credentials with one message', async () => {
		fakeApi({
			[SIGN_IN]: () => ({
				status: 401,
				data: { code: 'INVALID_EMAIL_OR_PASSWORD' },
			}),
		})
		renderUi(<SignInForm />)

		await signIn()

		expect((await screen.findByRole('alert')).textContent).toBe(
			'Wrong email or password.',
		)
	})

	test('tells a traveler who has not confirmed the email that a new link is on its way', async () => {
		fakeApi({
			[SIGN_IN]: () => ({ status: 403, data: { code: 'EMAIL_NOT_VERIFIED' } }),
		})
		renderUi(<SignInForm />)

		await signIn()

		expect((await screen.findByRole('alert')).textContent).toBe(
			'Confirm your email first: we sent you a new link.',
		)
	})

	test('points at an invalid email and an empty password, and sends nothing', async () => {
		const api = fakeApi({ [SIGN_IN]: () => traveler() })
		renderUi(<SignInForm />)

		await signIn({ email: 'ana.example.com', password: '' })

		expect(descriptionOf(screen.getByLabelText('Email'))).toBe(
			'Enter a valid email.',
		)
		expect(descriptionOf(screen.getByLabelText('Password'))).toBe(
			'Enter your password.',
		)
		expect(api.requests).toEqual([])
	})

	test('confirms the password was changed, after a reset', () => {
		renderUi(<SignInForm passwordChanged />)

		expect(screen.getByRole('status').textContent).toBe(
			'Your password was changed. Sign in with the new one.',
		)
	})

	test('says Google sign-in is not implemented yet', async () => {
		renderUi(<SignInForm />)

		await userEvent
			.setup()
			.click(screen.getByRole('button', { name: 'Continue with Google' }))

		expect(await screen.findByText('Not implemented yet')).toBeTruthy()
	})

	test('leads to the forgotten password and to sign-up', () => {
		renderUi(<SignInForm />)

		expect(
			screen
				.getByRole('link', { name: 'Forgot password?' })
				.getAttribute('href'),
		).toBe('/forgot-password')
		expect(
			screen
				.getByRole('link', { name: 'Create an account' })
				.getAttribute('href'),
		).toBe('/sign-up')
	})

	test('has no accessibility violations, errors shown or not', async () => {
		const { container } = renderUi(<SignInForm passwordChanged />)
		const before = await axeViolations(container)
		await userEvent
			.setup()
			.click(screen.getByRole('button', { name: 'Sign in' }))

		expect([...before, ...(await axeViolations(container))]).toEqual([])
	})
})
