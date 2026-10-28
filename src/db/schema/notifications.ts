import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { session, user } from "./auth";

/** A device that receives push. Deleted with the session it was created in. See ADR 0010. */
export const pushSubscription = pgTable(
  "push_subscription",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sessionId: text("session_id")
      .notNull()
      .references(() => session.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("push_subscription_user_idx").on(table.userId)],
);

/** One row per owner once they save the reminders; no row means the defaults. */
export const notificationSettings = pgTable(
  "notification_settings",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    beforeEnabled: boolean("before_enabled").notNull(),
    /** Minutes before the session start: 0, 5, 15, or 30. */
    beforeMinutes: integer("before_minutes").notNull(),
    eveningEnabled: boolean("evening_enabled").notNull(),
    /** "HH:MM" in the schedule's time zone. */
    eveningTime: text("evening_time").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    check("notification_settings_before_minutes", sql`${table.beforeMinutes} in (0, 5, 15, 30)`),
  ],
);

export const REMINDER_KINDS = ["before", "evening"] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

/** A reminder that was sent, so each kind goes out at most once per owner and day. */
export const notificationLog = pgTable(
  "notification_log",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    kind: text("kind").$type<ReminderKind>().notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.date, table.kind] }),
    check("notification_log_kind", sql`${table.kind} in ('before', 'evening')`),
  ],
);
