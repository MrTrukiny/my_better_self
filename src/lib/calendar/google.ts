import type { CalendarEvent } from "./events";

const API = "https://www.googleapis.com/calendar/v3";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
/** Google's free/busy query takes at most 50 calendars. */
const FREEBUSY_MAX_ITEMS = 50;
const RATE_LIMIT_REASONS = new Set(["rateLimitExceeded", "userRateLimitExceeded", "quotaExceeded"]);

/**
 * `auth`: access was revoked or lacks a scope, so the owner must reconnect. `gone`: the
 * calendar or event doesn't exist (404/410). `conflict`: the id is taken (409). `transient`:
 * anything else, worth retrying on the next sync.
 */
export type CalendarErrorKind = "auth" | "gone" | "conflict" | "transient";

export class CalendarError extends Error {
  constructor(
    readonly kind: CalendarErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "CalendarError";
  }
}

export type CalendarInfo = { id: string; summary: string };
export type CalendarListEntry = { id: string; summary: string; selected: boolean };
export type BusyInterval = { start: Date; end: Date };
export type EventInput = Pick<CalendarEvent, "id" | "summary" | "description" | "start" | "end">;

/** What the sync needs from Google Calendar; `fake.ts` implements it in memory for tests. */
export type CalendarClient = {
  createCalendar(input: { summary: string; timeZone: string }): Promise<CalendarInfo>;
  getCalendar(calendarId: string): Promise<CalendarInfo>;
  deleteCalendar(calendarId: string): Promise<void>;
  listCalendars(): Promise<CalendarListEntry[]>;
  /** Creates or updates the event with `event.id`. */
  putEvent(calendarId: string, event: EventInput): Promise<void>;
  /** Deletes the event; one that's already gone counts as deleted. */
  deleteEvent(calendarId: string, eventId: string): Promise<void>;
  queryBusy(input: {
    calendarIds: string[];
    timeMin: Date;
    timeMax: Date;
    timeZone: string;
  }): Promise<BusyInterval[]>;
  /** Revokes the grant behind the access token (and its refresh token). */
  revoke(): Promise<void>;
};

type GoogleCalendar = { id: string; summary?: string };
type GoogleListPage = {
  items?: Array<{ id: string; summary?: string; selected?: boolean; primary?: boolean }>;
  nextPageToken?: string;
};
type GoogleFreeBusy = {
  calendars?: Record<string, { busy?: Array<{ start: string; end: string }>; errors?: unknown[] }>;
};

/** Google Calendar over REST with one access token; see ADR 0002 for the scopes. */
export function createGoogleCalendarClient(
  accessToken: string,
  fetchFn: typeof fetch = fetch,
): CalendarClient {
  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await send(fetchFn, `${API}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${accessToken}`,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.status === 204) {
      return undefined as T;
    }
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  const calendarPath = (calendarId: string) => `/calendars/${encodeURIComponent(calendarId)}`;
  const eventsPath = (calendarId: string) => `${calendarPath(calendarId)}/events`;

  return {
    async createCalendar({ summary, timeZone }) {
      const created = await request<GoogleCalendar>("POST", "/calendars", { summary, timeZone });
      return { id: created.id, summary: created.summary ?? summary };
    },

    async getCalendar(calendarId) {
      const found = await request<GoogleCalendar>("GET", calendarPath(calendarId));
      return { id: found.id, summary: found.summary ?? "" };
    },

    async deleteCalendar(calendarId) {
      await request("DELETE", calendarPath(calendarId));
    },

    async listCalendars() {
      const entries: CalendarListEntry[] = [];
      let pageToken: string | undefined;
      do {
        const query = new URLSearchParams({ minAccessRole: "freeBusyReader", maxResults: "250" });
        if (pageToken) {
          query.set("pageToken", pageToken);
        }
        const page = await request<GoogleListPage>("GET", `/users/me/calendarList?${query}`);
        for (const item of page.items ?? []) {
          entries.push({
            id: item.id,
            summary: item.summary ?? "",
            selected: item.selected === true || item.primary === true,
          });
        }
        pageToken = page.nextPageToken;
      } while (pageToken);
      return entries;
    },

    async putEvent(calendarId, event) {
      const body = { ...event, status: "confirmed" };
      const update = () =>
        request("PUT", `${eventsPath(calendarId)}/${encodeURIComponent(event.id)}`, body);
      try {
        await update();
        return;
      } catch (error) {
        if (!isKind(error, "gone")) {
          throw error;
        }
      }
      try {
        await request("POST", eventsPath(calendarId), body);
      } catch (error) {
        // Another sync created it in between; update that one.
        if (!isKind(error, "conflict")) {
          throw error;
        }
        await update();
      }
    },

    async deleteEvent(calendarId, eventId) {
      try {
        await request("DELETE", `${eventsPath(calendarId)}/${encodeURIComponent(eventId)}`);
      } catch (error) {
        if (!isKind(error, "gone")) {
          throw error;
        }
      }
    },

    async queryBusy({ calendarIds, timeMin, timeMax, timeZone }) {
      const busy: BusyInterval[] = [];
      for (let i = 0; i < calendarIds.length; i += FREEBUSY_MAX_ITEMS) {
        const items = calendarIds.slice(i, i + FREEBUSY_MAX_ITEMS).map((id) => ({ id }));
        const result = await request<GoogleFreeBusy>("POST", "/freeBusy", {
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          timeZone,
          items,
        });
        for (const calendar of Object.values(result.calendars ?? {})) {
          // A calendar with errors has no usable busy times; the others still count.
          if (calendar.errors?.length) {
            continue;
          }
          for (const interval of calendar.busy ?? []) {
            busy.push({ start: new Date(interval.start), end: new Date(interval.end) });
          }
        }
      }
      return busy;
    },

    async revoke() {
      try {
        await send(fetchFn, REVOKE_URL, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ token: accessToken }),
        });
      } catch (error) {
        // An already revoked token is what we want.
        if (!isKind(error, "auth")) {
          throw error;
        }
      }
    },
  };
}

function isKind(error: unknown, kind: CalendarErrorKind): boolean {
  return error instanceof CalendarError && error.kind === kind;
}

async function send(fetchFn: typeof fetch, url: string, init: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetchFn(url, init);
  } catch (error) {
    throw new CalendarError("transient", `Google Calendar unreachable: ${String(error)}`);
  }
  if (response.ok) {
    return response;
  }
  const body = await response.json().catch(() => null);
  throw new CalendarError(
    classify(response.status, body),
    `Google Calendar answered ${response.status}`,
    response.status,
  );
}

function classify(status: number, body: unknown): CalendarErrorKind {
  if (status === 401) {
    return "auth";
  }
  if (status === 404 || status === 410) {
    return "gone";
  }
  if (status === 409) {
    return "conflict";
  }
  const error = (body as { error?: unknown } | null)?.error;
  if (status === 400 && (error === "invalid_grant" || error === "invalid_token")) {
    return "auth";
  }
  if (status === 403) {
    const reasons =
      (error as { errors?: Array<{ reason?: string }> } | undefined)?.errors?.map(
        (e) => e.reason ?? "",
      ) ?? [];
    return reasons.some((reason) => RATE_LIMIT_REASONS.has(reason)) ? "transient" : "auth";
  }
  return "transient";
}
