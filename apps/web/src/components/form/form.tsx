'use client'

import {
	type ComponentProps,
	createContext,
	type ReactNode,
	useContext,
} from 'react'
import {
	type FieldValues,
	FormProvider,
	type SubmitHandler,
	type UseFormReturn,
} from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

const Pending = createContext(false)

/**
 * Whether the form around is sending. Every control of ours turns itself off with it: the fieldset does the same
 * in browsers, but not in happy-dom, where the component tests run.
 */
export function useFormPending() {
	return useContext(Pending)
}

type FormProps<Values extends FieldValues> = {
	form: UseFormReturn<Values>
	onSubmit: SubmitHandler<Values>
	/** While true, every field and button is off and the submit button shows it is busy. */
	pending: boolean
	className?: string
	children: ReactNode
}

/**
 * Every form of the app (development.md §2, Web): react-hook-form + zod, and a fieldset that turns
 * every control off while the request is on its way.
 */
export function Form<Values extends FieldValues>({
	form,
	onSubmit,
	pending,
	className,
	children,
}: FormProps<Values>) {
	return (
		<FormProvider {...form}>
			<Pending.Provider value={pending}>
				<form
					onSubmit={form.handleSubmit(onSubmit)}
					noValidate
					className={className}
				>
					<fieldset disabled={pending} className="contents">
						{children}
					</fieldset>
				</form>
			</Pending.Provider>
		</FormProvider>
	)
}

/** The form's submit button: a spinner and `aria-busy` while the form is pending. */
export function SubmitButton({
	children,
	...props
}: ComponentProps<typeof Button>) {
	const pending = useFormPending()
	return (
		<Button
			type="submit"
			size="lg"
			disabled={pending}
			aria-busy={pending || undefined}
			{...props}
		>
			{pending && (
				<Spinner
					data-icon="inline-start"
					role="presentation"
					aria-hidden="true"
				/>
			)}
			{children}
		</Button>
	)
}
