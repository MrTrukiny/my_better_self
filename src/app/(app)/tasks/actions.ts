"use server";

import { updateTag } from "next/cache";
import { db } from "@/db";
import { homeProfile } from "@/db/schema";
import type { ActionState } from "@/lib/inventory/action-state";
import { parseInput } from "@/lib/inventory/schemas";
import { getCurrentUser } from "@/lib/session";
import { tasksTag } from "@/lib/tasks/queries";
import { homeProfileInputSchema } from "@/lib/tasks/schemas";

const SAVE_FAILED = "Couldn't save your changes. Try again.";

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
