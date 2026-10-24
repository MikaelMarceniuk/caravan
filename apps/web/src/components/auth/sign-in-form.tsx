'use client'

import { useMutation } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { type FormEvent, useState } from 'react'
import { FormAlert } from '@/components/form/form-alert'
import { PasswordField } from '@/components/form/password-field'
import { TextField } from '@/components/form/text-field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
import { storeLocale } from '@/i18n/locale-cookie'
import { errorCode } from '@/lib/api'
import { signIn } from '@/lib/auth'
import { requestErrorMessage } from '@/lib/request-error'
import { isEmail } from '@/lib/validation'
import { GoogleSignIn } from './not-implemented'

/**
 * `email` comes from the link that led here (/sign-in?email=...);
 * `passwordChanged`, from the password reset (/sign-in?reset=done).
 */
export function SignInForm({
	email,
	passwordChanged = false,
}: {
	email?: string
	passwordChanged?: boolean
}) {
	const t = useTranslations()
	const router = useRouter()
	const [formError, setFormError] = useState<string>()
	const [errors, setErrors] = useState<{ email?: string; password?: string }>(
		{},
	)
	const mutation = useMutation({
		mutationFn: signIn,
		onSuccess(traveler) {
			storeLocale(traveler.locale)
			router.push('/session')
		},
		onError(error) {
			const code = errorCode(error)
			setFormError(
				code === 'INVALID_EMAIL_OR_PASSWORD'
					? t('errors.wrongCredentials')
					: code === 'EMAIL_NOT_VERIFIED'
						? t('errors.emailNotVerified')
						: requestErrorMessage(error, t),
			)
		},
	})

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		const form = new FormData(event.currentTarget)
		const fields = {
			email: String(form.get('email')),
			password: String(form.get('password')),
		}
		const found = {
			email: isEmail(fields.email) ? undefined : t('errors.emailInvalid'),
			password: fields.password ? undefined : t('errors.passwordRequired'),
		}
		setErrors(found)
		setFormError(undefined)
		if (found.email || found.password) return
		mutation.mutate(fields)
	}

	return (
		<div className="flex flex-col gap-8">
			<header className="flex flex-col gap-2">
				<h1 className="font-heading text-5xl font-bold tracking-tight">
					{t('signIn.title')}
				</h1>
				<p className="text-muted-foreground">{t('signIn.subtitle')}</p>
			</header>
			{passwordChanged && (
				<Alert role="status">
					<AlertDescription>{t('signIn.passwordChanged')}</AlertDescription>
				</Alert>
			)}
			<form onSubmit={submit} noValidate>
				<FieldGroup>
					<GoogleSignIn />
					<FormAlert message={formError} />
					<TextField
						id="email"
						label={t('fields.email')}
						type="email"
						autoComplete="email"
						defaultValue={email}
						error={errors.email}
					/>
					<PasswordField
						id="password"
						label={t('fields.password')}
						autoComplete="current-password"
						error={errors.password}
					/>
					<Link
						href="/forgot-password"
						className="-mt-3 self-end rounded-sm text-sm font-medium text-link underline-offset-4 hover:underline"
					>
						{t('signIn.forgotPassword')}
					</Link>
					<Button type="submit" size="lg" disabled={mutation.isPending}>
						{t('signIn.submit')}
					</Button>
				</FieldGroup>
			</form>
			<p className="text-sm text-muted-foreground">
				{t('signIn.newHere')}{' '}
				<Link
					href="/sign-up"
					className="rounded-sm font-semibold text-link underline-offset-4 hover:underline"
				>
					{t('signIn.createAccount')}
				</Link>
			</p>
		</div>
	)
}
