"use server";

import { and, eq, isNull, type SQL } from "drizzle-orm";
import { updateTag } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db";
import { homeProfile, task, taskProposal } from "@/db/schema";
import { preferredLanguage } from "@/lib/ai/locale";
import { getProposalOptions } from "@/lib/ai/model";
import { proposeTasks } from "@/lib/ai/task-proposals";
import type { ActionState } from "@/lib/inventory/action-state";
import { parseInput } from "@/lib/inventory/schemas";
import { replanAfterChange } from "@/lib/scheduler/plan";
import { getCurrentUser } from "@/lib/session";
import type { GenerateState } from "@/lib/tasks/generate-state";
import { readProposalInput, tasksTag } from "@/lib/tasks/queries";
import { homeProfileInputSchema, taskInputSchema } from "@/lib/tasks/schemas";

const SAVE_FAILED = "Couldn't save your changes. Try again.";
const DELETE_FAILED = "Couldn't delete it. Try again.";
const NOT_FOUND = "This no longer exists. Refresh the page.";
const NO_ROOMS = "Add a room and its items first, so there's something to plan.";
const GENERATE_FAILED = "Couldn't propose tasks. Try again.";
const GENERATE_UNAVAILABLE = "Task proposals aren't available right now. Try again later.";

const TASK_FIELDS = ["name", "kind", "minutes", "frequencyDays"] as const;

function formValues(formData: FormData, fields: readonly string[]): Record<string, string> {
  return Object.fromEntries(fields.map((field) => [field, String(formData.get(field) ?? "")]));
}

export async function saveHomeProfile(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  const helpers = formData.getAll("helpers").map(String);
  const note = String(formData.get("note") ?? "");
  const values = { helpers: helpers.join(","), note };
  const parsed = parseInput(homeProfileInputSchema, { helpers, note });
  if (!parsed.ok) {
    return { status: "error", fieldErrors: parsed.fieldErrors, values };
  }
  try {
    await db
      .insert(homeProfile)
      .values({ userId: user.id, ...parsed.data })
      .onConflictDoUpdate({ target: homeProfile.userId, set: parsed.data });
    updateTag(tasksTag(user.id));
    return { status: "success" };
  } catch (error) {
    console.error("saveHomeProfile failed", error);
    return { status: "error", formError: SAVE_FAILED, values };
  }
}

/**
 * Proposes tasks for the whole home (`scopeRoomId` null) or one room, replacing the pending
 * proposals of that scope. Nothing is written when generation fails.
 */
export async function generateProposals(scopeRoomId: string | null): Promise<GenerateState> {
  const user = await getCurrentUser();
  try {
    const language = preferredLanguage((await headers()).get("accept-language"));
    const input = await readProposalInput(user.id, scopeRoomId, language);
    if (input.rooms.length === 0) {
      return { status: "error", formError: NO_ROOMS };
    }
    if (scopeRoomId !== null && !input.rooms.some((r) => r.id === scopeRoomId)) {
      return { status: "error", formError: NOT_FOUND };
    }

    const result = await proposeTasks(input, getProposalOptions());
    if (!result.ok) {
      const formError = result.reason === "unavailable" ? GENERATE_UNAVAILABLE : GENERATE_FAILED;
      return { status: "error", formError };
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(taskProposal)
        .where(
          and(
            eq(taskProposal.userId, user.id),
            scopeRoomId === null
              ? isNull(taskProposal.scopeRoomId)
              : eq(taskProposal.scopeRoomId, scopeRoomId),
          ),
        );
      if (result.proposals.length > 0) {
        await tx
          .insert(taskProposal)
          .values(result.proposals.map((p) => ({ ...p, userId: user.id, scopeRoomId })));
      }
    });
    updateTag(tasksTag(user.id));
    return { status: "success", count: result.proposals.length };
  } catch (error) {
    console.error("generateProposals failed", error);
    return { status: "error", formError: GENERATE_FAILED };
  }
}

