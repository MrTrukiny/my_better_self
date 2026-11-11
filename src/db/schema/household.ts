import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * A person invited to a household, and once they sign in, a member (spec 015, ADR 0011). The
 * household is its owner, who has no row here. An email belongs to at most one household.
 */
export const householdMember = pgTable(
  "household_member",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Lowercased and trimmed. */
    email: text("email").notNull(),
    /** Set when the invited person first signs in. */
    userId: text("user_id")
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
    invitedAt: timestamp("invited_at", { withTimezone: true }).defaultNow().notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("household_member_email_unique").on(sql`lower(${table.email})`),
    index("household_member_owner_id_idx").on(table.ownerId),
  ],
);
