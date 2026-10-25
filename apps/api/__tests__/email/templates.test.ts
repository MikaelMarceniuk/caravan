import { describe, expect, test } from 'bun:test'
import {
	resetPasswordEmail,
	verificationEmail,
} from '../../src/email/templates'

const URL =
	'http://localhost:3001/api/auth/verify-email?token=abc&callbackURL=%2Fverify-email'

describe('the verification email', () => {
	test('is written in Portuguese for a Portuguese-speaking traveler', () => {
		const email = verificationEmail({ locale: 'pt-BR', name: 'Ana', url: URL })

		expect(email.subject).toBe('Confirme seu email no Caravan')
	})

	test('is written in English for an English-speaking traveler', () => {
		const email = verificationEmail({ locale: 'en-US', name: 'Ana', url: URL })

		expect(email.subject).toBe('Confirm your email for Caravan')
	})

	test('carries the link in the HTML and in the plain text', () => {
		const email = verificationEmail({ locale: 'en-US', name: 'Ana', url: URL })

		expect(email.html).toContain(
			'href="http://localhost:3001/api/auth/verify-email?token=abc&amp;callbackURL=%2Fverify-email"',
		)
		expect(email.text).toContain(URL)
	})

	test("shows the traveler's name as plain text", () => {
		const email = verificationEmail({
			locale: 'en-US',
			name: '<img src=x onerror=alert(1)>',
			url: URL,
		})

		expect(email.html).toContain('Hi, &lt;img src=x onerror=alert(1)&gt;!')
		expect(email.html).not.toContain('<img')
	})
})

describe('the password reset email', () => {
	const RESET_URL =
		'http://localhost:3001/api/auth/reset-password/abc?callbackURL=%2Freset-password'

	test('is written in the traveler language, with the link', () => {
		const portuguese = resetPasswordEmail({
			locale: 'pt-BR',
			name: 'Ana',
			url: RESET_URL,
		})
		const english = resetPasswordEmail({
			locale: 'en-US',
			name: 'Ana',
			url: RESET_URL,
		})

		expect(portuguese.subject).toBe('Redefina sua senha do Caravan')
		expect(english.subject).toBe('Reset your Caravan password')
		expect(english.text).toContain(RESET_URL)
	})
})
