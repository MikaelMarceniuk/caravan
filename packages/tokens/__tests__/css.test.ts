import { describe, expect, test } from 'bun:test'
import { themeCss } from '../src'

describe('the theme CSS', () => {
	test('declares a CSS variable for each color token, in kebab case', () => {
		const css = themeCss()

		expect(css).toContain('--background: #13131a;')
		expect(css).toContain('--primary-foreground: #13131a;')
	})

	test('is what theme.css holds (`bun run generate` after changing a token)', async () => {
		const file = await Bun.file(
			new URL('../theme.css', import.meta.url).pathname,
		).text()

		expect(file).toBe(themeCss())
	})
})
