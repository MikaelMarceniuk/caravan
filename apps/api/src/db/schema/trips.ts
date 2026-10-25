import { sql } from 'drizzle-orm'
import {
	index,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uuid,
} from 'drizzle-orm/pg-core'
import { user } from './auth'

// architecture.md §11, with only the columns M1 uses (D38). The dates come from the stops (D44);
// current_version and deleted_at come in M2, color and last_seen_at in M4.

export const trips = pgTable('trips', {
	id: uuid().primaryKey().default(sql`uuidv7()`),
	name: text().notNull(),
	// The same fact as the member with role 'owner': both change together (owner transfer, M4).
	ownerId: uuid()
		.notNull()
		.references(() => user.id),
	createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

// A closed set typed in TypeScript only, like user.locale.
export type TripRole = 'owner' | 'editor'

export const tripMembers = pgTable(
	'trip_members',
	{
		tripId: uuid()
			.notNull()
			.references(() => trips.id, { onDelete: 'cascade' }),
		userId: uuid()
			.notNull()
			.references(() => user.id),
		role: text().$type<TripRole>().notNull(),
		joinedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		primaryKey({ columns: [table.tripId, table.userId] }),
		index('trip_members_user_id_idx').on(table.userId),
	],
)
