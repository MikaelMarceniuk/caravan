'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'
import { Form, SubmitButton } from '@/components/form/form'
import { FormRootAlert, FormTextField } from '@/components/form/form-fields'
import { FieldGroup } from '@/components/ui/field'
import { useRequestPasswordReset } from '@/lib/auth'
import { requestErrorKey } from '@/lib/request-error'
import { forgotPasswordSchema } from '@/lib/schemas/auth'

type Values = z.infer<typeof forgotPasswordSchema>

export function ForgotPasswordForm() {
	const t = useTranslations()
	const request = useRequestPasswordReset()
	const form = useForm<Values>({
		resolver: zodResolver(forgotPasswordSchema),
		defaultValues: { email: '' },
	})

	function submit({ email }: Values) {
		request.mutate(email, {
			onError: (error) =>
				form.setError('root', { message: requestErrorKey(error) }),
		})
	}

	// The same answer whether or not the email has an account (the API's doesn't tell either).
	if (request.isSuccess)
		return (
			<div className="flex flex-col gap-4">
				<h1 className="font-heading text-4xl font-bold tracking-tight">
					{t('forgotPassword.sentTitle')}
				</h1>
				<p className="text-muted-foreground">
					{t('forgotPassword.sent', { email: request.variables })}
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
			<Form form={form} onSubmit={submit} pending={request.isPending}>
				<FieldGroup>
					<FormRootAlert />
					<FormTextField
						name="email"
						label={t('fields.email')}
						type="email"
						autoComplete="email"
					/>
					<SubmitButton>{t('forgotPassword.submit')}</SubmitButton>
				</FieldGroup>
			</Form>
			<Link
				href="/sign-in"
				className="self-start rounded-sm text-sm text-link underline-offset-4 hover:underline"
			>
				{t('forgotPassword.backToSignIn')}
			</Link>
		</div>
	)
}
