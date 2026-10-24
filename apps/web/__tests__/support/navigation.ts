let visited: string[] = []

const router = {
	push: (path: string) => {
		visited.push(path)
	},
	replace: (path: string) => {
		visited.push(path)
	},
	refresh: () => {},
	back: () => {},
	forward: () => {},
	prefetch: () => {},
}

/** Stands in for `next/navigation` in the component tests (see setup.ts). */
export const navigation = {
	useRouter: () => router,
	usePathname: () => '/',
	useSearchParams: () => new URLSearchParams(),
	redirect: (path: string) => {
		visited.push(path)
	},
	/** Where the page sent the traveler, in order. */
	visited: () => visited,
	reset: () => {
		visited = []
	},
}
