import { type NextRequest, NextResponse } from 'next/server'
import { LOCALE_COOKIE, resolveLocale } from '@/i18n/locale'

const ONE_YEAR = 60 * 60 * 24 * 365

/** Every page visit leaves the language in a cookie, signed in or not (architecture.md D35, plan A14). */
export function proxy(request: NextRequest) {
	const cookie = request.cookies.get(LOCALE_COOKIE)?.value
	const locale = resolveLocale({
		cookie,
		acceptLanguage: request.headers.get('accept-language') ?? undefined,
	})
	if (cookie === locale) return NextResponse.next()

	// The page rendered for this very request reads the language from the cookie too.
	request.cookies.set(LOCALE_COOKIE, locale)
	const response = NextResponse.next({ request: { headers: request.headers } })
	response.cookies.set(LOCALE_COOKIE, locale, {
		path: '/',
		maxAge: ONE_YEAR,
		sameSite: 'lax',
		secure: request.nextUrl.protocol === 'https:',
	})
	return response
}

export const config = {
	// Pages only: not the API, Next's assets or files.
	matcher: ['/((?!api|_next|.*\\..*).*)'],
}
