import { describe, expect, test } from 'bun:test'
import { screen } from '@testing-library/react'
import { AuthLayout } from '@/components/auth/auth-layout'
import { axeViolations } from '../../support/axe'
import { renderUi } from '../../support/render'

describe('the auth screens layout', () => {
	test('speaks the traveler language', () => {
		renderUi(<AuthLayout>form</AuthLayout>, { locale: 'pt-BR' })

		expect(screen.getByText('Planeje a viagem juntos.')).toBeTruthy()
	})

	test('keeps the postcards away from screen readers', () => {
		renderUi(<AuthLayout>form</AuthLayout>)

		expect(
			screen.getByText('Lisbon').closest('[aria-hidden="true"]'),
		).not.toBeNull()
	})

	test('links to the source code', () => {
		renderUi(<AuthLayout>form</AuthLayout>)

		expect(
			screen.getByRole('link', { name: 'View on GitHub' }).getAttribute('href'),
		).toBe('https://github.com/MikaelMarceniuk/caravan')
	})

	test('has no accessibility violations', async () => {
		const { container } = renderUi(<AuthLayout>form</AuthLayout>)

		expect(await axeViolations(container)).toEqual([])
	})
})
