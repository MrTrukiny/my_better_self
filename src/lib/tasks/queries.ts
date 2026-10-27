import "server-only";
import { asc, eq } from "drizzle-orm";
import { cacheTag } from "next/cache";
import { db } from "@/db";
import { homeProfile, item, room, scheduleSettings, task, taskProposal } from "@/db/schema";
import type { ProposalInput } from "@/lib/ai/task-proposals";
import { inventoryTag } from "@/lib/inventory/queries";
import { getCurrentUser } from "@/lib/session";
import type { CoverageInput } from "./coverage";
import { HELPER_IDS, type HelperId } from "./helpers";
import type { TaskKind } from "./limits";

export type HomeProfile = { helpers: HelperId[]; note: string | null };

/** A task or proposal with the names of what it belongs to; no room means the whole home. */
export type TaskEntry = {
  id: string;
  kind: TaskKind;
  name: string;
  minutes: number;
  frequencyDays: number;
  roomId: string | null;
  roomName: string | null;
  itemId: string | null;
  itemName: string | null;
};

/** Cache tag for one user's home profile, tasks, and proposals. */
export function tasksTag(userId: string): string {
  return `tasks:${userId}`;
}

export async function getHomeProfile(): Promise<HomeProfile> {
  const user = await getCurrentUser();
  return homeProfileForUser(user.id);
}

export async function getTasks(): Promise<TaskEntry[]> {
  const user = await getCurrentUser();
  return tasksForUser(user.id);
}

export async function getProposals(): Promise<TaskEntry[]> {
  const user = await getCurrentUser();
  return proposalsForUser(user.id);
}

/** Rooms with their item ids and the targets of every task and pending proposal. */
export async function getProposalTargets(): Promise<Omit<CoverageInput, "scopeRoomId">> {
  const user = await getCurrentUser();
  return proposalTargetsForUser(user.id);
}

// Not exported: callers must go through the getters above, which resolve the user first.
async function proposalTargetsForUser(userId: string): Promise<Omit<CoverageInput, "scopeRoomId">> {
  "use cache";
  cacheTag(tasksTag(userId), inventoryTag(userId));

  const [rooms, items, tasks, proposals] = await Promise.all([
    db.select({ id: room.id }).from(room).where(eq(room.userId, userId)),
    db.select({ id: item.id, roomId: item.roomId }).from(item).where(eq(item.userId, userId)),
    db
      .select({ roomId: task.roomId, itemId: task.itemId })
      .from(task)
      .where(eq(task.userId, userId)),
    db
      .select({ roomId: taskProposal.roomId, itemId: taskProposal.itemId })
      .from(taskProposal)
      .where(eq(taskProposal.userId, userId)),
  ]);
  return {
    rooms: rooms.map((r) => ({
      id: r.id,
      items: items.filter((i) => i.roomId === r.id).map((i) => ({ id: i.id })),
    })),
    existing: [...tasks, ...proposals],
  };
}

async function homeProfileForUser(userId: string): Promise<HomeProfile> {
  "use cache";
  cacheTag(tasksTag(userId));
  return readHomeProfile(userId);
}

async function tasksForUser(userId: string): Promise<TaskEntry[]> {
  "use cache";
  cacheTag(tasksTag(userId), inventoryTag(userId));

  const rows = await db
    .select({ ...entryColumns(task), roomName: room.name, itemName: item.name })
    .from(task)
    .leftJoin(room, eq(room.id, task.roomId))
    .leftJoin(item, eq(item.id, task.itemId))
    .where(eq(task.userId, userId))
    .orderBy(asc(task.createdAt), asc(task.name), asc(task.id));
  return rows.map(toEntry);
}

async function proposalsForUser(userId: string): Promise<TaskEntry[]> {
  "use cache";
  cacheTag(tasksTag(userId), inventoryTag(userId));

  const rows = await db
    .select({ ...entryColumns(taskProposal), roomName: room.name, itemName: item.name })
    .from(taskProposal)
    .leftJoin(room, eq(room.id, taskProposal.roomId))
    .leftJoin(item, eq(item.id, taskProposal.itemId))
    .where(eq(taskProposal.userId, userId))
    .orderBy(asc(taskProposal.createdAt), asc(taskProposal.name), asc(taskProposal.id));
  return rows.map(toEntry);
}

function entryColumns(table: typeof task | typeof taskProposal) {
  return {
    id: table.id,
    kind: table.kind,
    name: table.name,
    minutes: table.minutes,
    frequencyDays: table.frequencyDays,
    roomId: table.roomId,
    itemId: table.itemId,
  };
}

function toEntry(row: Omit<TaskEntry, "kind"> & { kind: string }): TaskEntry {
  return { ...row, kind: row.kind === "routine" ? "routine" : "cleaning" };
}

async function readHomeProfile(userId: string): Promise<HomeProfile> {
  const [row] = await db
    .select({ helpers: homeProfile.helpers, note: homeProfile.note })
    .from(homeProfile)
    .where(eq(homeProfile.userId, userId));
  const known = new Set<string>(HELPER_IDS);
  return {
    helpers: (row?.helpers ?? []).filter((id): id is HelperId => known.has(id)),
    note: row?.note ?? null,
  };
}

/**
 * Everything the generator needs, read fresh for a Server Action. Every pending proposal, of any
 * scope, counts as existing: what already has a task or a proposal isn't proposed for again.
 */
export async function readProposalInput(
  userId: string,
  scopeRoomId: string | null,
  language: string | null,
): Promise<ProposalInput> {
  const [rooms, items, profile, tasks, proposals, [schedule]] = await Promise.all([
    db
      .select({ id: room.id, name: room.name })
      .from(room)
      .where(eq(room.userId, userId))
      .orderBy(asc(room.createdAt), asc(room.id)),
    db
      .select({
        id: item.id,
        roomId: item.roomId,
        type: item.type,
        name: item.name,
        count: item.count,
        note: item.note,
      })
      .from(item)
      .where(eq(item.userId, userId))
      .orderBy(asc(item.createdAt), asc(item.id)),
    readHomeProfile(userId),
    db
      .select({ roomId: task.roomId, itemId: task.itemId, name: task.name })
      .from(task)
      .where(eq(task.userId, userId)),
    db
      .select({ roomId: taskProposal.roomId, itemId: taskProposal.itemId, name: taskProposal.name })
      .from(taskProposal)
      .where(eq(taskProposal.userId, userId)),
    db
      .select({ timeZone: scheduleSettings.timeZone })
      .from(scheduleSettings)
      .where(eq(scheduleSettings.userId, userId)),
  ]);
  return {
    rooms: rooms.map((r) => ({
      ...r,
      items: items.filter((i) => i.roomId === r.id).map(({ roomId: _, ...i }) => i),
    })),
    profile,
    existing: [...tasks, ...proposals],
    scopeRoomId,
    locale: { language, timeZone: schedule?.timeZone ?? null },
  };
}
