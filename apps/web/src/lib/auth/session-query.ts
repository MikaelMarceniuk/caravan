import { queryOptions } from '@tanstack/react-query'
import { fetchSession } from './requests'

// No hooks here: server components import it to prefetch the session.

/** The query key of the signed-in traveler. */
export const SESSION_KEY = ['session'] as const

/**
 * The signed-in traveler. The server prefetches it from the cookie; the client keeps it fresh (plan §11, R3):
 * fresh for 30 s after the server read, then again every 60 s while the tab is visible, on focus and on reconnect.
 */
export const sessionQuery = queryOptions({
	queryKey: SESSION_KEY,
	queryFn: fetchSession,
	staleTime: 30_000,
	refetchInterval: 60_000,
})
