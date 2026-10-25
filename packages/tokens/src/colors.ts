// Read from docs/design (SignIn.png, SignUp.png). Dark theme only in the MVP (architecture.md §18).
export const colors = {
	/** The form side of the auth screens, and the app's page. */
	background: '#13131a',
	/** The illustration side. */
	canvas: '#0f0f15',
	/** Inputs and cards. */
	surface: '#1b1b24',
	/** Dividers and decorative outlines. */
	border: '#30303d',
	/**
	 * The outline of an input. The design's #30303d reaches only 1.42:1 on the background,
	 * and WCAG 1.4.11 asks 3:1 of what shows where a field is.
	 */
	input: '#6b6980',
	foreground: '#f4f1ea',
	label: '#c9c5d3',
	muted: '#a7a3b3',
	subtle: '#8c889a',
	/** Links. */
	accent: '#ffd23f',
	brand: '#ff8a3d',
	success: '#3ddc84',
	danger: '#ff7b7b',
	primary: '#f4f1ea',
	primaryForeground: '#13131a',
	// Stop colors, from the postcards.
	pink: '#ff6b8b',
	orange: '#ff8a3d',
	teal: '#2ec4b6',
	blue: '#4d8dff',
	magenta: '#e837b9',
} as const

export type ColorToken = keyof typeof colors

const TEXT = 4.5
const NON_TEXT = 3

/** Every foreground and background the interface puts together, with the contrast WCAG 2.2 AA asks of it. */
export const contrastPairs: {
	foreground: ColorToken
	background: ColorToken
	minimum: number
}[] = [
	{ foreground: 'foreground', background: 'background', minimum: TEXT },
	{ foreground: 'label', background: 'background', minimum: TEXT },
	{ foreground: 'muted', background: 'background', minimum: TEXT },
	{ foreground: 'subtle', background: 'background', minimum: TEXT },
	{ foreground: 'accent', background: 'background', minimum: TEXT },
	{ foreground: 'success', background: 'background', minimum: TEXT },
	{ foreground: 'danger', background: 'background', minimum: TEXT },
	{ foreground: 'foreground', background: 'canvas', minimum: TEXT },
	{ foreground: 'foreground', background: 'surface', minimum: TEXT },
	// Placeholders.
	{ foreground: 'subtle', background: 'surface', minimum: TEXT },
	{ foreground: 'primaryForeground', background: 'primary', minimum: TEXT },
	// Text on the stop colors.
	{ foreground: 'primaryForeground', background: 'pink', minimum: TEXT },
	{ foreground: 'primaryForeground', background: 'orange', minimum: TEXT },
	{ foreground: 'primaryForeground', background: 'teal', minimum: TEXT },
	{ foreground: 'primaryForeground', background: 'blue', minimum: TEXT },
	{ foreground: 'primaryForeground', background: 'magenta', minimum: TEXT },
	// An input's outline is how you find it (1.4.11).
	{ foreground: 'input', background: 'background', minimum: NON_TEXT },
	// The focus ring.
	{ foreground: 'accent', background: 'surface', minimum: NON_TEXT },
]
