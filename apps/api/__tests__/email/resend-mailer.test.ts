import { afterEach, describe, expect, test } from 'bun:test'
import type { Server } from 'bun'
import { createResendMailer } from '../../src/email/mailer'

const MESSAGE = {
	to: 'ana@example.com',
	subject: 'Confirm your email for Caravan',
	html: '<p>Hi</p>',
	text: 'Hi',
}

/** A local stand-in for Resend's API: it records each request and answers with `reply`. */
function fakeResend(reply: () => Response) {
	const requests: unknown[] = []
	const server = Bun.serve({
		port: 0,
		async fetch(request) {
			requests.push({
				method: request.method,
				path: new URL(request.url).pathname,
				authorization: request.headers.get('authorization'),
				body: await request.json(),
			})
			return reply()
		},
	})
	return { server, requests }
}

describe('the Resend mailer', () => {
	let server: Server<undefined> | undefined
	afterEach(() => server?.stop(true))

	test('sends the message to Resend with the API key', async () => {
		const resend = fakeResend(() => Response.json({ id: 'email-1' }))
		server = resend.server
		const mailer = createResendMailer({
			apiKey: 're_test_key',
			from: 'Caravan <onboarding@resend.dev>',
			baseUrl: resend.server.url.origin,
		})

		await mailer.send(MESSAGE)

		expect(resend.requests).toEqual([
			{
				method: 'POST',
				path: '/emails',
				authorization: 'Bearer re_test_key',
				body: { from: 'Caravan <onboarding@resend.dev>', ...MESSAGE },
			},
		])
	})

	test('fails when Resend refuses the message', async () => {
		const resend = fakeResend(() =>
			Response.json(
				{ name: 'validation_error', message: 'Invalid `to` field.' },
				{ status: 422 },
			),
		)
		server = resend.server
		const mailer = createResendMailer({
			apiKey: 're_test_key',
			from: 'Caravan <onboarding@resend.dev>',
			baseUrl: resend.server.url.origin,
		})

		await expect(mailer.send(MESSAGE)).rejects.toThrow(
			'Resend refused the email: 422',
		)
	})
})
