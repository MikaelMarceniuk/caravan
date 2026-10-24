'use client'

import { useMutation } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { type FormEvent, useState } from 'react'
import { FormAlert } from '@/components/form/form-alert'
import { PasswordField } from '@/components/form/password-field'
import { TextField } from '@/components/form/text-field'
import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
import type { Locale } from '@/i18n/locale'
import { errorCode } from '@/lib/api'
import { PASSWORD_MIN, signUp } from '@/lib/auth'
import { requestErrorMessage } from '@/lib/request-error'
import { isEmail, passwordLengthError } from '@/lib/validation'
import { GoogleSignIn, NotImplementedLink } from './not-implemented'
import { PasswordLength } from './password-length'

type Fields = { name: string; email: string; password: string }
type Errors = Partial<Record<keyof Fields, string>>

export function SignUpForm() {
	const t = useTranslations()
	const locale = useLocale() as Locale
	const [email, setEmail] = useState('')
	const [errors, setErrors] = useState<Errors>({})
	const [formError, setFormError] = useState<string>()
	const [password, setPassword] = useState('')
	const router = useRouter()
	const mutation = useMutation({
		mutationFn: signUp,
		onError(error, { email }) {
			const code = errorCode(error)
			if (
				code === 'USER_ALREADY_EXISTS' ||
				code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL'
			)
				return router.push(`/sign-in?${new URLSearchParams({ email })}`)
			setFormError(requestErrorMessage(error, t))
		},
	})

	function validate({ name, email, password }: Fields): Errors {
		const found: Errors = {}
		if (!name.trim()) found.name = t('errors.nameRequired')
		if (!isEmail(email)) found.email = t('errors.emailInvalid')
		found.password = passwordLengthError(password, t)
		return found
	}

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		const form = new FormData(event.currentTarget)
		const fields = {
			name: String(form.get('name')),
			email: String(form.get('email')),
			password: String(form.get('password')),
		}
		const found = validate(fields)
		setErrors(found)
		setFormError(undefined)
		if (Object.values(found).some(Boolean)) return
		setEmail(fields.email)
		mutation.mutate({ ...fields, locale })
	}

	if (mutation.isSuccess) return <CheckYourEmail email={email} />

	return (
		<div className="flex flex-col gap-8">
			<header className="flex flex-col gap-2">
				<h1 className="font-heading text-5xl font-bold tracking-tight">
					{t('signUp.title')}
				</h1>
				<p className="text-muted-foreground">{t('signUp.subtitle')}</p>
			</header>
			<form onSubmit={submit} noValidate>
				<FieldGroup>
					<GoogleSignIn />
					<FormAlert message={formError} />
					<TextField
						id="name"
						label={t('fields.name')}
						autoComplete="name"
						error={errors.name}
					/>
					<TextField
						id="email"
						label={t('fields.email')}
						type="email"
						autoComplete="email"
						error={errors.email}
					/>
					<PasswordField
						id="password"
						label={t('fields.password')}
						autoComplete="new-password"
						error={errors.password}
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
						{t('signUp.submit')}
					</Button>
				</FieldGroup>
			</form>
			<p className="text-xs text-subtle">
				{t('signUp.termsBefore')}{' '}
				<NotImplementedLink>{t('signUp.terms')}</NotImplementedLink>{' '}
				{t('signUp.and')}{' '}
				<NotImplementedLink>{t('signUp.privacy')}</NotImplementedLink>.
			</p>
			<p className="text-sm text-muted-foreground">
				{t('signUp.haveAccount')}{' '}
				<Link
					href="/sign-in"
					className="rounded-sm font-semibold text-link underline-offset-4 hover:underline"
				>
					{t('signUp.signIn')}
				</Link>
			</p>
		</div>
	)
}

function CheckYourEmail({ email }: { email: string }) {
	const t = useTranslations('signUp')
	return (
		<div className="flex flex-col gap-4">
			<h1 className="font-heading text-4xl font-bold tracking-tight">
				{t('checkEmailTitle')}
			</h1>
			<p className="text-muted-foreground">{t('checkEmail', { email })}</p>
			<Link
				href="/sign-in"
				className="self-start rounded-sm text-link underline-offset-4 hover:underline"
			>
				{t('backToSignIn')}
			</Link>
		</div>
	)
}
