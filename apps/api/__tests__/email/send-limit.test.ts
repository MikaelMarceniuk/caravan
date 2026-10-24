import { describe, expect, test } from 'bun:test'
import { createSendLimit } from '../../src/email/send-limit'

const HOUR = 60 * 60 * 1000

/** A clock the test moves by hand. */
function fakeClock(start = 0) {
	let now = start
	return {
		now: () => now,
		advance: (ms: number) => {
			now += ms
		},
	}
}

describe('the email send limit', () => {
	test('allows 3 emails to an address in an hour and refuses the 4th', () => {
		const clock = fakeClock()
		const limit = createSendLimit({ max: 3, windowMs: HOUR, now: clock.now })

		const answers = [1, 2, 3, 4].map(() => limit.allow('ana@example.com'))

		expect(answers).toEqual([true, true, true, false])
	})

	test('sends again once the oldest email is an hour old', () => {
		const clock = fakeClock()
		const limit = createSendLimit({ max: 3, windowMs: HOUR, now: clock.now })
		for (let i = 0; i < 3; i++) {
			limit.allow('ana@example.com')
			clock.advance(10 * 60 * 1000)
		}

		// 30 minutes after the first email: still 3 in the last hour.
		const tooSoon = limit.allow('ana@example.com')
		clock.advance(HOUR - 30 * 60 * 1000)
		const anHourLater = limit.allow('ana@example.com')

		expect([tooSoon, anHourLater]).toEqual([false, true])
	})

	test('counts each address apart, whatever the case', () => {
		const limit = createSendLimit({ max: 3, windowMs: HOUR, now: () => 0 })
		for (let i = 0; i < 3; i++) limit.allow('ana@example.com')

		const sameAddress = limit.allow('Ana@Example.com')
		const otherAddress = limit.allow('leo@example.com')

		expect([sameAddress, otherAddress]).toEqual([false, true])
	})
})
