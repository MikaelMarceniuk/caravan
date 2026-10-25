export type Locale = 'pt-BR' | 'en-US'

type EmailInput = { locale: Locale; name: string; url: string }
type Copy = {
	subject: string
	greeting: (name: string) => string
	body: string
	action: string
	ignore: string
}

// Emails go out in the recipient's language (architecture.md D34, D35).
const MESSAGES = {
	'pt-BR': {
		verification: {
			subject: 'Confirme seu email no Caravan',
			greeting: (name) => `Olá, ${name}!`,
			body: 'Confirme seu email para começar a planejar viagens com o seu grupo.',
			action: 'Confirmar email',
			ignore: 'Se você não criou uma conta no Caravan, ignore este email.',
		},
		resetPassword: {
			subject: 'Redefina sua senha do Caravan',
			greeting: (name) => `Olá, ${name}!`,
			body: 'Recebemos um pedido para redefinir a sua senha. O link vale por 1 hora.',
			action: 'Definir nova senha',
			ignore:
				'Se você não pediu isso, ignore este email: a sua senha continua a mesma.',
		},
	},
	'en-US': {
		verification: {
			subject: 'Confirm your email for Caravan',
			greeting: (name) => `Hi, ${name}!`,
			body: 'Confirm your email to start planning trips with your group.',
			action: 'Confirm email',
			ignore:
				"If you didn't create a Caravan account, you can ignore this email.",
		},
		resetPassword: {
			subject: 'Reset your Caravan password',
			greeting: (name) => `Hi, ${name}!`,
			body: 'We got a request to reset your password. The link is valid for 1 hour.',
			action: 'Set a new password',
			ignore:
				"If you didn't ask for this, ignore this email: your password stays the same.",
		},
	},
} satisfies Record<Locale, Record<string, Copy>>

function escapeHtml(value: string) {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;')
}

function render(copy: Copy, { name, url }: EmailInput) {
	const greeting = copy.greeting(name)
	const html = `<!doctype html>
<html>
<body style="margin:0;padding:24px;background:#f5f2ec;font-family:Arial,Helvetica,sans-serif;color:#16161c">
<div style="max-width:480px;margin:0 auto;padding:32px;background:#ffffff;border-radius:12px">
<p style="margin:0 0 16px;font-size:18px;font-weight:bold">${escapeHtml(greeting)}</p>
<p style="margin:0 0 24px;font-size:16px;line-height:1.5">${escapeHtml(copy.body)}</p>
<p style="margin:0 0 24px"><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 20px;background:#16161c;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:bold">${escapeHtml(copy.action)}</a></p>
<p style="margin:0;font-size:13px;line-height:1.5;color:#55555f">${escapeHtml(copy.ignore)}</p>
</div>
</body>
</html>`
	const text = `${greeting}\n\n${copy.body}\n\n${copy.action}: ${url}\n\n${copy.ignore}\n`
	return { subject: copy.subject, html, text }
}

export function verificationEmail(input: EmailInput) {
	return render(MESSAGES[input.locale].verification, input)
}

export function resetPasswordEmail(input: EmailInput) {
	return render(MESSAGES[input.locale].resetPassword, input)
}
