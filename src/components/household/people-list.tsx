import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { HouseholdPerson, HouseholdRole } from "@/lib/household/rules";
import { initials } from "@/lib/initials";
import { PersonAction } from "./person-action";

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
