'use client'

import { useTranslations } from 'next-intl'
import type { ComponentProps } from 'react'
import { get, useFormContext, useFormState } from 'react-hook-form'
import { PASSWORD_MAX, PASSWORD_MIN } from '@/lib/auth/requests'
import { useFormPending } from './form'
import { FormAlert } from './form-alert'
import { PasswordField } from './password-field'
import { TextField } from './text-field'

/** Translates a form error: the zod schemas and setError carry next-intl keys (src/lib/schemas). */
function useErrorText() {
	const t = useTranslations()
	return (key: unknown) =>
		typeof key === 'string' && key
			? t(key, { minimum: PASSWORD_MIN, maximum: PASSWORD_MAX })
			: undefined
}

/** The error of one field of the form around, translated. */
function useFieldError(name: string) {
	const errorText = useErrorText()
	const { errors } = useFormState({ name })
	const error: { message?: unknown } | undefined = get(errors, name)
	return errorText(error?.message)
}

type ConnectedProps<Field> = Omit<Field, 'id' | 'error' | 'name'> & {
	name: string
}

/** A TextField registered in the form around: its error, and off while the form sends. */
export function FormTextField({
	name,
	...props
}: ConnectedProps<ComponentProps<typeof TextField>>) {
	const { register } = useFormContext()
	return (
		<TextField
			id={name}
			error={useFieldError(name)}
			disabled={useFormPending()}
			{...register(name)}
			{...props}
		/>
	)
}

/** A PasswordField registered in the form around: its error, and off while the form sends. */
export function FormPasswordField({
	name,
	...props
}: ConnectedProps<ComponentProps<typeof PasswordField>>) {
	const { register } = useFormContext()
	return (
		<PasswordField
			id={name}
			error={useFieldError(name)}
			disabled={useFormPending()}
			{...register(name)}
			{...props}
		/>
	)
}

/** The error about the whole form (`setError('root', ...)`), announced. */
export function FormRootAlert() {
	const errorText = useErrorText()
	const { errors } = useFormState()
	return <FormAlert message={errorText(errors.root?.message)} />
}
