// Enough to catch a typo before the request; the API has the final word.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isEmail(value: string) {
	return EMAIL.test(value.trim())
}
