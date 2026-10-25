import { redirect } from 'next/navigation'
import { AuthLayout } from '@/components/auth/auth-layout'
import { VerifyEmailFailed } from '@/components/auth/verify-email-failed'
import type { SearchParams } from '@/lib/search-params'

// The emailed link confirms the account on the API, which signs the traveler in and lands here
// (?error=INVALID_TOKEN when the link is invalid or expired).
export default async function VerifyEmailPage({
	searchParams,
}: {
	searchParams: Promise<SearchParams>
}) {
	if (!(await searchParams).error) redirect('/trips')
	return (
		<AuthLayout>
			<VerifyEmailFailed />
		</AuthLayout>
	)
}
