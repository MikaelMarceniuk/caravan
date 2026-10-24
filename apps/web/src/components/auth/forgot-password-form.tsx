'use client'

import { useMutation } from '@tanstack/react-query'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { type FormEvent, useState } from 'react'
import { FormAlert } from '@/components/form/form-alert'
import { TextField } from '@/components/form/text-field'
import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
import { requestPasswordReset } from '@/lib/auth'
import { requestErrorMessage } from '@/lib/request-error'
import { isEmail } from '@/lib/validation'

export function ForgotPasswordForm() {
	const t = useTranslations()
	const [error, setError] = useState<string>()
	const [formError, setFormError] = useState<string>()
	const mutation = useMutation({
		mutationFn: requestPasswordReset,
		onError: (failure) => setFormError(requestErrorMessage(failure, t)),
	})

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		const email = String(new FormData(event.currentTarget).get('email'))
		const invalid = isEmail(email) ? undefined : t('errors.emailInvalid')
		setError(invalid)
		setFormError(undefined)
		if (!invalid) mutation.mutate(email)
	}

	if (mutation.isSuccess)
		return (
			<div className="flex flex-col gap-4">
				<h1 className="font-heading text-4xl font-bold tracking-tight">
					{t('forgotPassword.sentTitle')}
				</h1>
				<p className="text-muted-foreground">
					{t('forgotPassword.sent', { email: mutation.variables })}
				</p>
				<Link
					href="/sign-in"
					className="self-start rounded-sm text-link underline-offset-4 hover:underline"
				>
					{t('forgotPassword.backToSignIn')}
				</Link>
			</div>
		)

	return (
		<div className="flex flex-col gap-8">
			<header className="flex flex-col gap-2">
				<h1 className="font-heading text-4xl font-bold tracking-tight">
					{t('forgotPassword.title')}
				</h1>
				<p className="text-muted-foreground">{t('forgotPassword.subtitle')}</p>
			</header>
			<form onSubmit={submit} noValidate>
				<FieldGroup>
					<FormAlert message={formError} />
					<TextField
						id="email"
						label={t('fields.email')}
						type="email"
						autoComplete="email"
						error={error}
					/>
					<Button type="submit" size="lg" disabled={mutation.isPending}>
						{t('forgotPassword.submit')}
					</Button>
				</FieldGroup>
			</form>
			<Link
				href="/sign-in"
				className="self-start rounded-sm text-sm text-link underline-offset-4 hover:underline"
			>
				{t('forgotPassword.backToSignIn')}
			</Link>
		</div>
	)
}
