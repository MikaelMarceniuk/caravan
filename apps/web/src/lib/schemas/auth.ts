import { z } from 'zod'
import { PASSWORD_MAX, PASSWORD_MIN } from '@/lib/auth/requests'

// The auth forms' rules. Messages are next-intl keys, translated where they show (src/components/form).
// The API has the final word: Better Auth checks the same limits (architecture.md D40).

// Enough to catch a typo before the request.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const email = z.string().trim().regex(EMAIL, { error: 'errors.emailInvalid' })

const newPassword = z
	.string()
	.min(PASSWORD_MIN, { error: 'errors.passwordTooShort' })
	.max(PASSWORD_MAX, { error: 'errors.passwordTooLong' })

export const signUpSchema = z.object({
	name: z.string().trim().min(1, { error: 'errors.nameRequired' }),
	email,
	password: newPassword,
})

export const signInSchema = z.object({
	email,
	password: z.string().min(1, { error: 'errors.passwordRequired' }),
})

export const forgotPasswordSchema = z.object({ email })

export const resetPasswordSchema = z.object({ password: newPassword })
