import { describe, expect, test } from 'bun:test'
import { screen } from '@testing-library/react'
import { VerifyEmailFailed } from '@/components/auth/verify-email-failed'
import { axeViolations } from '../../support/axe'
import { renderUi } from '../../support/render'

describe('a confirmation link that failed', () => {
	test('explains that signing in sends a new one', () => {
		renderUi(<VerifyEmailFailed />, { locale: 'pt-BR' })

		expect(
			screen.getByText(
				'Este link de confirmação é inválido ou expirou. Entre para receber outro.',
			),
		).toBeTruthy()
		expect(
			screen.getByRole('link', { name: 'Entrar' }).getAttribute('href'),
		).toBe('/sign-in')
	})

	test('has no accessibility violations', async () => {
		const { container } = renderUi(<VerifyEmailFailed />)

		expect(await axeViolations(container)).toEqual([])
	})
})
