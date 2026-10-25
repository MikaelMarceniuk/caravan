import { describe, expect, test } from 'bun:test'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SignUpForm } from '@/components/auth/sign-up-form'
import { descriptionOf, isDisabled } from '../../support/a11y'
import { axeViolations } from '../../support/axe'
import { fakeApi, pendingReply } from '../../support/fake-api'
import { navigation } from '../../support/navigation'
import { renderUi } from '../../support/render'

const SIGN_UP = 'POST /auth/sign-up/email'

async function fillIn({
	name = 'Ana',
	email = 'ana@example.com',
	password = 'a-long-password',
} = {}) {
	const user = userEvent.setup()
	if (name) await user.type(screen.getByLabelText('Your name'), name)
	if (email) await user.type(screen.getByLabelText('Email'), email)
	if (password) await user.type(screen.getByLabelText('Password'), password)
	return user
}

describe('the sign-up form', () => {
	test('creates the account in the language in use', async () => {
		const api = fakeApi({ [SIGN_UP]: () => ({ status: 200, data: {} }) })
		renderUi(<SignUpForm />, { locale: 'pt-BR' })
		const user = userEvent.setup()
		await user.type(screen.getByLabelText('Seu nome'), 'Ana')
		await user.type(screen.getByLabelText('Email'), 'ana@example.com')
		await user.type(screen.getByLabelText('Senha'), 'a-long-password')

		await user.click(screen.getByRole('button', { name: 'Criar conta' }))

		await waitFor(() =>
			expect(api.requests).toEqual([
				{
					route: SIGN_UP,
					body: {
						name: 'Ana',
						email: 'ana@example.com',
						password: 'a-long-password',
						locale: 'pt-BR',
						callbackURL: '/verify-email',
					},
				},
			]),
		)
	})

	test('asks the traveler to confirm the email it was sent to', async () => {
		fakeApi({ [SIGN_UP]: () => ({ status: 200, data: {} }) })
		renderUi(<SignUpForm />)
		const user = await fillIn({ email: 'ana@example.com' })

		await user.click(screen.getByRole('button', { name: 'Create account' }))

		expect(
			await screen.findByRole('heading', { name: 'Check your email' }),
		).toBeTruthy()
		expect(
			screen.getByText(/We sent a confirmation link to ana@example.com/),
		).toBeTruthy()
	})

	test('points at an empty name and sends nothing', async () => {
		const api = fakeApi({ [SIGN_UP]: () => ({ status: 200, data: {} }) })
		renderUi(<SignUpForm />)
		const user = await fillIn({ name: '' })

		await user.click(screen.getByRole('button', { name: 'Create account' }))

		const name = screen.getByLabelText('Your name')
		expect(name.getAttribute('aria-invalid')).toBe('true')
		expect(descriptionOf(name)).toBe('Enter your name.')
		expect(api.requests).toEqual([])
	})

	test('points at an email that is not one', async () => {
		const api = fakeApi({ [SIGN_UP]: () => ({ status: 200, data: {} }) })
		renderUi(<SignUpForm />)
		const user = await fillIn({ email: 'ana.example.com' })

		await user.click(screen.getByRole('button', { name: 'Create account' }))

		expect(descriptionOf(screen.getByLabelText('Email'))).toBe(
			'Enter a valid email.',
		)
		expect(api.requests).toEqual([])
	})

	test('points at a password shorter than 8 characters', async () => {
		const api = fakeApi({ [SIGN_UP]: () => ({ status: 200, data: {} }) })
		renderUi(<SignUpForm />)
		const user = await fillIn({ password: 'seven77' })

		await user.click(screen.getByRole('button', { name: 'Create account' }))

		expect(descriptionOf(screen.getByLabelText('Password'))).toContain(
			'Use at least 8 characters.',
		)
		expect(api.requests).toEqual([])
	})

	test('points at a password longer than 128 characters', async () => {
		fakeApi({ [SIGN_UP]: () => ({ status: 200, data: {} }) })
		renderUi(<SignUpForm />)
		const user = await fillIn({ password: 'x'.repeat(129) })

		await user.click(screen.getByRole('button', { name: 'Create account' }))

		expect(descriptionOf(screen.getByLabelText('Password'))).toContain(
			'Use at most 128 characters.',
		)
	})

	// Plan A13. The API answers a taken email like a new one while sign-in needs a confirmed email,
	// so today this only happens if that changes.
	test('sends a registered email to sign-in, with the email filled in', async () => {
		fakeApi({
			[SIGN_UP]: () => ({
				status: 422,
				data: { code: 'USER_ALREADY_EXISTS', message: 'User already exists' },
			}),
		})
		renderUi(<SignUpForm />)
		const user = await fillIn({ email: 'ana+trip@example.com' })

		await user.click(screen.getByRole('button', { name: 'Create account' }))

		await waitFor(() =>
			expect(navigation.visited()).toEqual([
				'/sign-in?email=ana%2Btrip%40example.com',
			]),
		)
	})

	test('asks to wait after too many attempts', async () => {
		fakeApi({ [SIGN_UP]: () => ({ status: 429 }) })
		renderUi(<SignUpForm />)
		const user = await fillIn()

		await user.click(screen.getByRole('button', { name: 'Create account' }))

		expect((await screen.findByRole('alert')).textContent).toBe(
			'Too many attempts. Wait a moment and try again.',
		)
	})

	test('says something went wrong when the API fails', async () => {
		fakeApi({ [SIGN_UP]: () => ({ status: 500 }) })
		renderUi(<SignUpForm />)
		const user = await fillIn()

		await user.click(screen.getByRole('button', { name: 'Create account' }))

		expect((await screen.findByRole('alert')).textContent).toBe(
			'Something went wrong. Try again.',
		)
	})

	test('shows and hides the password', async () => {
		renderUi(<SignUpForm />)
		const user = userEvent.setup()
		const password = screen.getByLabelText('Password')

		await user.click(screen.getByRole('button', { name: 'Show password' }))
		const shown = password.getAttribute('type')
		await user.click(screen.getByRole('button', { name: 'Hide password' }))

		expect([shown, password.getAttribute('type')]).toEqual(['text', 'password'])
	})

	test('fills the length meter up to 8 characters', async () => {
		renderUi(<SignUpForm />)
		const user = userEvent.setup()
		const meter = screen.getByRole('meter', { name: '8+ characters' })

		await user.type(screen.getByLabelText('Password'), 'four')
		const halfway = meter.getAttribute('aria-valuenow')
		await user.type(screen.getByLabelText('Password'), '-and-more')

		expect([halfway, meter.getAttribute('aria-valuenow')]).toEqual(['4', '8'])
		expect(meter.getAttribute('aria-valuetext')).toBe(
			'Password length: 8 of 8 characters',
		)
	})

	test('says Google sign-in is not implemented yet', async () => {
		renderUi(<SignUpForm />)
		const user = userEvent.setup()

		await user.click(
			screen.getByRole('button', { name: 'Continue with Google' }),
		)

		expect(await screen.findByText('Not implemented yet')).toBeTruthy()
	})

	test('says the terms and the privacy policy are not ready yet', async () => {
		renderUi(<SignUpForm />, { locale: 'pt-BR' })
		const user = userEvent.setup()

		await user.click(screen.getByRole('button', { name: 'Termos' }))
		await user.click(
			screen.getByRole('button', { name: 'Política de Privacidade' }),
		)

		expect(await screen.findAllByText('Ainda não implementado')).toHaveLength(2)
	})

	test('has no accessibility violations, errors shown or not', async () => {
		const { container } = renderUi(<SignUpForm />)
		const before = await axeViolations(container)
		await userEvent
			.setup()
			.click(screen.getByRole('button', { name: 'Create account' }))

		expect([...before, ...(await axeViolations(container))]).toEqual([])
	})

	test('turns the fields off while creating the account', async () => {
		const reply = pendingReply()
		fakeApi({ [SIGN_UP]: reply.route })
		renderUi(<SignUpForm />)
		const user = await fillIn()

		await user.click(screen.getByRole('button', { name: 'Create account' }))

		await waitFor(() =>
			expect(
				['Your name', 'Email', 'Password'].map((label) =>
					isDisabled(screen.getByLabelText(label)),
				),
			).toEqual([true, true, true]),
		)
		expect(
			screen
				.getByRole('button', { name: 'Create account' })
				.getAttribute('aria-busy'),
		).toBe('true')
		reply.send({ status: 200, data: {} })
	})
})
