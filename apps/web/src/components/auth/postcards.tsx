import { cn } from '@/lib/utils'

type PostcardProps = {
	city: string
	country: string
	dates?: string
	className: string
}

// The design's illustration (docs/design/SignIn.png). Decoration only: hidden from screen readers by the layout.
function Postcard({ city, country, dates, className }: PostcardProps) {
	return (
		<div
			className={cn(
				'absolute flex h-[270px] w-[400px] flex-col rounded-sm p-6 text-primary-foreground shadow-2xl shadow-black/40',
				className,
			)}
		>
			<div className="flex items-start justify-between">
				<span className="font-mono text-xs font-bold tracking-[0.25em] uppercase">
					Greetings from
				</span>
				<span className="grid size-14 place-items-center rounded-sm border-2 border-current/40 border-dashed font-mono text-[10px] font-bold">
					{country}
				</span>
			</div>
			<p className="mt-auto font-heading text-7xl leading-none font-extrabold tracking-tight">
				{city}
			</p>
			<div className="mt-5 flex justify-between font-mono text-xs font-bold tracking-widest uppercase">
				<span>{dates}</span>
				<span>Caravan</span>
			</div>
		</div>
	)
}

function Cursor({ name, className }: { name: string; className: string }) {
	return (
		<div className={cn('absolute flex items-start', className)}>
			<svg
				viewBox="0 0 16 16"
				className="size-4 fill-current"
				aria-hidden="true"
				focusable="false"
			>
				<path d="M1 1l5 14 2-6 6-2z" />
			</svg>
			<span className="mt-3 rounded-sm bg-current px-1.5 py-0.5 text-xs font-semibold">
				<span className="text-primary-foreground">{name}</span>
			</span>
		</div>
	)
}

export function Postcards() {
	return (
		<div className="relative h-[680px] w-[540px]">
			<Postcard
				city="Kyoto"
				country="JP"
				dates="Oct 31 –"
				className="top-0 left-6 -rotate-6 bg-pink"
			/>
			<Postcard
				city="Lisbon"
				country="PT"
				className="top-48 left-36 rotate-3 bg-orange"
			/>
			<Postcard
				city="Lençóis"
				country="BR"
				dates="Mar 2 – 6"
				className="top-96 left-0 -rotate-2 bg-teal"
			/>
			<Cursor name="Ana" className="top-44 left-[440px] text-blue" />
			<Cursor name="Leo" className="top-[650px] left-28 text-magenta" />
		</div>
	)
}
