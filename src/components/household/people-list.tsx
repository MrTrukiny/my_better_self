import { UserMinus } from "lucide-react";
import { removeMember, withdrawInvitation } from "@/app/(app)/household/actions";
import { DeleteConfirm } from "@/components/inventory/delete-confirm";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { HouseholdPerson, HouseholdRole } from "@/lib/household/rules";
import { initials } from "@/lib/initials";

export function PeopleList({
  people,
  viewer,
}: {
  people: readonly HouseholdPerson[];
  viewer: { id: string; role: HouseholdRole };
}) {
  return (
    <ul aria-label="People" className="flex flex-col divide-y overflow-hidden rounded-xl border">
      {people.map((person) => (
        <li key={person.memberId ?? "owner"} className="flex min-h-16 items-center gap-3 px-4 py-3">
          <Avatar>
            {person.image ? <AvatarImage src={person.image} alt="" /> : null}
            <AvatarFallback>{initials(person.name ?? person.email)}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="flex flex-wrap items-center gap-2">
              <span className="truncate font-medium">{person.name ?? person.email}</span>
              {person.userId === viewer.id ? (
                <span className="text-muted-foreground text-sm">(you)</span>
              ) : null}
              <Badge variant={person.userId ? "secondary" : "outline"}>{label(person)}</Badge>
            </span>
            {person.name ? (
              <span className="text-muted-foreground truncate text-sm">{person.email}</span>
            ) : null}
          </div>
          {viewer.role === "owner" && person.memberId ? (
            <PersonAction person={person} memberId={person.memberId} />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function label(person: HouseholdPerson): string {
  if (person.role === "owner") return "Owner";
  return person.userId ? "Member" : "Invited";
}

function PersonAction({ person, memberId }: { person: HouseholdPerson; memberId: string }) {
  const who = person.name ?? person.email;
  if (!person.userId) {
    return (
      <DeleteConfirm
        title={`Withdraw the invitation for ${person.email}?`}
        description="They won't be able to sign in unless you invite them again."
        action={withdrawInvitation.bind(null, memberId)}
        triggerLabel={`Withdraw the invitation for ${person.email}`}
        iconOnly
        confirmLabel="Withdraw"
        pendingLabel="Withdrawing..."
      />
    );
  }
  return (
    <DeleteConfirm
      title={`Remove ${who}?`}
      description="Their schedule, history, and calendar connection are deleted, and their upcoming tasks go to the others. The home's rooms and tasks stay."
      action={removeMember.bind(null, memberId)}
      triggerLabel={`Remove ${who}`}
      iconOnly
      confirmLabel="Remove"
      pendingLabel="Removing..."
      icon={UserMinus}
    />
  );
}
