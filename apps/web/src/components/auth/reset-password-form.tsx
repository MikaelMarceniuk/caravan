'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import type { z } from 'zod'
import { Form, SubmitButton } from '@/components/form/form'
import { FormPasswordField, FormRootAlert } from '@/components/form/form-fields'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FieldGroup } from '@/components/ui/field'
import { errorCode } from '@/lib/api'
import { PASSWORD_MIN, useResetPassword } from '@/lib/auth'
import { requestErrorKey } from '@/lib/request-error'
import { resetPasswordSchema } from '@/lib/schemas/auth'
import { PasswordLength } from './password-length'

type Values = z.infer<typeof resetPasswordSchema>

/**
 * `token` comes from the emailed link (/reset-password?token=...).
 * Without one (the API sent ?error=INVALID_TOKEN), the link is invalid.
 */
export function ResetPasswordForm({ token }: { token?: string }) {
	const t = useTranslations()
	const router = useRouter()
	const [invalidLink, setInvalidLink] = useState(!token)
	const reset = useResetPassword()
	const form = useForm<Values>({
		resolver: zodResolver(resetPasswordSchema),
		defaultValues: { password: '' },
	})
	const password = useWatch({ control: form.control, name: 'password' })

	function submit({ password: newPassword }: Values) {
		if (!token) return
		reset.mutate(
			{ token, newPassword },
			{
				onSuccess: () => router.push('/sign-in?reset=done'),
				onError(error) {
					if (errorCode(error) === 'INVALID_TOKEN') setInvalidLink(true)
					else form.setError('root', { message: requestErrorKey(error) })
				},
			},
		)
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
				// Still pending after success: the page is on its way to /sign-in.
				<Form
					form={form}
					onSubmit={submit}
					pending={reset.isPending || reset.isSuccess}
				>
					<FieldGroup>
						<FormRootAlert />
						<FormPasswordField
							name="password"
							label={t('fields.newPassword')}
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
						<SubmitButton>{t('resetPassword.submit')}</SubmitButton>
					</FieldGroup>
				</Form>
			)}
		</div>
	)
}
