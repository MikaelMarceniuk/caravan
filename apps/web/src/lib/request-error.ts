import { errorCode } from './api'

/** The next-intl key of what to tell the traveler about a failed request that no field explains. */
export function requestErrorKey(error: unknown) {
	return errorCode(error) === 'TOO_MANY_REQUESTS'
		? 'errors.tooManyRequests'
		: 'errors.unexpected'
}
