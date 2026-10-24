'use client'

import { EyeIcon, EyeOffIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { type ComponentProps, type ReactNode, useState } from 'react'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from '@/components/ui/input-group'

type PasswordFieldProps = ComponentProps<typeof InputGroupInput> & {
	id: string
	label: string
	error?: string
	hint?: ReactNode
	hintId?: string
}

/** A password input with a button to show what was typed (SignUp.png). */
export function PasswordField({
	id,
	label,
	error,
	hint,
	hintId,
	...input
}: PasswordFieldProps) {
	const t = useTranslations('fields')
	const [visible, setVisible] = useState(false)
	const errorId = `${id}-error`
	const describedBy = [error ? errorId : undefined, hintId]
		.filter(Boolean)
		.join(' ')
	return (
		<Field data-invalid={error ? true : undefined}>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			<InputGroup>
				<InputGroupInput
					id={id}
					name={id}
					type={visible ? 'text' : 'password'}
					aria-invalid={error ? true : undefined}
					aria-describedby={describedBy || undefined}
					{...input}
				/>
				<InputGroupAddon align="inline-end">
					<InputGroupButton
						size="icon-sm"
						aria-label={visible ? t('hidePassword') : t('showPassword')}
						onClick={() => setVisible((shown) => !shown)}
					>
						{visible ? <EyeOffIcon /> : <EyeIcon />}
					</InputGroupButton>
				</InputGroupAddon>
			</InputGroup>
			{hint}
			{error && <FieldError id={errorId}>{error}</FieldError>}
		</Field>
	)
}
