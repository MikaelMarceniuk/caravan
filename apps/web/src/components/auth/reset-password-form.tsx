'use client'

import { useMutation } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { type FormEvent, useState } from 'react'
import { FormAlert } from '@/components/form/form-alert'
import { PasswordField } from '@/components/form/password-field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
import { errorCode } from '@/lib/api'
import { PASSWORD_MIN, resetPassword } from '@/lib/auth'
import { requestErrorMessage } from '@/lib/request-error'
import { passwordLengthError } from '@/lib/validation'
import { PasswordLength } from './password-length'

/**
 * `token` comes from the emailed link (/reset-password?token=...).
 * Without one (the API sent ?error=INVALID_TOKEN), the link is invalid.
 */
export function ResetPasswordForm({ token }: { token?: string }) {
	const t = useTranslations()
	const router = useRouter()
	const [password, setPassword] = useState('')
	const [error, setError] = useState<string>()
	const [formError, setFormError] = useState<string>()
	const [invalidLink, setInvalidLink] = useState(!token)
	const mutation = useMutation({
		mutationFn: resetPassword,
		onSuccess: () => router.push('/sign-in?reset=done'),
		onError(failure) {
			if (errorCode(failure) === 'INVALID_TOKEN') setInvalidLink(true)
			else setFormError(requestErrorMessage(failure, t))
		},
	})

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		const invalid = passwordLengthError(password, t)
		setError(invalid)
		setFormError(undefined)
		if (!invalid && token) mutation.mutate({ token, newPassword: password })
	}

	return (
		<div className="flex flex-col gap-8">
			<header className="flex flex-col gap-2">
				<h1 className="font-heading text-4xl font-bold tracking-tight">
					{t('resetPassword.title')}
				</h1>
				<p className="text-muted-foreground">{t('resetPassword.subtitle')}</p>
			</header>
			{invalidLink ? (
				<Alert variant="destructive">
					<AlertDescription>
						<p>{t('resetPassword.invalidLink')}</p>
						<Link
							href="/forgot-password"
							className="rounded-sm font-semibold text-link underline-offset-4 hover:underline"
						>
							{t('resetPassword.askAgain')}
						</Link>
					</AlertDescription>
				</Alert>
			) : (
				<form onSubmit={submit} noValidate>
					<FieldGroup>
						<FormAlert message={formError} />
						<PasswordField
							id="password"
							label={t('fields.newPassword')}
							autoComplete="new-password"
							error={error}
							value={password}
							onChange={(event) => setPassword(event.target.value)}
							hintId="password-hint"
							hint={
								<PasswordLength
									id="password-hint"
									length={password.length}
									minimum={PASSWORD_MIN}
								/>
							}
						/>
						<Button type="submit" size="lg" disabled={mutation.isPending}>
							{t('resetPassword.submit')}
						</Button>
					</FieldGroup>
				</form>
			)}
		</div>
	)
}
