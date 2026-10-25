import { describe, expect, test } from 'bun:test'
import { nonAdditiveStatements } from '../../src/db/migration-policy'

// Joins statements the way drizzle-kit writes them in a migration file.
const migration = (statements: string[]) =>
	statements.join('--> statement-breakpoint\n')

describe('nonAdditiveStatements', () => {
	test('flags a dropped table', () => {
		expect(nonAdditiveStatements('DROP TABLE "user" CASCADE;')).toEqual([
			'DROP TABLE "user" CASCADE;',
		])
	})

	test('flags a dropped column', () => {
		const statement = 'ALTER TABLE "user" DROP COLUMN "image";'

		expect(nonAdditiveStatements(statement)).toEqual([statement])
	})

	test('flags a dropped type or schema', () => {
		const statements = ['DROP TYPE "public"."role";', 'DROP SCHEMA "legacy";']

		expect(nonAdditiveStatements(migration(statements))).toEqual(statements)
	})

	test('flags a renamed table or column', () => {
		const statements = [
			'ALTER TABLE "user" RENAME TO "users";',
			'ALTER TABLE "user" RENAME COLUMN "name" TO "full_name";',
		]

		expect(nonAdditiveStatements(migration(statements))).toEqual(statements)
	})

	test('flags a changed column type', () => {
		const statement =
			'ALTER TABLE "user" ALTER COLUMN "name" SET DATA TYPE varchar(120);'

		expect(nonAdditiveStatements(statement)).toEqual([statement])
	})

	test('flags a column that becomes required or loses its default', () => {
		const statements = [
			'ALTER TABLE "user" ALTER COLUMN "image" SET NOT NULL;',
			'ALTER TABLE "user" ALTER COLUMN "locale" DROP DEFAULT;',
		]

		expect(nonAdditiveStatements(migration(statements))).toEqual(statements)
	})

	test('flags a required column added without a default', () => {
		const statement = 'ALTER TABLE "user" ADD COLUMN "nickname" text NOT NULL;'

		expect(nonAdditiveStatements(statement)).toEqual([statement])
	})

	test('allows additive statements', () => {
		const statements = [
			'CREATE TABLE "trips" (\n\t"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,\n\t"name" text NOT NULL\n);',
			'ALTER TABLE "user" ADD COLUMN "nickname" text;',
			`ALTER TABLE "user" ADD COLUMN "theme" text DEFAULT 'dark' NOT NULL;`,
			'ALTER TABLE "trips" ADD CONSTRAINT "trips_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;',
			'CREATE INDEX "trips_owner_id_idx" ON "trips" USING btree ("owner_id");',
			'DROP INDEX "trips_owner_id_idx";',
		]

		expect(nonAdditiveStatements(migration(statements))).toEqual([])
	})
})
