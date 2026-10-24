// Temporary: only proves that `bun test` discovers and runs this package's tests.
// Remove it in the PR that adds the first real test of `core`
// (docs/planners/m1-foundation/1.monorepo.md, decision 8).
import { expect, test } from 'bun:test'

test('the test runner runs tests', () => {
	expect('hello world').toBe('hello world')
})
