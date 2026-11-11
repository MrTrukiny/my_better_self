import { z } from "zod";

/** The owner plus the people they invite (spec 015). */
export const HOUSEHOLD_MAX_PEOPLE = 5;

export type HouseholdRole = "owner" | "member";

/** Someone on the household page: the owner, a member who joined, or an invited email. */
export type HouseholdPerson = {
  /** The membership row id; null for the owner, who has none. */
  memberId: string | null;
  userId: string | null;
  name: string | null;
  email: string;
  image: string | null;
  role: HouseholdRole;
};

/** The owner first, then members by join order, then invitations by invite order. */
export function sortPeople<T extends HouseholdPerson & { at: Date }>(people: readonly T[]): T[] {
  const rank = (p: HouseholdPerson) => (p.role === "owner" ? 0 : p.userId ? 1 : 2);
  return [...people].sort((a, b) => rank(a) - rank(b) || a.at.getTime() - b.at.getTime());
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const inviteInputSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter an email address, such as alex@example.com.")),
});

/**
 * Why an email can't be invited, or null when it can. `people` counts the owner, the members,
 * and the pending invitations.
 */
export function inviteProblem({
  email,
  ownerEmail,
  people,
  alreadyInvited,
  hasAccount,
}: {
  email: string;
  ownerEmail: string;
  people: number;
  alreadyInvited: boolean;
  hasAccount: boolean;
}): string | null {
  if (normalizeEmail(email) === normalizeEmail(ownerEmail)) {
    return "That's your own email.";
  }
  if (alreadyInvited) {
    return "This person is already in a household.";
  }
  if (hasAccount) {
    return "This person already uses My Better Self with their own home.";
  }
  if (people >= HOUSEHOLD_MAX_PEOPLE) {
    return `A household has at most ${HOUSEHOLD_MAX_PEOPLE} people.`;
  }
  return null;
}

/** Owners come from `ALLOWED_EMAILS`; everyone else needs an invitation. See ADR 0011. */
export function signInAllowed({
  onAllowlist,
  invited,
}: {
  onAllowlist: boolean;
  invited: boolean;
}): boolean {
  return onAllowlist || invited;
}

/** The household is its owner: a member's household is their owner's id, an owner's their own. */
export function householdOf(
  userId: string,
  membership: { ownerId: string } | null,
): { householdId: string; role: HouseholdRole } {
  return membership
    ? { householdId: membership.ownerId, role: "member" }
    : { householdId: userId, role: "owner" };
}
