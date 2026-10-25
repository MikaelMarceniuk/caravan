import { CheckIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

const BARS = [1, 2, 3, 4]

/**
 * The bars under the password (SignUp.png). They only measure the way to the minimum length:
 * there are no strength rules besides it (plan B9).
 */
export function PasswordLength({
	id,
	length,
	minimum,
}: {
	id: string
	length: number
	minimum: number
}) {
	const t = useTranslations('fields')
	const filled = Math.min(length, minimum)
	const enough = length >= minimum
	return (
		<div className="flex items-center gap-3">
			{/* biome-ignore lint/a11y/useSemanticElements: the design draws four bars, which a native <meter> can't. */}
			<div
				role="meter"
				aria-label={t('passwordHint', { minimum })}
				aria-valuemin={0}
				aria-valuemax={minimum}
				aria-valuenow={filled}
				aria-valuetext={t('passwordStrength', { length: filled, minimum })}
				className="grid flex-1 grid-cols-4 gap-1.5"
			>
				{BARS.map((bar) => (
					<span
						key={bar}
						className={cn(
							'h-1 rounded-full bg-border transition-colors',
							filled >= (bar * minimum) / BARS.length && 'bg-success',
						)}
					/>
				))}
			</div>
			<p
				id={id}
				className={cn(
					'flex items-center gap-1 text-xs text-muted-foreground',
					enough && 'text-success',
				)}
			>
				{enough && <CheckIcon aria-hidden="true" className="size-3.5" />}
				{t('passwordHint', { minimum })}
			</p>
		</div>
	)
}
