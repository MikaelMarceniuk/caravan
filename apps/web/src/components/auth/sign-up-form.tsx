'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useForm, useWatch } from 'react-hook-form'
import type { z } from 'zod'
import { Form, SubmitButton } from '@/components/form/form'
import {
	FormPasswordField,
	FormRootAlert,
	FormTextField,
} from '@/components/form/form-fields'
import { FieldGroup } from '@/components/ui/field'
import type { Locale } from '@/i18n/locale'
import { errorCode } from '@/lib/api'
import { PASSWORD_MIN, useSignUp } from '@/lib/auth'
import { requestErrorKey } from '@/lib/request-error'
import { signUpSchema } from '@/lib/schemas/auth'
import { GoogleSignIn, NotImplementedLink } from './not-implemented'
import { PasswordLength } from './password-length'

type Values = z.infer<typeof signUpSchema>

export function SignUpForm() {
	const t = useTranslations()
	const locale = useLocale() as Locale
	const router = useRouter()
	const signUp = useSignUp()
	const form = useForm<Values>({
		resolver: zodResolver(signUpSchema),
		defaultValues: { name: '', email: '', password: '' },
	})
	const password = useWatch({ control: form.control, name: 'password' })

	function submit(values: Values) {
		signUp.mutate(
			{ ...values, locale },
			{
				onError(error) {
					const code = errorCode(error)
					// Plan A13: only reachable if the API ever tells a taken email apart.
					if (
						code === 'USER_ALREADY_EXISTS' ||
						code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL'
					)
						return router.push(
							`/sign-in?${new URLSearchParams({ email: values.email })}`,
						)
					form.setError('root', { message: requestErrorKey(error) })
				},
			},
		)
	}

	if (signUp.isSuccess) return <CheckYourEmail email={signUp.variables.email} />

	return (
		<div className="flex flex-col gap-8">
			<header className="flex flex-col gap-2">
				<h1 className="font-heading text-5xl font-bold tracking-tight">
					{t('signUp.title')}
				</h1>
				<p className="text-muted-foreground">{t('signUp.subtitle')}</p>
			</header>
			<Form form={form} onSubmit={submit} pending={signUp.isPending}>
				<FieldGroup>
					<GoogleSignIn />
					<FormRootAlert />
					<FormTextField
						name="name"
						label={t('fields.name')}
						autoComplete="name"
					/>
					<FormTextField
						name="email"
						label={t('fields.email')}
						type="email"
						autoComplete="email"
					/>
					<FormPasswordField
						name="password"
						label={t('fields.password')}
						autoComplete="new-password"
						hintId="password-hint"
						hint={
							<PasswordLength
								id="password-hint"
								length={password.length}
								minimum={PASSWORD_MIN}
							/>
						}
					/>
					<SubmitButton>{t('signUp.submit')}</SubmitButton>
				</FieldGroup>
			</Form>
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
