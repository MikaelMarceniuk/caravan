import { describe, expect, test } from 'bun:test'
import { resolveLocale } from '@/i18n/locale'

// architecture.md D35: cookie → Accept-Language → en-US.
describe('resolveLocale', () => {
	test('speaks Portuguese to a browser that asks for it', () => {
		expect(resolveLocale({ acceptLanguage: 'pt-BR,pt;q=0.9,en;q=0.8' })).toBe(
			'pt-BR',
		)
	})

	test('speaks English to any other language', () => {
		expect(resolveLocale({ acceptLanguage: 'fr-FR,fr;q=0.9' })).toBe('en-US')
	})

	test('takes the first language the browser prefers', () => {
		expect(resolveLocale({ acceptLanguage: 'en-GB,en;q=0.9,pt;q=0.8' })).toBe(
			'en-US',
		)
		expect(resolveLocale({ acceptLanguage: 'fr;q=0.4, pt-PT;q=0.9' })).toBe(
			'pt-BR',
		)
	})

	test('keeps the language the traveler already has in the cookie', () => {
		expect(
			resolveLocale({ cookie: 'en-US', acceptLanguage: 'pt-BR,pt;q=0.9' }),
		).toBe('en-US')
	})

	test('ignores a cookie with a language the interface does not have', () => {
		expect(resolveLocale({ cookie: 'fr-FR', acceptLanguage: 'pt-BR' })).toBe(
			'pt-BR',
		)
	})

	test('falls back to English when the browser says nothing', () => {
		expect(resolveLocale({})).toBe('en-US')
	})
})
