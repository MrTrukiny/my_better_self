import type { ReminderKind } from "@/db/schema/notifications";
import {
  type DayNumber,
  formatTime,
  parseTime,
  toDayNumber,
  toIsoDate,
  zonedNow,
} from "@/lib/scheduler/dates";
import { type ScheduleSettings, startTimeFor } from "@/lib/scheduler/settings";

export const BEFORE_MINUTES_OPTIONS = [0, 5, 15, 30] as const;

export type NotificationPrefs = {
  beforeEnabled: boolean;
  /** One of `BEFORE_MINUTES_OPTIONS`. */
  beforeMinutes: number;
  eveningEnabled: boolean;
  /** "HH:MM" in the schedule's time zone. */
  eveningTime: string;
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  beforeEnabled: true,
  beforeMinutes: 15,
  eveningEnabled: true,
  eveningTime: "20:00",
};

/** How far ahead reminders are queued: past the next daily job, which may run an hour late. */
export const SCHEDULE_WINDOW_HOURS = 26;
/** A message delivered later than this is dropped instead of nudging at the wrong time. */
const LATE_MINUTES = 30;
const EARLY_TOLERANCE_MS = 60_000;
const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

export type DayReminder = { kind: ReminderKind; time: string };
export type ReminderMessage = DayReminder & { date: string };
export type UpcomingReminder = ReminderMessage & { at: Date };

/** The UTC instant of `minutes` after midnight of `day` in `timeZone`. */
export function zonedInstant(timeZone: string, day: DayNumber, minutes: number): Date {
  const asUtc = day * MS_PER_DAY + minutes * MS_PER_MINUTE;
  const first = asUtc - offsetAt(timeZone, asUtc);
  const second = asUtc - offsetAt(timeZone, first);
  return new Date(second);
}

/** How far `timeZone`'s wall clock is ahead of UTC at `instant`, in milliseconds. */
function offsetAt(timeZone: string, instant: number): number {
  const whole = Math.floor(instant / MS_PER_MINUTE) * MS_PER_MINUTE;
  const local = zonedNow(timeZone, new Date(whole));
  return local.day * MS_PER_DAY + local.minutes * MS_PER_MINUTE - whole;
}

/** The reminders of `day` with their local times. A day off has no session reminder. */
export function remindersOf(
  settings: ScheduleSettings,
  prefs: NotificationPrefs,
  day: DayNumber,
): DayReminder[] {
  const reminders: DayReminder[] = [];
  const start = startTimeFor(settings, day);
  const startMinutes = start === null ? null : parseTime(start);
  if (prefs.beforeEnabled && startMinutes !== null) {
    reminders.push({
      kind: "before",
      time: formatTime(Math.max(0, startMinutes - prefs.beforeMinutes)),
    });
  }
  if (prefs.eveningEnabled) {
    reminders.push({ kind: "evening", time: prefs.eveningTime });
  }
  return reminders;
}

/** Reminders due after `now` and within the scheduling window, in time order. */
export function upcomingReminders(
  settings: ScheduleSettings,
  prefs: NotificationPrefs,
  now: Date,
): UpcomingReminder[] {
  const today = zonedNow(settings.timeZone, now).day;
  const until = now.getTime() + SCHEDULE_WINDOW_HOURS * 60 * MS_PER_MINUTE;
  const upcoming: UpcomingReminder[] = [];
  for (let day = today; day <= today + 2; day++) {
    for (const reminder of remindersOf(settings, prefs, day)) {
      const minutes = parseTime(reminder.time);
      if (minutes === null) {
        continue;
      }
      const at = zonedInstant(settings.timeZone, day, minutes);
      if (at.getTime() > now.getTime() && at.getTime() <= until) {
        upcoming.push({ ...reminder, date: toIsoDate(day), at });
      }
    }
  }
  return upcoming.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** Today's cleaning tasks: all of them, and the ones still scheduled with their minutes. */
export type ReminderDay = { total: number; open: number; openMinutes: number };

export type ReminderDecision =
  | { send: true; title: string; body: string }
  | { send: false; reason: "stale" | "early" | "late" | "nothing" | "handled" };

/**
 * Whether a queued reminder still applies when it arrives, and its text. The message is stale
 * when the current settings no longer put this reminder at this time on this day.
 */
export function reminderDecision(
  message: ReminderMessage,
  context: {
    settings: ScheduleSettings;
    prefs: NotificationPrefs;
    now: Date;
    day: ReminderDay;
  },
): ReminderDecision {
  const { settings, prefs, now, day } = context;
  const date = toDayNumber(message.date);
  const current = remindersOf(settings, prefs, date).find((r) => r.kind === message.kind);
  const minutes = parseTime(message.time);
  if (!current || current.time !== message.time || minutes === null) {
    return { send: false, reason: "stale" };
  }
  const at = zonedInstant(settings.timeZone, date, minutes).getTime();
  if (now.getTime() < at - EARLY_TOLERANCE_MS) {
    return { send: false, reason: "early" };
  }
  if (now.getTime() > at + LATE_MINUTES * MS_PER_MINUTE) {
    return { send: false, reason: "late" };
  }
  if (message.kind === "before") {
    if (day.open === 0) {
      return { send: false, reason: "nothing" };
    }
    return {
      send: true,
      title:
        prefs.beforeMinutes === 0
          ? "Cleaning starts now"
          : `Cleaning in ${prefs.beforeMinutes} min`,
      body: `${tasks(day.open)}, ${day.openMinutes} min`,
    };
  }
  if (day.total === 0) {
    return { send: false, reason: "nothing" };
  }
  if (day.open < day.total) {
    return { send: false, reason: "handled" };
  }
  return { send: true, title: "Your streak is waiting", body: `${tasks(day.open)} left today` };
}

function tasks(count: number): string {
  return `${count} ${count === 1 ? "task" : "tasks"}`;
}