export async function updateProposal(
  proposalId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  const values = formValues(formData, TASK_FIELDS);
  const parsed = parseInput(taskInputSchema, values);
  if (!parsed.ok) {
    return { status: "error", fieldErrors: parsed.fieldErrors, values };
  }
  try {
    const updated = await db
      .update(taskProposal)
      .set(parsed.data)
      .where(and(eq(taskProposal.id, proposalId), eq(taskProposal.userId, user.id)))
      .returning({ id: taskProposal.id });
    if (updated.length === 0) {
      return { status: "error", formError: NOT_FOUND, values };
    }
    updateTag(tasksTag(user.id));
    return { status: "success", id: proposalId };
  } catch (error) {
    console.error("updateProposal failed", error);
    return { status: "error", formError: SAVE_FAILED, values };
  }
}

export async function acceptProposal(proposalId: string): Promise<ActionState> {
  const user = await getCurrentUser();
  return acceptWhere(
    user.id,
    and(eq(taskProposal.id, proposalId), eq(taskProposal.userId, user.id)),
  );
}

export async function acceptAllProposals(): Promise<ActionState> {
  const user = await getCurrentUser();
  return acceptWhere(user.id, eq(taskProposal.userId, user.id));
}

/** Moves the matching proposals into tasks, in one transaction. */
async function acceptWhere(userId: string, where: SQL | undefined): Promise<ActionState> {
  try {
    const accepted = await db.transaction(async (tx) => {
      const moved = await tx.delete(taskProposal).where(where).returning({
        userId: taskProposal.userId,
        roomId: taskProposal.roomId,
        itemId: taskProposal.itemId,
        kind: taskProposal.kind,
        name: taskProposal.name,
        minutes: taskProposal.minutes,
        frequencyDays: taskProposal.frequencyDays,
      });
      if (moved.length > 0) {
        await tx.insert(task).values(moved);
      }
      return moved.length;
    });
    if (accepted === 0) {
      return { status: "error", formError: NOT_FOUND };
    }
    await replanAfterChange(userId);
    updateTag(tasksTag(userId));
    return { status: "success" };
  } catch (error) {
    console.error("acceptProposals failed", error);
    return { status: "error", formError: SAVE_FAILED };
  }
}

export async function discardProposal(proposalId: string): Promise<ActionState> {
  const user = await getCurrentUser();
  try {
    await db
      .delete(taskProposal)
      .where(and(eq(taskProposal.id, proposalId), eq(taskProposal.userId, user.id)));
    updateTag(tasksTag(user.id));
    return { status: "success" };
  } catch (error) {
    console.error("discardProposal failed", error);
    return { status: "error", formError: DELETE_FAILED };
  }
}

export async function updateTask(
  taskId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  const values = formValues(formData, TASK_FIELDS);
  const parsed = parseInput(taskInputSchema, values);
  if (!parsed.ok) {
    return { status: "error", fieldErrors: parsed.fieldErrors, values };
  }
  try {
    const updated = await db
      .update(task)
      // The frequency may change, so a task that was never done gets its first date picked again.
      .set({ ...parsed.data, firstDue: null })
      .where(and(eq(task.id, taskId), eq(task.userId, user.id)))
      .returning({ id: task.id });
    if (updated.length === 0) {
      return { status: "error", formError: NOT_FOUND, values };
    }
    await replanAfterChange(user.id);
    updateTag(tasksTag(user.id));
    return { status: "success", id: taskId };
  } catch (error) {
    console.error("updateTask failed", error);
    return { status: "error", formError: SAVE_FAILED, values };
  }
}

export async function deleteTask(taskId: string): Promise<ActionState> {
  const user = await getCurrentUser();
  try {
    await db.delete(task).where(and(eq(task.id, taskId), eq(task.userId, user.id)));
    await replanAfterChange(user.id);
    updateTag(tasksTag(user.id));
    return { status: "success" };
  } catch (error) {
    console.error("deleteTask failed", error);
    return { status: "error", formError: DELETE_FAILED };
  }
}
