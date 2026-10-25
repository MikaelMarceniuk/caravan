export type EmailMessage = {
	to: string
	subject: string
	html: string
	text: string
}

/** The port to the email provider: Resend in production, a fake in tests. */
export type Mailer = {
	send(message: EmailMessage): Promise<void>
}

const RESEND_API = 'https://api.resend.com'

export function createResendMailer({
	apiKey,
	from,
	baseUrl = RESEND_API,
}: {
	apiKey: string
	from: string
	baseUrl?: string
}): Mailer {
	return {
		async send(message) {
			const response = await fetch(`${baseUrl}/emails`, {
				method: 'POST',
				headers: {
					authorization: `Bearer ${apiKey}`,
					'content-type': 'application/json',
				},
				body: JSON.stringify({ from, ...message }),
			})
			// Only the status: Resend's body may echo the recipient.
			if (!response.ok)
				throw new Error(`Resend refused the email: ${response.status}`)
		},
	}
}
