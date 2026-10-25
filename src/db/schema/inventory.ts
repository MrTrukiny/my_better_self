import { relations, sql } from "drizzle-orm";
import { index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "./auth";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};

export const room = pgTable(
  "room",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("room_user_id_name_unique").on(table.userId, sql`lower(${table.name})`),
    index("room_user_id_idx").on(table.userId),
  ],
);

export const item = pgTable(
  "item",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    roomId: text("room_id")
      .notNull()
      .references(() => room.id, { onDelete: "cascade" }),
    /** One of `ITEM_TYPE_IDS`; validated in code so new types don't need a migration. */
    type: text("type").notNull(),
    name: text("name").notNull(),
    count: integer("count").notNull().default(1),
    note: text("note"),
    ...timestamps,
  },
  (table) => [
    index("item_room_id_idx").on(table.roomId),
    index("item_user_id_idx").on(table.userId),
  ],
);

export const roomRelations = relations(room, ({ many }) => ({
  items: many(item),
}));

export const itemRelations = relations(item, ({ one }) => ({
  room: one(room, { fields: [item.roomId], references: [room.id] }),
}));
