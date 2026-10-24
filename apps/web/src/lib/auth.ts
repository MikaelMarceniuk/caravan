import type { Locale } from '@/i18n/locale'
import { api } from './api'

// Better Auth's endpoints, under /api/auth on the API (docs/features/auth-emails.md).

/** The traveler as the API describes them. */
export type Traveler = {
	id: string
	name: string
	email: string
	emailVerified: boolean
	locale: Locale
}

// Better Auth's limits, kept by the API (architecture.md D40).
export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 128

export async function signUp(input: {
	name: string
	email: string
	password: string
	locale: Locale
}) {
	// The emailed link confirms the account and lands on /verify-email, signed in.
	await api.post('/auth/sign-up/email', {
		...input,
		callbackURL: '/verify-email',
	})
}

export async function signIn(input: { email: string; password: string }) {
	const { data } = await api.post<{ user: Traveler }>(
		'/auth/sign-in/email',
		input,
	)
	return data.user
}

export async function signOut() {
	await api.post('/auth/sign-out', {})
}

export async function requestPasswordReset(email: string) {
	// The emailed link lands on /reset-password?token=...
	await api.post('/auth/request-password-reset', {
		email,
		redirectTo: '/reset-password',
	})
}

export async function resetPassword(input: {
	token: string
	newPassword: string
}) {
	await api.post('/auth/reset-password', input)
}
