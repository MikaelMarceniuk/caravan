import { AuthLayout } from '@/components/auth/auth-layout'
import { ResetPasswordForm } from '@/components/auth/reset-password-form'
import { firstParam, type SearchParams } from '@/lib/search-params'

// The emailed link lands here with ?token=..., or with ?error=INVALID_TOKEN (docs/features/auth-emails.md).
export default async function ResetPasswordPage({
	searchParams,
}: {
	searchParams: Promise<SearchParams>
}) {
	const params = await searchParams
	const token = params.error ? undefined : firstParam(params.token)
	return (
		<AuthLayout>
			<ResetPasswordForm token={token} />
		</AuthLayout>
	)
}
