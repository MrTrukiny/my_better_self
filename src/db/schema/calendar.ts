import { sql } from "drizzle-orm";
import { boolean, check, date, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const CALENDAR_STATUSES = ["ok", "reauth", "error"] as const;
export type CalendarStatus = (typeof CALENDAR_STATUSES)[number];

/** One row per user who connected Google Calendar; no row means not connected. See spec 005. */
export const calendarConnection = pgTable(
  "calendar_connection",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    /** The "Cleaning" calendar's id in Google; null until the first sync creates it. */
    calendarId: text("calendar_id"),
    /** The calendar's name as Google last reported it (the owner can rename it there). */
    calendarName: text("calendar_name"),
    /** `reauth`: Google rejected our access and the owner must reconnect; `error`: anything else. */
    status: text("status").$type<CalendarStatus>().default("ok").notNull(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    check("calendar_connection_status", sql`${table.status} in ('ok', 'reauth', 'error')`),
  ],
);

/** A day that has an event in the "Cleaning" calendar, as last written. */
export const calendarDay = pgTable(
  "calendar_day",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    eventId: text("event_id").notNull(),
    /** Digest of the event as written, so unchanged days aren't written again. */
    digest: text("digest").notNull(),
    /** The session overlaps a busy time in another of the owner's calendars. */
    overlap: boolean("overlap").default(false).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.date] })],
);
