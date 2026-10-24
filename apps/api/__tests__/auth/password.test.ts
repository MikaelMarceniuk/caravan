import { describe, expect, test } from 'bun:test'
import { hashPassword, verifyPassword } from '../../src/auth/password'

describe('passwords', () => {
	test('are hashed with argon2id at 19 MiB and 2 iterations', async () => {
		const hash = await hashPassword('correct horse battery')

		// PHC string format; OWASP's minimum argon2id parameters (architecture.md D32).
		expect(hash).toStartWith('$argon2id$v=19$m=19456,t=2,p=1$')
	})

	test('match only the password they were hashed from', async () => {
		const hash = await hashPassword('correct horse battery')

		expect(
			await verifyPassword({ hash, password: 'correct horse battery' }),
		).toBe(true)
		expect(
			await verifyPassword({ hash, password: 'wrong horse battery' }),
		).toBe(false)
	})
})
