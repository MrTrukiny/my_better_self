import { relations, sql } from "drizzle-orm";
import { check, date, index, integer, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { task } from "./tasks";

/** One row per user; there is no plan until it exists. See ADR 0007. */
export const scheduleSettings = pgTable(
  "schedule_settings",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Seven `HH:MM` start times, Monday first; null for a day off. */
    startTimes: text("start_times").array().$type<(string | null)[]>().notNull(),
    weekdayMinutes: integer("weekday_minutes").notNull(),
    weekendMinutes: integer("weekend_minutes").notNull(),
    /** IANA time zone reported by the device when the settings were saved. */
    timeZone: text("time_zone").notNull(),
    /** Last date the plan covers; days off without routines leave no occurrences to tell. */
    plannedThrough: date("planned_through", { mode: "string" }),
    /** The owner's date of the last full replan; the first visit of a new day replans. */
    replannedOn: date("replanned_on", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    check("schedule_settings_seven_days", sql`cardinality(${table.startTimes}) = 7`),
    check(
      "schedule_settings_budgets",
      sql`${table.weekdayMinutes} between 30 and 120 and ${table.weekendMinutes} between 30 and 120`,
    ),
  ],
);

export const OCCURRENCE_STATUSES = ["scheduled", "done", "skipped"] as const;
export type OccurrenceStatus = (typeof OCCURRENCE_STATUSES)[number];

/** A task planned for a date. Past `done` and `skipped` rows are the history. See ADR 0008. */
export const occurrence = pgTable(
  "occurrence",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    taskId: text("task_id")
      .notNull()
      .references(() => task.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    status: text("status").$type<OccurrenceStatus>().notNull().default("scheduled"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("occurrence_task_date").on(table.taskId, table.date),
    index("occurrence_user_date_idx").on(table.userId, table.date),
    check("occurrence_status", sql`${table.status} in ('scheduled', 'done', 'skipped')`),
  ],
);

export const occurrenceRelations = relations(occurrence, ({ one }) => ({
  task: one(task, { fields: [occurrence.taskId], references: [task.id] }),
}));
