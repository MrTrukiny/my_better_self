import { CalendarCheck, ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { ScrollToHash } from "@/components/scroll-to-hash";
import { calendarSyncSelectUrl, googleCalendarUrl, lastSyncedLine } from "@/lib/calendar/format";
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
      <ScrollToHash id="calendar" />
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
          <div className="bg-muted/50 flex flex-col gap-2 rounded-lg px-3 py-2 text-sm">
            <p className="text-muted-foreground">
              Can't see the sessions? In Google Calendar, make sure the {connection.calendarName}{" "}
              calendar is checked under My calendars.
            </p>
            <div className="flex flex-wrap gap-x-4">
              <ExternalCalendarLink href={googleCalendarUrl(connection.email)}>
                Open Google Calendar
              </ExternalCalendarLink>
              <ExternalCalendarLink href={calendarSyncSelectUrl(connection.email)}>
                Show it on iPhone or Mac
              </ExternalCalendarLink>
            </div>
          </div>
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

function ExternalCalendarLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="focus-visible:ring-ring inline-flex min-h-11 items-center gap-1 rounded-md font-medium underline underline-offset-4 outline-none focus-visible:ring-2"
    >
      {children}
      <ExternalLink aria-hidden className="size-3.5" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}
