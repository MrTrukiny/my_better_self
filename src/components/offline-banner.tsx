"use client";

import { useIsOffline } from "@/hooks/use-is-offline";

export function OfflineBanner() {
  const isOffline = useIsOffline();

  if (!isOffline) {
    return null;
  }

  return (
    <div role="status" className="bg-muted text-muted-foreground px-4 py-2 text-center text-sm">
      You are offline. You're seeing what was saved on this device.
    </div>
  );
}
