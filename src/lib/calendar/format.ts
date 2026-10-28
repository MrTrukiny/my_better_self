const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "Last synced 10 minutes ago", or "Not synced yet" when the calendar never synced. */
export function lastSyncedLine(lastSyncedAt: Date | null, now: Date): string {
  if (lastSyncedAt === null) {
    return "Not synced yet";
  }
  const elapsed = now.getTime() - lastSyncedAt.getTime();
  if (elapsed < MINUTE) {
    return "Last synced just now";
  }
  if (elapsed < HOUR) {
    return `Last synced ${plural(Math.floor(elapsed / MINUTE), "minute")} ago`;
  }
  if (elapsed < DAY) {
    return `Last synced ${plural(Math.floor(elapsed / HOUR), "hour")} ago`;
  }
  return `Last synced ${plural(Math.floor(elapsed / DAY), "day")} ago`;
}

/** Google Calendar on the web, in the owner's account rather than whichever one is signed in first. */
export function googleCalendarUrl(email: string): string {
  return `https://calendar.google.com/calendar/r?authuser=${encodeURIComponent(email)}`;
}

/** Where Apple Calendar users choose which Google calendars sync to their devices. */
export function calendarSyncSelectUrl(email: string): string {
  return `https://calendar.google.com/calendar/syncselect?authuser=${encodeURIComponent(email)}`;
}

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? "" : "s"}`;
}
