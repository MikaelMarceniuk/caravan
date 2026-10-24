import Link from 'next/link'

/** The orange mark from the design: a route of three stops. */
export function Logo() {
	return (
		<Link
			href="/"
			className="inline-flex items-center gap-3 self-start rounded-md font-heading text-2xl font-bold tracking-tight"
		>
			<svg
				viewBox="0 0 32 32"
				className="size-8"
				aria-hidden="true"
				focusable="false"
			>
				<rect width="32" height="32" rx="8" className="fill-brand" />
				<path
					d="M9 22c3-1 4-5 7-6s5 1 7-3"
					className="fill-none stroke-background"
					strokeWidth="2"
					strokeLinecap="round"
					strokeDasharray="1 3.2"
				/>
				<circle cx="9" cy="22" r="2.2" className="fill-background" />
				<circle cx="16" cy="16" r="2.2" className="fill-background" />
				<circle cx="23" cy="13" r="2.2" className="fill-background" />
			</svg>
			Caravan
		</Link>
	)
}
