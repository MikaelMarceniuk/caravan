import { describe, expect, test } from 'bun:test'
import { NextRequest } from 'next/server'
import { proxy } from '@/proxy'

function visit(headers: Record<string, string> = {}) {
	return proxy(new NextRequest('http://localhost:3000/sign-in', { headers }))
}

describe('the language cookie', () => {
	test('is stored on the first visit, from the browser language', () => {
		const response = visit({ 'accept-language': 'pt-PT,pt;q=0.9' })

		expect(response.cookies.get('NEXT_LOCALE')?.value).toBe('pt-BR')
	})

	test('stays as it is when it already holds a language', () => {
		const response = visit({
			cookie: 'NEXT_LOCALE=en-US',
			'accept-language': 'pt-BR',
		})

		expect(response.headers.getSetCookie()).toEqual([])
	})

	test('is replaced when it holds a language the interface does not have', () => {
		const response = visit({
			cookie: 'NEXT_LOCALE=fr-FR',
			'accept-language': 'pt-BR',
		})

		expect(response.cookies.get('NEXT_LOCALE')?.value).toBe('pt-BR')
	})

	test('lasts a year and stays on this site', () => {
		const response = visit({ 'accept-language': 'en-US' })

		const cookie = response.headers.getSetCookie()[0]
		expect(cookie).toContain('Max-Age=31536000')
		expect(cookie).toContain('Path=/')
		expect(cookie?.toLowerCase()).toContain('samesite=lax')
	})
})
