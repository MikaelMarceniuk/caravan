// WCAG 2.2 relative luminance of an sRGB color written as #rrggbb.
function luminance(hex: string) {
	const [r = 0, g = 0, b = 0] = [1, 3, 5].map((start) => {
		const channel = Number.parseInt(hex.slice(start, start + 2), 16) / 255
		return channel <= 0.04045
			? channel / 12.92
			: ((channel + 0.055) / 1.055) ** 2.4
	})
	return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG 2.2 contrast ratio between two colors, from 1 to 21. */
export function contrastRatio(a: string, b: string) {
	const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x)
	return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05)
}
