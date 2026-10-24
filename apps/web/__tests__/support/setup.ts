import { GlobalRegistrator } from '@happy-dom/global-registrator'

// A DOM for the component tests (architecture.md D31). Registered before Testing Library loads.
// Bun's own fetch classes stay: happy-dom's, like a browser's, drop the `cookie` header the proxy tests send.
const { Request, Response, Headers, fetch } = globalThis
GlobalRegistrator.register({ url: 'http://localhost:3001/' })
Object.assign(globalThis, { Request, Response, Headers, fetch })

const { afterEach, mock } = await import('bun:test')
const { cleanup } = await import('@testing-library/react')
const { navigation } = await import('./navigation')

// Next's router only exists inside the App Router: tests get a stand-in that records where a page sends the traveler.
mock.module('next/navigation', () => navigation)

afterEach(() => {
	cleanup()
	navigation.reset()
	// biome-ignore lint/suspicious/noDocumentCookie: tests clear the language cookie the sign-in form writes.
	document.cookie = 'NEXT_LOCALE=; max-age=0; path=/'
})
