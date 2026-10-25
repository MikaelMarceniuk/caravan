'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'
import { Form, SubmitButton } from '@/components/form/form'
import {
	FormPasswordField,
	FormRootAlert,
	FormTextField,
} from '@/components/form/form-fields'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FieldGroup } from '@/components/ui/field'
import { storeLocale } from '@/i18n/locale-cookie'
import { errorCode } from '@/lib/api'
import { useSignIn } from '@/lib/auth'
import { requestErrorKey } from '@/lib/request-error'
import { signInSchema } from '@/lib/schemas/auth'
import { GoogleSignIn } from './not-implemented'

type Values = z.infer<typeof signInSchema>

/** What to say when sign-in fails, as a next-intl key. */
function signInErrorKey(error: unknown) {
	switch (errorCode(error)) {
		case 'INVALID_EMAIL_OR_PASSWORD':
			return 'errors.wrongCredentials'
		case 'EMAIL_NOT_VERIFIED':
			return 'errors.emailNotVerified'
		default:
			return requestErrorKey(error)
	}
}

/**
 * `email` comes from the link that led here (/sign-in?email=...);
 * `passwordChanged`, from the password reset (/sign-in?reset=done).
 */
export function SignInForm({
	email = '',
	passwordChanged = false,
}: {
	email?: string
	passwordChanged?: boolean
}) {
	const t = useTranslations()
	const router = useRouter()
	const signIn = useSignIn()
	const form = useForm<Values>({
		resolver: zodResolver(signInSchema),
		defaultValues: { email, password: '' },
	})

	function submit(values: Values) {
		signIn.mutate(values, {
			onSuccess(traveler) {
				storeLocale(traveler.locale)
				router.push('/session')
			},
			onError: (error) =>
				form.setError('root', { message: signInErrorKey(error) }),
		})
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
			{/* Still pending after success: the page is on its way to /session. */}
			<Form
				form={form}
				onSubmit={submit}
				pending={signIn.isPending || signIn.isSuccess}
			>
				<FieldGroup>
					<GoogleSignIn />
					<FormRootAlert />
					<FormTextField
						name="email"
						label={t('fields.email')}
						type="email"
						autoComplete="email"
					/>
					<FormPasswordField
						name="password"
						label={t('fields.password')}
						autoComplete="current-password"
					/>
					<Link
						href="/forgot-password"
						className="-mt-3 self-end rounded-sm text-sm font-medium text-link underline-offset-4 hover:underline"
					>
						{t('signIn.forgotPassword')}
					</Link>
					<SubmitButton>{t('signIn.submit')}</SubmitButton>
				</FieldGroup>
			</Form>
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
