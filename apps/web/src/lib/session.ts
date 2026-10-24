import axios from 'axios'
import { headers } from 'next/headers'
import type { Traveler } from './auth'

// Where the Next server reaches the API (in production, the internal address; never through the browser).
const API_URL = process.env.API_URL ?? 'http://localhost:3000'

// The client's address travels on, or the API's rate limit would count every visitor as the Next server.
const FORWARDED = ['x-forwarded-for', 'cf-connecting-ip']

/** The traveler of the session cookie this request carries, asked to the API (architecture.md §12). */
export async function getSession() {
	const incoming = await headers()
	const forwarded = Object.fromEntries(
		FORWARDED.flatMap((name) => {
			const value = incoming.get(name)
			return value ? [[name, value]] : []
		}),
	)
	const { data } = await axios.get<{ user: Traveler } | null>(
		`${API_URL}/api/auth/get-session`,
		{ headers: { cookie: incoming.get('cookie') ?? '', ...forwarded } },
	)
	return data?.user ?? null
}
