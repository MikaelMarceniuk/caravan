/** At most `max` emails per address in any `windowMs`; in memory, one API instance until M5. */
export function createSendLimit({
	max,
	windowMs,
	now,
}: {
	max: number
	windowMs: number
	now: () => number
}) {
	const sent = new Map<string, number[]>()
	return {
		allow(email: string) {
			const address = email.toLowerCase()
			const at = now()
			// Only the emails of the last window count; older ones are dropped.
			const times = (sent.get(address) ?? []).filter(
				(time) => at - time < windowMs,
			)
			if (times.length >= max) {
				sent.set(address, times)
				return false
			}
			sent.set(address, [...times, at])
			return true
		},
	}
}
