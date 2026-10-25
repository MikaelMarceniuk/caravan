export type SearchParams = Record<string, string | string[] | undefined>

/** A query parameter's value, or its first value when it repeats. */
export function firstParam(value: string | string[] | undefined) {
	return Array.isArray(value) ? value[0] : value
}
