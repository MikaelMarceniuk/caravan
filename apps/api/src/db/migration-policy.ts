// drizzle-kit separates the statements of a migration with this marker.
const STATEMENT_BREAKPOINT = '--> statement-breakpoint'

const NON_ADDITIVE = [
	/^DROP (TABLE|TYPE|SCHEMA)\b/i,
	/\bDROP COLUMN\b/i,
	/\bRENAME\b/i,
	/\bALTER COLUMN\b.*\b(SET DATA )?TYPE\b/i,
	/\bALTER COLUMN\b.*\b(SET NOT NULL|DROP DEFAULT)\b/i,
	// The previous release's inserts don't fill it.
	/\bADD COLUMN\b(?!.*\bDEFAULT\b).*\bNOT NULL\b/i,
]

/** The statements of a migration that the previous release's code may not survive (deploy.md §5, P7). */
export function nonAdditiveStatements(migration: string) {
	return migration
		.split(STATEMENT_BREAKPOINT)
		.map((statement) => statement.trim())
		.filter((statement) =>
			NON_ADDITIVE.some((pattern) => pattern.test(statement)),
		)
}
