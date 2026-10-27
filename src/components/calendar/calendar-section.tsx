import { CalendarCheck } from "lucide-react";
import { lastSyncedLine } from "@/lib/calendar/format";
import type { CalendarConnectionView } from "@/lib/calendar/queries";
import type { ActionState } from "@/lib/inventory/action-state";
import { CalendarSyncNotice } from "./calendar-sync-notice";
import { ConnectButton } from "./connect-button";
import { DisconnectButton } from "./disconnect-button";
import { SyncNowButton } from "./sync-now-button";

export function CalendarSection({
  connection,
  denied,
  fake,
  email,
  disconnect,
  syncNow,
  now,
}: {
  connection: CalendarConnectionView | null;
  /** The owner just cancelled or declined Google's consent screen. */
  denied: boolean;
  fake: boolean;
  email: string;
  disconnect: () => Promise<ActionState>;
  syncNow: () => Promise<ActionState>;
  /** When the page was rendered, for the last-synced line. */
  now: Date;
}) {
  return (
    <section
      id="calendar"
      aria-labelledby="calendar-heading"
      className="flex scroll-mt-20 flex-col gap-3 border-t pt-6"
    >
      <h2 id="calendar-heading" className="font-heading text-lg font-semibold">
        Google Calendar
      </h2>
      {connection ? (
        <>
          <div className="flex items-start gap-3">
            <CalendarCheck aria-hidden className="text-muted-foreground mt-0.5 size-5 shrink-0" />
            <div className="flex min-w-0 flex-col">
              <p role="status" className="font-medium">
                Connected: {connection.calendarName}
              </p>
              <p className="text-muted-foreground text-sm break-all">{connection.email}</p>
            </div>
          </div>
          <CalendarSyncNotice status={connection.status} fake={fake} email={email} />
          <SyncNowButton action={syncNow} lastSynced={lastSyncedLine(connection.lastSyncedAt, now)}>
            <DisconnectButton action={disconnect} />
          </SyncNowButton>
        </>
      ) : (
        <>
          {denied ? (
            <p role="status" className="bg-muted rounded-lg px-3 py-2 text-sm">
              Google Calendar wasn't connected. You can try again whenever you like.
            </p>
          ) : null}
          <p className="text-muted-foreground text-sm">
            Adds each day's session to a Cleaning calendar in your Google account. The app only
            manages that calendar and checks when you're busy.
          </p>
          <p className="text-muted-foreground text-sm">
            Google may warn that the app isn't verified: it's a personal app, so that's expected.
          </p>
          <ConnectButton label="Connect Google Calendar" email={email} fake={fake} />
        </>
      )}
    </section>
  );
}
