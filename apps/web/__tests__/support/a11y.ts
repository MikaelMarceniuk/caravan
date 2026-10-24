/** What a screen reader announces as an element's description: the text of the elements its aria-describedby names. */
export function descriptionOf(element: Element) {
	return (element.getAttribute('aria-describedby') ?? '')
		.split(/\s+/)
		.filter(Boolean)
		.map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
		.filter(Boolean)
		.join(' ')
}
