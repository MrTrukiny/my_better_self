import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { HouseholdPerson } from "@/lib/household/rules";
import { PeopleList } from "./people-list";

vi.mock("next/offline", () => ({ useOffline: () => false }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/app/(app)/household/actions", () => ({
  removeMember: vi.fn(),
  withdrawInvitation: vi.fn(),
}));

const PEOPLE: HouseholdPerson[] = [
  {
    memberId: null,
    userId: "u1",
    name: "Ana Ruiz",
    email: "ana@example.com",
    image: null,
    role: "owner",
  },
  {
    memberId: "m1",
    userId: "u2",
    name: "Sam Lee",
    email: "sam@example.com",
    image: null,
    role: "member",
  },
  {
    memberId: "m2",
    userId: null,
    name: null,
    email: "kim@example.com",
    image: null,
    role: "member",
  },
];

function rows() {
  return within(screen.getByRole("list", { name: "People" })).getAllByRole("listitem");
}

describe("PeopleList", () => {
  it("AC1: shows the owner, members, and invited people", () => {
    render(<PeopleList people={PEOPLE} viewer={{ id: "u1", role: "owner" }} />);
    const [owner, member, invited] = rows();
    expect(owner).toHaveTextContent("Ana Ruiz(you)Owner");
    expect(member).toHaveTextContent("Sam LeeMembersam@example.com");
    expect(invited).toHaveTextContent("kim@example.comInvited");
  });

  it("AC1: lets the owner remove members and withdraw invitations", () => {
    render(<PeopleList people={PEOPLE} viewer={{ id: "u1", role: "owner" }} />);
    expect(screen.getByRole("button", { name: "Remove Sam Lee" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Withdraw the invitation for kim@example.com" }),
    ).toBeInTheDocument();
    expect(within(rows()[0] as HTMLElement).queryByRole("button")).toBeNull();
  });

  it("AC3: gives members no way to change who is in the household", () => {
    render(<PeopleList people={PEOPLE} viewer={{ id: "u2", role: "member" }} />);
    expect(screen.queryAllByRole("button")).toEqual([]);
    expect(rows()[1]).toHaveTextContent("(you)");
  });
});
