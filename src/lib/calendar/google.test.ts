import { describe, expect, it } from "vitest";
import { CalendarError, createGoogleCalendarClient } from "./google";

type Call = { method: string; url: string; body: unknown; headers: Headers };

/** A `fetch` that answers from `responses` in order and records each request. */
function fakeFetch(...responses: Array<{ status: number; body?: unknown } | Error>) {
  const calls: Call[] = [];
  const queue = [...responses];
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    const raw = init?.body;
    const body =
      typeof raw === "string" && headers.get("content-type")?.includes("json")
        ? JSON.parse(raw)
        : raw instanceof URLSearchParams
          ? raw.toString()
          : raw;
    calls.push({ method: init?.method ?? "GET", url: String(input), body, headers });
    const next = queue.shift() ?? { status: 200, body: {} };
    if (next instanceof Error) {
      throw next;
    }
    return new Response(next.body === undefined ? null : JSON.stringify(next.body), {
      status: next.status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return { fetchFn, calls };
}

const API = "https://www.googleapis.com/calendar/v3";

const event = {
  id: "abc123",
  summary: "Cleaning, 38 min",
  description: "Kitchen surface clean (Kitchen), 10 min",
  start: { dateTime: "2026-10-27T06:30:00", timeZone: "America/Bogota" },
  end: { dateTime: "2026-10-27T07:08:00", timeZone: "America/Bogota" },
};

async function rejection(promise: Promise<unknown>): Promise<CalendarError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof CalendarError) {
      return error;
    }
    throw error;
  }
  throw new Error("expected a CalendarError");
}

