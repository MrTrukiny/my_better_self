import { createHash } from "node:crypto";
import { APP_NAME } from "@/lib/app-config";
import { formatTime, parseTime, toDayNumber, toIsoDate } from "@/lib/scheduler/dates";
import { type PlanDayView, planTarget } from "@/lib/scheduler/format";
import { formatMinutes } from "@/lib/tasks/format";

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_DAY = 1440;
const BASE32HEX = "0123456789abcdefghijklmnopqrstuv";

/** A wall-clock time in the owner's zone, as Google Calendar takes it. */
export type EventTime = { dateTime: string; timeZone: string };

export type CalendarEvent = {
  id: string;
  date: string;
  summary: string;
  description: string;
  start: EventTime;
  end: EventTime;
  startsAt: Date;
  endsAt: Date;
  digest: string;
};

/** The instant at `minutes` past midnight of `isoDate` in `timeZone`, minutes may pass 24 h. */
export function zonedTimeToUtc(isoDate: string, minutes: number, timeZone: string): Date {
  const wallClock =
    toDayNumber(isoDate) * MINUTES_PER_DAY * MS_PER_MINUTE + minutes * MS_PER_MINUTE;
  // Correct the guess by the zone's offset there; a second pass settles DST transitions.
  const first = wallClock - offsetAt(timeZone, wallClock);
  const second = wallClock - offsetAt(timeZone, first);
  return new Date(second);
}

/** How far `timeZone` is ahead of UTC at `instant`, in milliseconds. */
function offsetAt(timeZone: string, instant: number): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(instant))
      .map((part) => [part.type, Number(part.value)]),
  );
  const asUtc = Date.UTC(
    parts.year ?? 1970,
    (parts.month ?? 1) - 1,
    parts.day ?? 1,
    parts.hour ?? 0,
    parts.minute ?? 0,
    parts.second ?? 0,
  );
  return asUtc - (instant - (instant % 1000));
}

/**
 * Event ids derive from the user and the date, so writing a day again always targets the same
 * event and a lost row can't create a duplicate. Google allows base32hex, 5 to 1024 characters.
 */
export function eventIdFor(userId: string, isoDate: string): string {
  return base32hex(createHash("sha256").update(`${userId}:${isoDate}`).digest());
}

function base32hex(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32HEX[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += BASE32HEX[(value << (5 - bits)) & 31];
  }
  return out;
}

/** The day's event, or null when the day is off or has nothing to clean. */
export function buildEvent(
  day: PlanDayView,
  { userId, timeZone, appUrl }: { userId: string; timeZone: string; appUrl: string },
): CalendarEvent | null {
  const startMinutes = day.start === null ? null : parseTime(day.start);
  if (day.off || startMinutes === null || day.cleaning.length === 0) {
    return null;
  }
  const endMinutes = startMinutes + day.total;
  const summary = `Cleaning, ${formatMinutes(day.total)}`;
  const description = eventDescription(day, appUrl);
  const start = { dateTime: localDateTime(day.date, startMinutes), timeZone };
  const end = { dateTime: localDateTime(day.date, endMinutes), timeZone };
  return {
    id: eventIdFor(userId, day.date),
    date: day.date,
    summary,
    description,
    start,
    end,
    startsAt: zonedTimeToUtc(day.date, startMinutes, timeZone),
    endsAt: zonedTimeToUtc(day.date, endMinutes, timeZone),
    digest: createHash("sha256")
      .update(JSON.stringify([summary, description, start, end]))
      .digest("base64url"),
  };
}

function eventDescription(day: PlanDayView, appUrl: string): string {
  const lines = day.cleaning.map(
    (task) => `${task.name} (${planTarget(task)}), ${formatMinutes(task.minutes)}`,
  );
  if (day.routines.length > 0) {
    lines.push("", `Also today: ${day.routines.map((task) => task.name).join(", ")}`);
  }
  lines.push("", `Open ${APP_NAME}: ${new URL("/plan", appUrl).toString()}`);
  return lines.join("\n");
}

/** "2026-10-27T06:30:00" for minutes past midnight of `isoDate`, rolling into the next day. */
function localDateTime(isoDate: string, minutes: number): string {
  const date = toIsoDate(toDayNumber(isoDate) + Math.floor(minutes / MINUTES_PER_DAY));
  return `${date}T${formatTime(minutes)}:00`;
}
