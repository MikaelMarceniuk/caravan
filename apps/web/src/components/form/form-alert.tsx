import { Alert, AlertDescription } from '@/components/ui/alert'

/** A message about the whole form, announced when it appears. */
export function FormAlert({ message }: { message?: string }) {
	if (!message) return null
	return (
		<Alert variant="destructive">
			<AlertDescription>{message}</AlertDescription>
		</Alert>
	)
}
