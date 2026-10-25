import { AuthLayout } from '@/components/auth/auth-layout'
import { SignInForm } from '@/components/auth/sign-in-form'
import { firstParam, type SearchParams } from '@/lib/search-params'

export default async function SignInPage({
	searchParams,
}: {
	searchParams: Promise<SearchParams>
}) {
	const params = await searchParams
	return (
		<AuthLayout>
			<SignInForm
				email={firstParam(params.email)}
				passwordChanged={firstParam(params.reset) === 'done'}
			/>
		</AuthLayout>
	)
}
