import "server-only";
import { and, asc, count, eq } from "drizzle-orm";
import { cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { item, room } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";

export type RoomSummary = { id: string; name: string; itemCount: number };

export type InventoryItem = {
  id: string;
  type: string;
  name: string;
  count: number;
  note: string | null;
};

export type RoomDetail = { id: string; name: string; items: InventoryItem[] };

/** Cache tag for everything in one user's inventory; Server Actions update it after writes. */
export function inventoryTag(userId: string): string {
  return `inventory:${userId}`;
}

export async function getRooms(): Promise<RoomSummary[]> {
  const user = await getCurrentUser();
  return roomsForUser(user.id);
}

export async function getRoom(roomId: string): Promise<RoomDetail> {
  const user = await getCurrentUser();
  const found = await roomForUser(user.id, roomId);
  if (!found) {
    notFound();
  }
  return found;
}

// Not exported: callers must go through the getters above, which resolve the user first.
async function roomsForUser(userId: string): Promise<RoomSummary[]> {
  "use cache";
  cacheTag(inventoryTag(userId));

  return db
    .select({ id: room.id, name: room.name, itemCount: count(item.id) })
    .from(room)
    .leftJoin(item, eq(item.roomId, room.id))
    .where(eq(room.userId, userId))
    .groupBy(room.id)
    .orderBy(asc(room.createdAt), asc(room.id));
}

async function roomForUser(userId: string, roomId: string): Promise<RoomDetail | null> {
  "use cache";
  cacheTag(inventoryTag(userId));

  const [found] = await db
    .select({ id: room.id, name: room.name })
    .from(room)
    .where(and(eq(room.id, roomId), eq(room.userId, userId)));
  if (!found) {
    return null;
  }
  const items = await db
    .select({
      id: item.id,
      type: item.type,
      name: item.name,
      count: item.count,
      note: item.note,
    })
    .from(item)
    .where(and(eq(item.roomId, roomId), eq(item.userId, userId)))
    .orderBy(asc(item.createdAt), asc(item.id));
  return { ...found, items };
}
