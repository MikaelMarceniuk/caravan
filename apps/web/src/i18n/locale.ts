export const LOCALES = ['pt-BR', 'en-US'] as const
/** The cookie next-intl and the proxy read the language from (architecture.md D35). */
export const LOCALE_COOKIE = 'NEXT_LOCALE'
export type Locale = (typeof LOCALES)[number]

/** The browser's favorite language: the highest `q`, the first one on a tie. */
function preferredLanguage(acceptLanguage: string) {
	const languages = acceptLanguage
		.split(',')
		.map((entry) => {
			const [tag = '', ...params] = entry.trim().split(';')
			const q = params.find((param) => param.trim().startsWith('q='))
			return { tag, q: q ? Number(q.trim().slice(2)) : 1 }
		})
		.filter(({ tag }) => tag !== '')
	return languages.sort((a, b) => b.q - a.q)[0]?.tag ?? ''
}

export function isLocale(value: unknown): value is Locale {
	return LOCALES.includes(value as Locale)
}

/** The interface language: the cookie, else the browser's favorite, else English (architecture.md D35). */
export function resolveLocale({
	cookie,
	acceptLanguage = '',
}: {
	cookie?: string
	acceptLanguage?: string
}): Locale {
	if (isLocale(cookie)) return cookie
	// pt, pt-BR and pt-PT all become pt-BR.
	return preferredLanguage(acceptLanguage).toLowerCase().startsWith('pt')
		? 'pt-BR'
		: 'en-US'
}
