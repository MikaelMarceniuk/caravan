import { describe, expect, test } from 'bun:test'
import { colors, contrastPairs } from '../src'
import { contrastRatio } from '../src/contrast'

describe('the color tokens', () => {
	// WCAG 2.2 AA: 4.5:1 for text (1.4.3), 3:1 for large text and the parts that identify a control (1.4.11).
	test.each(contrastPairs)(
		'$foreground on $background reaches $minimum:1',
		({ foreground, background, minimum }) => {
			expect(
				contrastRatio(colors[foreground], colors[background]),
			).toBeGreaterThanOrEqual(minimum)
		},
	)
})
