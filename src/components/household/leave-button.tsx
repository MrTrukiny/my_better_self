"use client";

import { LogOut } from "lucide-react";
import { leaveHousehold } from "@/app/(app)/household/actions";
import { DeleteConfirm } from "@/components/inventory/delete-confirm";
import { authClient } from "@/lib/auth-client";
import { SIGN_IN_PATH } from "@/lib/callback-url";
import { clearAppCaches } from "@/lib/clear-app-caches";
import type { ActionState } from "@/lib/inventory/action-state";
import { unsubscribeDevice } from "@/lib/notifications/browser";

export function LeaveButton({ action = leaveHousehold }: { action?: () => Promise<ActionState> }) {
  async function signOut() {
    await unsubscribeDevice();
    // The session went with the account; this only clears the cookies.
    await authClient.signOut().catch(() => undefined);
    await clearAppCaches();
    window.location.replace(SIGN_IN_PATH);
  }

  return (
    <DeleteConfirm
      title="Leave the household?"
      description="Your schedule, history, and calendar connection are deleted, and you're signed out. The home's rooms and tasks stay with the others."
      action={action}
      triggerLabel="Leave household"
      confirmLabel="Leave"
      pendingLabel="Leaving..."
      icon={LogOut}
      onDone={signOut}
    />
  );
}
