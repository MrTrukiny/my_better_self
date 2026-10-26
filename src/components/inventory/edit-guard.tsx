"use client";

import { WifiOff } from "lucide-react";
import { useIsOffline } from "@/hooks/use-is-offline";

/**
 * Edits are disabled offline: with `experimental.useOffline`, Next would otherwise
 * hold a Server Action and replay it on reconnect, and specs 002 and 003 say nothing is queued.
 */
export function useEditsDisabled(): boolean {
  return useIsOffline();
}

export function EditNotice() {
  const isOffline = useIsOffline();
  if (!isOffline) {
    return null;
  }
  return (
    <p
      role="status"
      className="bg-muted text-muted-foreground flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
    >
      <WifiOff aria-hidden className="size-4 shrink-0" />
      You're offline. You can browse what's saved, but changes need a connection.
    </p>
  );
}
