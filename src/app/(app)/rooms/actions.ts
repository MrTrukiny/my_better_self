"use server";

import { and, eq } from "drizzle-orm";
import { updateTag } from "next/cache";
import { db } from "@/db";
import { item, room } from "@/db/schema";
import type { ActionState } from "@/lib/inventory/action-state";
import { inventoryTag } from "@/lib/inventory/queries";
import {
  DUPLICATE_ROOM_NAME,
  isDuplicateRoomNameError,
  itemInputSchema,
  parseInput,
  roomInputSchema,
} from "@/lib/inventory/schemas";
import { getCurrentUser } from "@/lib/session";

const SAVE_FAILED = "Couldn't save your changes. Try again.";
const DELETE_FAILED = "Couldn't delete it. Try again.";
const NOT_FOUND = "This no longer exists. Refresh the page.";

function formValues(formData: FormData, fields: readonly string[]): Record<string, string> {
  return Object.fromEntries(fields.map((field) => [field, String(formData.get(field) ?? "")]));
}

export async function createRoom(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  const values = formValues(formData, ["name"]);
  const parsed = parseInput(roomInputSchema, values);
  if (!parsed.ok) {
    return { status: "error", fieldErrors: parsed.fieldErrors, values };
  }
  try {
    const [created] = await db
      .insert(room)
      .values({ userId: user.id, name: parsed.data.name })
      .returning({ id: room.id });
    updateTag(inventoryTag(user.id));
    return { status: "success", id: created?.id };
  } catch (error) {
    return roomWriteError(error, values);
  }
}

export async function renameRoom(
  roomId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  const values = formValues(formData, ["name"]);
  const parsed = parseInput(roomInputSchema, values);
  if (!parsed.ok) {
    return { status: "error", fieldErrors: parsed.fieldErrors, values };
  }
  try {
    const updated = await db
      .update(room)
      .set({ name: parsed.data.name })
      .where(and(eq(room.id, roomId), eq(room.userId, user.id)))
      .returning({ id: room.id });
    if (updated.length === 0) {
      return { status: "error", formError: NOT_FOUND, values };
    }
    updateTag(inventoryTag(user.id));
    return { status: "success", id: roomId };
  } catch (error) {
    return roomWriteError(error, values);
  }
}

export async function deleteRoom(roomId: string): Promise<ActionState> {
  const user = await getCurrentUser();
  try {
    await db.delete(room).where(and(eq(room.id, roomId), eq(room.userId, user.id)));
    updateTag(inventoryTag(user.id));
    return { status: "success" };
  } catch (error) {
    console.error("deleteRoom failed", error);
    return { status: "error", formError: DELETE_FAILED };
  }
}

const ITEM_FIELDS = ["type", "name", "count", "note"] as const;

export async function createItem(
  roomId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  const values = formValues(formData, ITEM_FIELDS);
  const parsed = parseInput(itemInputSchema, values);
  if (!parsed.ok) {
    return { status: "error", fieldErrors: parsed.fieldErrors, values };
  }
  try {
    const [owned] = await db
      .select({ id: room.id })
      .from(room)
      .where(and(eq(room.id, roomId), eq(room.userId, user.id)));
    if (!owned) {
      return { status: "error", formError: NOT_FOUND, values };
    }
    const [created] = await db
      .insert(item)
      .values({ ...parsed.data, roomId, userId: user.id })
      .returning({ id: item.id });
    updateTag(inventoryTag(user.id));
    return { status: "success", id: created?.id };
  } catch (error) {
    console.error("createItem failed", error);
    return { status: "error", formError: SAVE_FAILED, values };
  }
}

export async function updateItem(
  itemId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  const values = formValues(formData, ITEM_FIELDS);
  const parsed = parseInput(itemInputSchema, values);
  if (!parsed.ok) {
    return { status: "error", fieldErrors: parsed.fieldErrors, values };
  }
  try {
    const updated = await db
      .update(item)
      .set(parsed.data)
      .where(and(eq(item.id, itemId), eq(item.userId, user.id)))
      .returning({ id: item.id });
    if (updated.length === 0) {
      return { status: "error", formError: NOT_FOUND, values };
    }
    updateTag(inventoryTag(user.id));
    return { status: "success", id: itemId };
  } catch (error) {
    console.error("updateItem failed", error);
    return { status: "error", formError: SAVE_FAILED, values };
  }
}

export async function deleteItem(itemId: string): Promise<ActionState> {
  const user = await getCurrentUser();
  try {
    await db.delete(item).where(and(eq(item.id, itemId), eq(item.userId, user.id)));
    updateTag(inventoryTag(user.id));
    return { status: "success" };
  } catch (error) {
    console.error("deleteItem failed", error);
    return { status: "error", formError: DELETE_FAILED };
  }
}

function roomWriteError(error: unknown, values: Record<string, string>): ActionState {
  if (isDuplicateRoomNameError(error)) {
    return { status: "error", fieldErrors: { name: DUPLICATE_ROOM_NAME }, values };
  }
  console.error("room write failed", error);
  return { status: "error", formError: SAVE_FAILED, values };
}
