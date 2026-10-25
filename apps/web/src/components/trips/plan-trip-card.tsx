import { PlusIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useId } from 'react'

/** The dashed card at the end of the upcoming trips that starts a new one. */
export function PlanTripCard() {
	const t = useTranslations('trips')
	const titleId = useId()
	const hintId = useId()
	return (
		<button
			type="button"
			aria-labelledby={titleId}
			aria-describedby={hintId}
			className="flex min-h-44 w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-6 text-center transition-colors hover:bg-card focus-visible:outline-2 focus-visible:outline-ring"
		>
			<span className="flex size-12 items-center justify-center rounded-lg border bg-card">
				<PlusIcon aria-hidden="true" />
			</span>
			<span id={titleId} className="font-heading text-xl font-bold">
				{t('planTrip')}
			</span>
			<span id={hintId} className="text-sm text-muted-foreground">
				{t('planTripHint')}
			</span>
		</button>
	)
}
