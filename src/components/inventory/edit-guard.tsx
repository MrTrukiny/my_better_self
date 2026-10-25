"use client";

import { WifiOff } from "lucide-react";
import { useOffline } from "next/offline";

/**
 * Inventory edits are disabled offline: with `experimental.useOffline`, Next would otherwise
 * hold a Server Action and replay it on reconnect, and spec 002 says nothing is queued.
 */
export function useEditsDisabled(): boolean {
  return useOffline();
}

export function EditNotice() {
  const isOffline = useOffline();
  if (!isOffline) {
    return null;
  }
  return (
    <p
      role="status"
      className="bg-muted text-muted-foreground flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
    >
      <WifiOff aria-hidden className="size-4 shrink-0" />
      You're offline. You can browse your inventory, but changes need a connection.
    </p>
  );
}
