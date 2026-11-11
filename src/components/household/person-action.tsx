"use client";

import { UserMinus } from "lucide-react";
import { removeMember, withdrawInvitation } from "@/app/(app)/household/actions";
import { DeleteConfirm } from "@/components/inventory/delete-confirm";
import type { HouseholdPerson } from "@/lib/household/rules";

/** The owner's action on someone: withdraw their invitation, or remove them once they joined. */
export function PersonAction({ person, memberId }: { person: HouseholdPerson; memberId: string }) {
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
