/**
 * The scheduler works in whole days: a day number counts days since 1970-01-01, so arithmetic
 * never crosses daylight saving or time zone boundaries. Weekdays are Monday first (0) to
 * Sunday (6).
 */
export type DayNumber = number;

const MS_PER_DAY = 86_400_000;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function toDayNumber(isoDate: string): DayNumber {
  const [year, month, day] = isoDate.split("-").map(Number);
  return Math.round(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1) / MS_PER_DAY);
}

export function toIsoDate(day: DayNumber): string {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

export function weekdayIndex(day: DayNumber): number {
  // 1970-01-01 was a Thursday (index 3).
  return (((day + 3) % 7) + 7) % 7;
}

export function isWeekend(day: DayNumber): boolean {
  return weekdayIndex(day) >= 5;
}

/** Minutes since midnight for "HH:MM", or null when it isn't a valid 24-hour time. */
export function parseTime(time: string): number | null {
  const match = TIME_PATTERN.exec(time);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function formatTime(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  const hours = Math.floor(wrapped / 60);
  return `${String(hours).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Today's day number and the minutes since midnight, in `timeZone`. */
export function zonedNow(timeZone: string, now: Date): { day: DayNumber; minutes: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  return {
    day: toDayNumber(`${parts.year}-${parts.month}-${parts.day}`),
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}
