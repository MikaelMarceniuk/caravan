import { LOCALE_COOKIE, type Locale } from './locale'

const ONE_YEAR = 60 * 60 * 24 * 365

/** Stores the language in the cookie the proxy and next-intl read (architecture.md D35). */
export function storeLocale(locale: Locale) {
	const secure = window.location.protocol === 'https:' ? '; secure' : ''
	// biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API is not in every browser the app supports.
	document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${ONE_YEAR}; samesite=lax${secure}`
}
