import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
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
