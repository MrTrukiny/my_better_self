import "server-only";
import { asc, eq } from "drizzle-orm";
import { cacheTag } from "next/cache";
import { db } from "@/db";
import { householdMember, user } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { householdTag } from "./queries";
import { type HouseholdPerson, sortPeople } from "./rules";

/** Everyone in the signed-in person's household, with the owner first. */
export async function getHousehold(): Promise<HouseholdPerson[]> {
  const current = await getCurrentUser();
  return householdPeople(current.householdId);
}

// Not exported: callers must go through `getHousehold`, which resolves the user first.
async function householdPeople(householdId: string): Promise<HouseholdPerson[]> {
  "use cache";
  cacheTag(householdTag(householdId));

  const [[owner], members] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        at: user.createdAt,
      })
      .from(user)
      .where(eq(user.id, householdId)),
    db
      .select({
        memberId: householdMember.id,
        userId: householdMember.userId,
        invitedEmail: householdMember.email,
        invitedAt: householdMember.invitedAt,
        joinedAt: householdMember.joinedAt,
        name: user.name,
        image: user.image,
      })
      .from(householdMember)
      .leftJoin(user, eq(user.id, householdMember.userId))
      .where(eq(householdMember.ownerId, householdId))
      .orderBy(asc(householdMember.invitedAt), asc(householdMember.id)),
  ]);
  const people = [
    ...(owner
      ? [
          {
            memberId: null,
            userId: owner.id,
            name: owner.name,
            email: owner.email,
            image: owner.image,
            role: "owner" as const,
            at: owner.at,
          },
        ]
      : []),
    ...members.map((m) => ({
      memberId: m.memberId,
      userId: m.userId,
      name: m.name,
      email: m.invitedEmail,
      image: m.image,
      role: "member" as const,
      at: m.joinedAt ?? m.invitedAt,
    })),
  ];
  return sortPeople(people).map(({ at: _, ...person }) => person);
}
