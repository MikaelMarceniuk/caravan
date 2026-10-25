import type { ComponentProps, ReactNode } from 'react'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

type TextFieldProps = ComponentProps<typeof Input> & {
	id: string
	label: string
	/** Announced and tied to the input (development.md §1, Forms). */
	error?: string
	/** Extra text under the input, already rendered with the id in `hintId`. */
	hint?: ReactNode
	hintId?: string
}

/** A labeled input whose error and hint a screen reader reads with it. */
export function TextField({
	id,
	label,
	error,
	hint,
	hintId,
	...input
}: TextFieldProps) {
	const errorId = `${id}-error`
	const describedBy = [error ? errorId : undefined, hintId]
		.filter(Boolean)
		.join(' ')
	return (
		<Field data-invalid={error ? true : undefined}>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			<Input
				id={id}
				name={id}
				aria-invalid={error ? true : undefined}
				aria-describedby={describedBy || undefined}
				{...input}
			/>
			{hint}
			{error && <FieldError id={errorId}>{error}</FieldError>}
		</Field>
	)
}
