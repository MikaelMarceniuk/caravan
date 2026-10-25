/** What a screen reader announces as an element's description: the text of the elements its aria-describedby names. */
export function descriptionOf(element: Element) {
	return (element.getAttribute('aria-describedby') ?? '')
		.split(/\s+/)
		.filter(Boolean)
		.map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
		.filter(Boolean)
		.join(' ')
}

/** Whether a control is off, by its own attribute or by a disabled fieldset around it. */
export function isDisabled(element: Element) {
	return element.matches(':disabled')
}
