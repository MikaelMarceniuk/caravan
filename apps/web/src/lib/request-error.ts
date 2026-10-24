import type { useTranslations } from 'next-intl'
import { errorCode } from './api'

type Translate = ReturnType<typeof useTranslations>

/** What to tell the traveler about a failed request that no field explains. */
export function requestErrorMessage(error: unknown, t: Translate) {
	return errorCode(error) === 'TOO_MANY_REQUESTS'
		? t('errors.tooManyRequests')
		: t('errors.unexpected')
}
