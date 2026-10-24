import path from 'node:path'
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

// Where the Next server reaches the API. In production Caddy sends /api/* to the API before Next sees it.
const API_URL = process.env.API_URL ?? 'http://localhost:3000'

const config: NextConfig = {
	output: 'standalone',
	// The repo's own AGENTS.md is the guide; `next dev` would otherwise write one here.
	agentRules: false,
	// The standalone build traces files from the repo root (a monorepo).
	outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
	// Workspace packages ship TypeScript sources (architecture.md D36).
	transpilePackages: ['@caravan/tokens'],
	// One origin in development too, like Caddy in production (deploy.md P2): cookies and email links just work.
	async rewrites() {
		return [{ source: '/api/:path*', destination: `${API_URL}/api/:path*` }]
	},
}

export default withNextIntl(config)
