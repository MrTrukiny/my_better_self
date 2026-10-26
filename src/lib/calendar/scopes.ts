/** The calendar permissions "Connect Google Calendar" asks for, on top of sign-in. ADR 0002. */
export const CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.app.created",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/calendar.freebusy",
] as const;

const calendarScopes = new Set<string>(CALENDAR_SCOPES);

/** Better Auth stores an account's granted scopes comma-separated. */
function parse(scope: string | null): string[] {
  return (scope ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function hasCalendarScopes(scope: string | null): boolean {
  const granted = new Set(parse(scope));
  return CALENDAR_SCOPES.every((s) => granted.has(s));
}

/** The stored scopes once the calendar grant is revoked, so a later check doesn't see them. */
export function withoutCalendarScopes(scope: string | null): string | null {
  if (scope === null) {
    return null;
  }
  return parse(scope)
    .filter((s) => !calendarScopes.has(s))
    .join(",");
}
