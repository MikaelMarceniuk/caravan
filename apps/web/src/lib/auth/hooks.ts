import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
	requestPasswordReset,
	resetPassword,
	signIn,
	signOut,
	signUp,
} from './requests'
import { SESSION_KEY, sessionQuery } from './session-query'

// Every request of the app goes through a TanStack Query hook (development.md §2, Web).

/** The signed-in traveler: undefined while unknown, null when there is no session. */
export function useSession() {
	return useQuery(sessionQuery)
}

export function useSignUp() {
	return useMutation({ mutationFn: signUp })
}

export function useSignIn() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: signIn,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: SESSION_KEY }),
	})
}

export function useSignOut() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: signOut,
		onSuccess: () => queryClient.setQueryData(SESSION_KEY, null),
	})
}

export function useRequestPasswordReset() {
	return useMutation({ mutationFn: requestPasswordReset })
}

export function useResetPassword() {
	return useMutation({ mutationFn: resetPassword })
}
