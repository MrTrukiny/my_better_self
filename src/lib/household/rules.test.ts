import { describe, expect, it } from "vitest";
import {
  HOUSEHOLD_MAX_PEOPLE,
  householdOf,
  inviteInputSchema,
  inviteProblem,
  signInAllowed,
  sortPeople,
} from "./rules";

describe("inviteInputSchema", () => {
  it("AC1: normalizes the email and rejects invalid ones", () => {
    expect(inviteInputSchema.parse({ email: "  Alex@Example.COM " })).toEqual({
      email: "alex@example.com",
    });
    expect(inviteInputSchema.safeParse({ email: "alex" }).success).toBe(false);
  });
});

describe("inviteProblem", () => {
  const base = {
    email: "alex@example.com",
    ownerEmail: "owner@example.com",
    people: 1,
    alreadyInvited: false,
    hasAccount: false,
  };

  it("AC1: allows a new email while there is room", () => {
    expect(inviteProblem(base)).toBeNull();
    expect(inviteProblem({ ...base, people: HOUSEHOLD_MAX_PEOPLE - 1 })).toBeNull();
  });

  it("AC1: refuses the owner's email, repeats, existing accounts, and a full household", () => {
    expect(inviteProblem({ ...base, email: "Owner@example.com" })).toBe("That's your own email.");
    expect(inviteProblem({ ...base, alreadyInvited: true })).toBe(
      "This person is already in a household.",
    );
    expect(inviteProblem({ ...base, hasAccount: true })).toBe(
      "This person already uses My Better Self with their own home.",
    );
    expect(inviteProblem({ ...base, people: 5 })).toBe("A household has at most 5 people.");
  });
});

describe("signInAllowed", () => {
  it("AC2: owners on the allowlist and invited people may sign in; nobody else", () => {
    expect(signInAllowed({ onAllowlist: true, invited: false })).toBe(true);
    expect(signInAllowed({ onAllowlist: false, invited: true })).toBe(true);
    expect(signInAllowed({ onAllowlist: false, invited: false })).toBe(false);
  });
});

describe("householdOf", () => {
  it("AC2: a member's household is their owner's; an owner's is their own", () => {
    expect(householdOf("u2", { ownerId: "u1" })).toEqual({ householdId: "u1", role: "member" });
    expect(householdOf("u1", null)).toEqual({ householdId: "u1", role: "owner" });
  });
});

describe("sortPeople", () => {
  const person = (id: string, role: "owner" | "member", joined: boolean, at: string) => ({
    memberId: role === "owner" ? null : id,
    userId: joined ? id : null,
    name: null,
    email: `${id}@example.com`,
    image: null,
    role,
    at: new Date(at),
  });

  it("lists the owner, then members by join date, then invitations", () => {
    const people = [
      person("invited", "member", false, "2026-11-01"),
      person("late", "member", true, "2026-11-03"),
      person("owner", "owner", true, "2026-10-01"),
      person("early", "member", true, "2026-11-02"),
    ];
    expect(sortPeople(people).map((p) => p.email)).toEqual([
      "owner@example.com",
      "early@example.com",
      "late@example.com",
      "invited@example.com",
    ]);
  });
});
