import { describe, expect, test } from 'bun:test'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Form, SubmitButton, useFormPending } from '@/components/form/form'
import { api } from '@/lib/api'
import { isDisabled } from '../../support/a11y'
import { fakeApi, pendingReply } from '../../support/fake-api'
import { renderUi } from '../../support/render'

const schema = z.object({ email: z.string() })

/** A control that turns itself off while the form is pending, like the app's fields do. */
function EmailInput(props: ReturnType<ReturnType<typeof useForm>['register']>) {
	return <input id="email" disabled={useFormPending()} {...props} />
}

/** The smallest form built the way every form is. */
function SampleForm() {
	const mutation = useMutation({
		mutationFn: (values: z.infer<typeof schema>) => api.post('/sample', values),
	})
	const form = useForm({
		resolver: zodResolver(schema),
		defaultValues: { email: '' },
	})
	return (
		<Form
			form={form}
			pending={mutation.isPending}
			onSubmit={(values) => mutation.mutate(values)}
		>
			<label htmlFor="email">Email</label>
			<EmailInput {...form.register('email')} />
			<SubmitButton>Send</SubmitButton>
		</Form>
	)
}

describe('a form', () => {
	test('disables every field and shows the button as busy while sending', async () => {
		const reply = pendingReply()
		fakeApi({ 'POST /sample': reply.route })
		renderUi(<SampleForm />)

		await userEvent.setup().click(screen.getByRole('button', { name: 'Send' }))

		await waitFor(() =>
			expect(isDisabled(screen.getByLabelText('Email'))).toBe(true),
		)
		const button = screen.getByRole('button', { name: 'Send' })
		expect(button.getAttribute('aria-busy')).toBe('true')
		expect(isDisabled(button)).toBe(true)
		reply.send({ status: 200 })
	})

	test('turns the fields back on when the request fails', async () => {
		const reply = pendingReply()
		fakeApi({ 'POST /sample': reply.route })
		renderUi(<SampleForm />)
		await userEvent.setup().click(screen.getByRole('button', { name: 'Send' }))
		await waitFor(() =>
			expect(isDisabled(screen.getByLabelText('Email'))).toBe(true),
		)

		reply.send({ status: 500 })

		await waitFor(() =>
			expect(isDisabled(screen.getByLabelText('Email'))).toBe(false),
		)
		expect(
			screen.getByRole('button', { name: 'Send' }).hasAttribute('aria-busy'),
		).toBe(false)
	})
})
