import type { useTranslations } from 'next-intl'
import { errorCode } from './api'

type Translate = ReturnType<typeof useTranslations>

/** The next-intl key of what to tell the traveler about a failed request that no field explains. */
export function requestErrorKey(error: unknown) {
	return errorCode(error) === 'TOO_MANY_REQUESTS'
		? 'errors.tooManyRequests'
		: 'errors.unexpected'
}

/** That message, translated. */
export function requestErrorMessage(error: unknown, t: Translate) {
	return t(requestErrorKey(error))
}
