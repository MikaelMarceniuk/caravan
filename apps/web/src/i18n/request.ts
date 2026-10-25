import { cookies } from 'next/headers'
import { getRequestConfig } from 'next-intl/server'
import { LOCALE_COOKIE, resolveLocale } from './locale'

// The proxy has already stored the language in the cookie, for this request too (src/proxy.ts).
export default getRequestConfig(async () => {
	const locale = resolveLocale({
		cookie: (await cookies()).get(LOCALE_COOKIE)?.value,
	})
	return {
		locale,
		messages: (await import(`../../messages/${locale}.json`)).default,
	}
})
