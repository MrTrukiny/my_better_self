import { relations, sql } from "drizzle-orm";
import { check, date, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { item, room } from "./inventory";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const owner = () =>
  text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" });

export const homeProfile = pgTable("home_profile", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  /** `HELPER_IDS` values; validated in code so new helpers don't need a migration. */
  helpers: text("helpers").array().notNull().default(sql`'{}'::text[]`),
  note: text("note"),
  ...timestamps,
});

/**
 * Columns shared by tasks and pending proposals. The scope is derived from the links:
 * item (itemId set), room (only roomId), or the whole home (neither). See ADR 0006.
 */
const taskColumns = () => ({
  id: id(),
  userId: owner(),
  roomId: text("room_id").references(() => room.id, { onDelete: "cascade" }),
  itemId: text("item_id").references(() => item.id, { onDelete: "cascade" }),
  /** `cleaning` counts against the daily budget; `routine` doesn't. */
  kind: text("kind").notNull(),
  name: text("name").notNull(),
  minutes: integer("minutes").notNull(),
  frequencyDays: integer("frequency_days").notNull(),
  ...timestamps,
});

export const task = pgTable(
  "task",
  {
    ...taskColumns(),
    /** The first date the scheduler picked while the task was never done. See ADR 0008. */
    firstDue: date("first_due", { mode: "string" }),
    /** When the owner last set the minutes by hand; only times saved after it calibrate. */
    minutesSetAt: timestamp("minutes_set_at", { withTimezone: true }),
    /** The estimate before the last calibration, for its note; null when not calibrated. */
    calibratedFrom: integer("calibrated_from"),
    /** How many recorded times the last calibration used. See ADR 0009. */
    calibratedSamples: integer("calibrated_samples"),
  },
  (table) => [
    index("task_user_id_idx").on(table.userId),
    check("task_item_has_room", sql`${table.itemId} is null or ${table.roomId} is not null`),
  ],
);

export const taskProposal = pgTable(
  "task_proposal",
  {
    ...taskColumns(),
    /** The room the proposal was generated for, or null for the whole home. */
    scopeRoomId: text("scope_room_id").references(() => room.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("task_proposal_user_id_idx").on(table.userId),
    check(
      "task_proposal_item_has_room",
      sql`${table.itemId} is null or ${table.roomId} is not null`,
    ),
  ],
);

export const taskRelations = relations(task, ({ one }) => ({
  room: one(room, { fields: [task.roomId], references: [room.id] }),
  item: one(item, { fields: [task.itemId], references: [item.id] }),
}));
