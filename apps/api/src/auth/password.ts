// argon2id at OWASP's minimum: 19 MiB and 2 iterations (architecture.md D32).
// Bun's default (64 MiB per hash) would take down the 256 MB container with 4 simultaneous sign-ins.
const ARGON2ID = {
	algorithm: 'argon2id',
	memoryCost: 19_456,
	timeCost: 2,
} as const

export function hashPassword(password: string) {
	return Bun.password.hash(password, ARGON2ID)
}

// The parameters live in the hash itself, so verifying needs none.
export function verifyPassword({
	hash,
	password,
}: {
	hash: string
	password: string
}) {
	return Bun.password.verify(password, hash)
}
