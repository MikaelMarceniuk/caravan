import { describe, expect, test } from 'bun:test'
import { contrastRatio } from '../src/contrast'

describe('contrastRatio', () => {
	// WCAG 2.2's definition: (L1 + 0.05) / (L2 + 0.05), from 1:1 to 21:1.
	test('is 21 between black and white', () => {
		expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5)
	})

	test('is 1 between a color and itself', () => {
		expect(contrastRatio('#ff8a3d', '#ff8a3d')).toBe(1)
	})

	// WebAIM's checker gives 4.48:1 for #777777 on white, just under AA.
	test('does not depend on the order of the colors', () => {
		expect(contrastRatio('#ffffff', '#777777')).toBeCloseTo(4.48, 2)
		expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2)
	})
})
