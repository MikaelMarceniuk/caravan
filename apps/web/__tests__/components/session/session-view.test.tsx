import { describe, expect, test } from 'bun:test'
import { screen, within } from '@testing-library/react'
import { SessionView } from '@/components/session/session-view'
import type { Traveler } from '@/lib/auth'
import { axeViolations } from '../../support/axe'
import { renderUi } from '../../support/render'

const ana: Traveler = {
	id: '01a16ee4-c14f-7252-95a6-007731f85dbb',
	name: 'Ana',
	email: 'ana@example.com',
	emailVerified: true,
	locale: 'pt-BR',
}

/** The value a definition list pairs with a term. */
function termValue(term: string) {
	return screen.getByText(term, { selector: 'dt' }).nextElementSibling
		?.textContent
}

describe('the session page', () => {
	test('tells who is signed in', () => {
		renderUi(<SessionView traveler={ana} />)

		expect(
			['Name', 'Email', 'Language', 'Email confirmed'].map(termValue),
		).toEqual(['Ana', 'ana@example.com', 'Português (Brasil)', 'Yes'])
		expect(
			within(screen.getByRole('main')).getByRole('heading', {
				name: 'Your session',
			}),
		).toBeTruthy()
	})

	test('has no accessibility violations', async () => {
		const { container } = renderUi(<SessionView traveler={ana} />)

		expect(await axeViolations(container)).toEqual([])
	})
})