describe("createGoogleCalendarClient", () => {
  it("AC2: creates the calendar in the owner's time zone with the bearer token", async () => {
    const { fetchFn, calls } = fakeFetch({
      status: 200,
      body: { id: "cal@group.calendar.google.com", summary: "Cleaning" },
    });
    const client = createGoogleCalendarClient("token-1", fetchFn);

    await expect(
      client.createCalendar({ summary: "Cleaning", timeZone: "America/Bogota" }),
    ).resolves.toEqual({ id: "cal@group.calendar.google.com", summary: "Cleaning" });
    expect(calls[0]?.method).toBe("POST");
    expect(calls[0]?.url).toBe(`${API}/calendars`);
    expect(calls[0]?.body).toEqual({ summary: "Cleaning", timeZone: "America/Bogota" });
    expect(calls[0]?.headers.get("authorization")).toBe("Bearer token-1");
  });

  it("AC2: puts an event at its derived id, confirmed", async () => {
    const { fetchFn, calls } = fakeFetch({ status: 200, body: {} });
    await createGoogleCalendarClient("t", fetchFn).putEvent("cal@group.calendar.google.com", event);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.method).toBe("PUT");
    expect(calls[0]?.url).toBe(`${API}/calendars/cal%40group.calendar.google.com/events/abc123`);
    expect(calls[0]?.body).toEqual({ ...event, status: "confirmed" });
  });

  it("AC2: inserts the event when the put finds no event with that id", async () => {
    const { fetchFn, calls } = fakeFetch({ status: 404 }, { status: 200, body: {} });
    await createGoogleCalendarClient("t", fetchFn).putEvent("cal", event);

    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      `PUT ${API}/calendars/cal/events/abc123`,
      `POST ${API}/calendars/cal/events`,
    ]);
    expect(calls[1]?.body).toEqual({ ...event, status: "confirmed" });
  });

  it("updates again when the insert races another write of the same id", async () => {
    const { fetchFn, calls } = fakeFetch(
      { status: 404 },
      { status: 409 },
      { status: 200, body: {} },
    );
    await createGoogleCalendarClient("t", fetchFn).putEvent("cal", event);
    expect(calls.map((c) => c.method)).toEqual(["PUT", "POST", "PUT"]);
  });

  it("AC2: reports a missing calendar as gone so the sync can recreate it", async () => {
    const { fetchFn } = fakeFetch({ status: 404 }, { status: 404 });
    const error = await rejection(createGoogleCalendarClient("t", fetchFn).putEvent("cal", event));
    expect(error.kind).toBe("gone");
  });

  it("AC3: deletes an event and ignores one that's already gone", async () => {
    const { fetchFn, calls } = fakeFetch({ status: 204 }, { status: 410 });
    const client = createGoogleCalendarClient("t", fetchFn);
    await client.deleteEvent("cal", "abc123");
    await client.deleteEvent("cal", "abc123");
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      `DELETE ${API}/calendars/cal/events/abc123`,
      `DELETE ${API}/calendars/cal/events/abc123`,
    ]);
  });

  it("AC4: lists selected calendars across pages", async () => {
    const { fetchFn, calls } = fakeFetch(
      {
        status: 200,
        body: {
          items: [
            { id: "primary@example.com", summary: "Me", primary: true },
            { id: "hidden", summary: "Hidden", selected: false },
          ],
          nextPageToken: "p2",
        },
      },
      { status: 200, body: { items: [{ id: "work", summary: "Work", selected: true }] } },
    );
    await expect(createGoogleCalendarClient("t", fetchFn).listCalendars()).resolves.toEqual([
      { id: "primary@example.com", summary: "Me", selected: true },
      { id: "hidden", summary: "Hidden", selected: false },
      { id: "work", summary: "Work", selected: true },
    ]);
    expect(new URL(calls[1]?.url ?? "").searchParams.get("pageToken")).toBe("p2");
  });

  it("AC4: asks free/busy for the given calendars only and returns their busy times", async () => {
    const { fetchFn, calls } = fakeFetch({
      status: 200,
      body: {
        calendars: {
          a: { busy: [{ start: "2026-10-27T11:00:00Z", end: "2026-10-27T12:00:00Z" }] },
          b: { errors: [{ reason: "notFound" }], busy: [] },
        },
      },
    });
    const busy = await createGoogleCalendarClient("t", fetchFn).queryBusy({
      calendarIds: ["a", "b"],
      timeMin: new Date("2026-10-27T00:00:00Z"),
      timeMax: new Date("2026-10-28T00:00:00Z"),
      timeZone: "America/Bogota",
    });

    expect(busy).toEqual([
      { start: new Date("2026-10-27T11:00:00Z"), end: new Date("2026-10-27T12:00:00Z") },
    ]);
    expect(calls[0]?.url).toBe(`${API}/freeBusy`);
    expect(calls[0]?.body).toEqual({
      timeMin: "2026-10-27T00:00:00.000Z",
      timeMax: "2026-10-28T00:00:00.000Z",
      timeZone: "America/Bogota",
      items: [{ id: "a" }, { id: "b" }],
    });
  });

  it("doesn't call free/busy without calendars", async () => {
    const { fetchFn, calls } = fakeFetch();
    const busy = await createGoogleCalendarClient("t", fetchFn).queryBusy({
      calendarIds: [],
      timeMin: new Date(),
      timeMax: new Date(),
      timeZone: "UTC",
    });
    expect(busy).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it("AC6: deletes the calendar and revokes the token", async () => {
    const { fetchFn, calls } = fakeFetch({ status: 204 }, { status: 200 });
    const client = createGoogleCalendarClient("token-1", fetchFn);
    await client.deleteCalendar("cal");
    await client.revoke();

    expect(calls[0]?.method).toBe("DELETE");
    expect(calls[0]?.url).toBe(`${API}/calendars/cal`);
    expect(calls[1]?.method).toBe("POST");
    expect(calls[1]?.url).toBe("https://oauth2.googleapis.com/revoke");
    expect(calls[1]?.body).toBe("token=token-1");
  });

  it("AC6: treats a token that's already revoked as revoked", async () => {
    const { fetchFn } = fakeFetch({ status: 400, body: { error: "invalid_token" } });
    await expect(createGoogleCalendarClient("t", fetchFn).revoke()).resolves.toBeUndefined();
  });

  it("AC7: classifies 401, lost scopes, and invalid_grant as auth", async () => {
    const cases = [
      { status: 401, body: { error: { code: 401 } } },
      {
        status: 403,
        body: { error: { code: 403, errors: [{ reason: "insufficientPermissions" }] } },
      },
      { status: 400, body: { error: "invalid_grant" } },
    ];
    for (const response of cases) {
      const { fetchFn } = fakeFetch(response);
      const error = await rejection(createGoogleCalendarClient("t", fetchFn).getCalendar("cal"));
      expect(error.kind).toBe("auth");
    }
  });

  it("AC7: classifies 404 and 410 as gone", async () => {
    for (const status of [404, 410]) {
      const { fetchFn } = fakeFetch({ status });
      const error = await rejection(createGoogleCalendarClient("t", fetchFn).getCalendar("cal"));
      expect(error.kind).toBe("gone");
    }
  });

  it("AC7: classifies rate limits, server errors, and network failures as transient", async () => {
    const cases = [
      { status: 403, body: { error: { errors: [{ reason: "rateLimitExceeded" }] } } },
      { status: 429 },
      { status: 503 },
      new TypeError("fetch failed"),
    ];
    for (const response of cases) {
      const { fetchFn } = fakeFetch(response);
      const error = await rejection(createGoogleCalendarClient("t", fetchFn).getCalendar("cal"));
      expect(error.kind).toBe("transient");
    }
  });
});
