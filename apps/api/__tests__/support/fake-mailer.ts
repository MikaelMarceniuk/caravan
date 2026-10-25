import type { EmailMessage, Mailer } from '../../src/email/mailer'

/** Keeps every email "sent", so a test can read it and follow its link like a traveler would. */
export function createFakeMailer() {
	const sent: EmailMessage[] = []
	return {
		sent,
		async send(message: EmailMessage) {
			sent.push(message)
		},
	} satisfies Mailer & { sent: EmailMessage[] }
}

export type FakeMailer = ReturnType<typeof createFakeMailer>

/** The link in an email's plain text. */
export function linkIn(message: EmailMessage | undefined) {
	const link = message?.text.match(/https?:\/\/\S+/)?.[0]
	if (!link) throw new Error('The email has no link.')
	return link
}
