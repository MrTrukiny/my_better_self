"use server";

import { and, count, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { updateTag } from "next/cache";
import { db } from "@/db";
import { householdMember, user } from "@/db/schema";
import { householdTag } from "@/lib/household/queries";
import { inviteInputSchema, inviteProblem } from "@/lib/household/rules";
import type { ActionState } from "@/lib/inventory/action-state";
import { parseInput } from "@/lib/inventory/schemas";
import { replanAfterChange } from "@/lib/scheduler/plan";
import { getCurrentUser } from "@/lib/session";

const OWNER_ONLY = "Only the owner of the household can do this.";
const NOT_FOUND = "This person is no longer in the household. Refresh the page.";
const SAVE_FAILED = "Couldn't save the change. Try again.";
const ALREADY_INVITED = "This person is already in a household.";

/** Adds an invitation; the person joins when they sign in with Google using this email. */
export async function invitePerson(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const current = await getCurrentUser();
  const values = { email: String(formData.get("email") ?? "") };
  if (current.role !== "owner") {
    return { status: "error", formError: OWNER_ONLY, values };
  }
  const parsed = parseInput(inviteInputSchema, values);
  if (!parsed.ok) {
    return { status: "error", fieldErrors: parsed.fieldErrors, values };
  }
  const { email } = parsed.data;
  try {
    const [[people], [invited], [account]] = await Promise.all([
      db
        .select({ count: count() })
        .from(householdMember)
        .where(eq(householdMember.ownerId, current.householdId)),
      db
        .select({ id: householdMember.id })
        .from(householdMember)
        .where(eq(sql`lower(${householdMember.email})`, email)),
      db
        .select({ id: user.id })
        .from(user)
        .where(eq(sql`lower(${user.email})`, email)),
    ]);
    const problem = inviteProblem({
      email,
      ownerEmail: current.email,
      people: 1 + (people?.count ?? 0),
      alreadyInvited: invited !== undefined,
      hasAccount: account !== undefined,
    });
    if (problem) {
      return { status: "error", fieldErrors: { email: problem }, values };
    }
    await db.insert(householdMember).values({ ownerId: current.householdId, email });
    updateTag(householdTag(current.householdId));
    return { status: "success" };
  } catch (error) {
    if (isDuplicateEmail(error)) {
      return { status: "error", fieldErrors: { email: ALREADY_INVITED }, values };
    }
    console.error("invitePerson failed", error);
    return { status: "error", formError: SAVE_FAILED, values };
  }
}

/** Withdraws an invitation nobody has used yet. */
export async function withdrawInvitation(memberId: string): Promise<ActionState> {
  const current = await getCurrentUser();
  if (current.role !== "owner") {
    return { status: "error", formError: OWNER_ONLY };
  }
  try {
    const deleted = await db
      .delete(householdMember)
      .where(
        and(
          eq(householdMember.id, memberId),
          eq(householdMember.ownerId, current.householdId),
          isNull(householdMember.userId),
        ),
      )
      .returning({ id: householdMember.id });
    updateTag(householdTag(current.householdId));
    return deleted.length > 0 ? { status: "success" } : { status: "error", formError: NOT_FOUND };
  } catch (error) {
    console.error("withdrawInvitation failed", error);
    return { status: "error", formError: SAVE_FAILED };
  }
}

/**
 * Removes a member: their user goes, and with it their schedule, history, and calendar
 * connection (ADR 0011). Their future tasks are replanned among the others.
 */
export async function removeMember(memberId: string): Promise<ActionState> {
  const current = await getCurrentUser();
  if (current.role !== "owner") {
    return { status: "error", formError: OWNER_ONLY };
  }
  try {
    const [member] = await db
      .select({ userId: householdMember.userId })
      .from(householdMember)
      .where(
        and(
          eq(householdMember.id, memberId),
          eq(householdMember.ownerId, current.householdId),
          isNotNull(householdMember.userId),
        ),
      );
    if (!member?.userId) {
      return { status: "error", formError: NOT_FOUND };
    }
    await db.delete(user).where(eq(user.id, member.userId));
    updateTag(householdTag(current.householdId));
  } catch (error) {
    console.error("removeMember failed", error);
    return { status: "error", formError: SAVE_FAILED };
  }
  await replanAfterChange(current.householdId);
  return { status: "success" };
}

/** A member leaves: as when removed, their own data goes and the shared home stays. */
export async function leaveHousehold(): Promise<ActionState> {
  const current = await getCurrentUser();
  if (current.role !== "member") {
    return { status: "error", formError: "The owner can't leave their own household." };
  }
  try {
    await db.delete(user).where(eq(user.id, current.id));
    updateTag(householdTag(current.householdId));
  } catch (error) {
    console.error("leaveHousehold failed", error);
    return { status: "error", formError: SAVE_FAILED };
  }
  await replanAfterChange(current.householdId);
  return { status: "success" };
}

function isDuplicateEmail(error: unknown): boolean {
  for (let current = error; current; current = (current as { cause?: unknown }).cause) {
    const { code, constraint } = current as { code?: unknown; constraint?: unknown };
    if (code === "23505" && constraint === "household_member_email_unique") {
      return true;
    }
    if (typeof current !== "object") {
      break;
    }
  }
  return false;
}
