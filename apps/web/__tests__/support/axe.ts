import axe from 'axe-core'

/**
 * The axe rules a DOM without layout can check: names, labels, roles, ARIA (development.md §1).
 * Color contrast needs a real browser; the tokens' own test covers it (packages/tokens).
 */
export async function axeViolations(container: Element) {
	const results = await axe.run(container, {
		rules: { 'color-contrast': { enabled: false } },
	})
	return results.violations.map(
		(violation) => `${violation.id}: ${violation.help}`,
	)
}
