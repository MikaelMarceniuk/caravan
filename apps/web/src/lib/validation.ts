import type { useTranslations } from 'next-intl'
import { PASSWORD_MAX, PASSWORD_MIN } from './auth'

type Translate = ReturnType<typeof useTranslations>

// Enough to catch a typo before the request; the API has the final word.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isEmail(value: string) {
	return EMAIL.test(value.trim())
}

/** What is wrong with a new password's length, the API's own limits (architecture.md D40). */
export function passwordLengthError(password: string, t: Translate) {
	if (password.length < PASSWORD_MIN)
		return t('errors.passwordTooShort', { minimum: PASSWORD_MIN })
	if (password.length > PASSWORD_MAX)
		return t('errors.passwordTooLong', { maximum: PASSWORD_MAX })
	return undefined
}
