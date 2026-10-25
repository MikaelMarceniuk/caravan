'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'
import { Form, SubmitButton, useFormPending } from '@/components/form/form'
import { FormTextField } from '@/components/form/form-fields'
import { Button } from '@/components/ui/button'
import { DialogClose } from '@/components/ui/dialog'
import { FieldGroup } from '@/components/ui/field'
import { newTripSchema } from '@/lib/schemas/trip'

type Values = z.infer<typeof newTripSchema>

/** The new trip dialog's form: only the name in M1 (dates come from the stops, D44; invites in M4). */
export function NewTripForm() {
	const t = useTranslations('newTrip')
	const form = useForm<Values>({
		resolver: zodResolver(newTripSchema),
		defaultValues: { name: '' },
	})
	return (
		<Form form={form} onSubmit={() => {}} pending={false}>
			<FieldGroup>
				<FormTextField name="name" label={t('name')} autoComplete="off" />
				<div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:items-center">
					<p className="text-sm text-muted-foreground sm:mr-auto">
						{t('owner')}
					</p>
					<CancelButton>{t('cancel')}</CancelButton>
					<SubmitButton>{t('submit')}</SubmitButton>
				</div>
			</FieldGroup>
		</Form>
	)
}

function CancelButton({ children }: { children: string }) {
	const pending = useFormPending()
	return (
		<DialogClose asChild>
			<Button type="button" variant="outline" size="lg" disabled={pending}>
				{children}
			</Button>
		</DialogClose>
	)
}
