import { Elysia } from 'elysia'

export const healthRoutes = new Elysia().get('/healthz', () => ({
	status: 'ok',
}))
