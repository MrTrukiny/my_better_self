import "server-only";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { householdMember } from "@/db/schema";
import { normalizeEmail } from "./rules";

/** The household a user joined, or null for an owner (or someone with no household). */
export async function membershipOf(userId: string): Promise<{ ownerId: string } | null> {
  const [row] = await db
    .select({ ownerId: householdMember.ownerId })
    .from(householdMember)
    .where(eq(householdMember.userId, userId));
  return row ?? null;
}

/** Whether the email has an invitation or membership, so it may sign in. */
export async function isInvited(email: string): Promise<boolean> {
  const [row] = await db
    .select({ id: householdMember.id })
    .from(householdMember)
    .where(eq(sql`lower(${householdMember.email})`, normalizeEmail(email)));
  return row !== undefined;
}

/** Links a pending invitation to the account that just signed up with its email. */
export async function joinInvitation(email: string, userId: string): Promise<void> {
  await db
    .update(householdMember)
    .set({ userId, joinedAt: new Date() })
    .where(
      and(
        eq(sql`lower(${householdMember.email})`, normalizeEmail(email)),
        isNull(householdMember.userId),
      ),
    );
}

/** The household a user belongs to: their owner's id, or their own id (ADR 0011). */
export async function householdIdOf(userId: string): Promise<string> {
  return (await membershipOf(userId))?.ownerId ?? userId;
}

/** Everyone in the household who has an account: the owner and the members who joined. */
export async function peopleOf(householdId: string): Promise<string[]> {
  const members = await db
    .select({ userId: householdMember.userId })
    .from(householdMember)
    .where(and(eq(householdMember.ownerId, householdId), isNotNull(householdMember.userId)));
  return [householdId, ...members.flatMap((m) => (m.userId ? [m.userId] : []))].sort();
}
