import { colors } from './colors'

const kebab = (name: string) =>
	name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)

/** The tokens as CSS variables on :root, which the web's theme reads (architecture.md D31). */
export function themeCss() {
	const variables = Object.entries(colors)
		.map(([name, value]) => `\t--${kebab(name)}: ${value};`)
		.join('\n')
	return `/* Generated from packages/tokens by \`bun run generate\`: do not edit. */\n:root {\n${variables}\n}\n`
}
