import { TriangleAlert } from "lucide-react";
import type { CalendarStatus } from "@/db/schema";
import { ConnectButton } from "./connect-button";

/** Shown while the last sync failed; a lost grant gets a "Reconnect" action. */
export function CalendarSyncNotice({
  status,
  fake,
  email,
}: {
  status: CalendarStatus;
  fake: boolean;
  email: string;
}) {
  if (status === "ok") {
    return null;
  }
  return (
    <div className="flex gap-3 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm">
      <TriangleAlert
        aria-hidden
        className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
      />
      <div className="flex flex-col items-start gap-2">
        <div role="status" className="flex flex-col gap-1">
          <p className="font-medium">We couldn't update your calendar.</p>
          <p>
            {status === "reauth"
              ? "Google no longer lets the app manage it. Reconnect to bring it up to date."
              : "Your plan is fine; the calendar catches up on the next sync."}
          </p>
        </div>
        {status === "reauth" ? (
          <ConnectButton label="Reconnect" email={email} fake={fake} variant="outline" />
        ) : null}
      </div>
    </div>
  );
}
