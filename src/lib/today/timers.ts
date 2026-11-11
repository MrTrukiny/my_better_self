import { ACTUAL_MINUTES } from "./schemas";

/**
 * Task timers (spec 016), keyed by occurrence id. They live on the device only. A running
 * timer stores when it started, so it keeps counting while the app is closed.
 */
export type TimerEntry = {
  /** The occurrence's date, so a timer left from an earlier day can be told apart. */
  date: string;
  /** Time counted before the current run. */
  elapsedMs: number;
  /** When the current run started, or null while paused. */
  startedAt: number | null;
};

export type Timers = Readonly<Record<string, TimerEntry>>;

const MS_PER_MINUTE = 60_000;

export function elapsedMs(entry: TimerEntry, now: number): number {
  return entry.elapsedMs + (entry.startedAt === null ? 0 : Math.max(0, now - entry.startedAt));
}

export function runningTimer(timers: Timers): string | null {
  return Object.keys(timers).find((id) => timers[id]?.startedAt !== null) ?? null;
}

export function pauseTimer(timers: Timers, id: string, now: number): Timers {
  const entry = timers[id];
  if (!entry || entry.startedAt === null) {
    return timers;
  }
  return { ...timers, [id]: { ...entry, elapsedMs: elapsedMs(entry, now), startedAt: null } };
}

/** Starts or resumes a timer; only one runs at a time, so a running one is paused first. */
export function startTimer(timers: Timers, id: string, date: string, now: number): Timers {
  const running = runningTimer(timers);
  const paused = running && running !== id ? pauseTimer(timers, running, now) : timers;
  const entry = paused[id];
  if (entry?.startedAt != null) {
    return paused;
  }
  return { ...paused, [id]: { date, elapsedMs: entry?.elapsedMs ?? 0, startedAt: now } };
}

export function clearTimer(timers: Timers, id: string): Timers {
  if (!(id in timers)) {
    return timers;
  }
  const { [id]: _, ...rest } = timers;
  return rest;
}

/** Whole minutes for a measured time, within the range a done task can record. */
export function timerMinutes(ms: number): { minutes: number; capped: boolean } {
  const minutes = Math.max(ACTUAL_MINUTES.min, Math.round(ms / MS_PER_MINUTE));
  return minutes > ACTUAL_MINUTES.max
    ? { minutes: ACTUAL_MINUTES.max, capped: true }
    : { minutes, capped: false };
}

export function stopTimer(
  timers: Timers,
  id: string,
  now: number,
): { timers: Timers; minutes: number; capped: boolean } | null {
  const entry = timers[id];
  if (!entry) {
    return null;
  }
  return { timers: clearTimer(timers, id), ...timerMinutes(elapsedMs(entry, now)) };
}

/** "04:12", or "1:15:05" past an hour. */
export function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const seconds = String(total % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`;
}

export function parseTimers(raw: string | null): Timers {
  try {
    const parsed: unknown = JSON.parse(raw ?? "{}");
    if (typeof parsed !== "object" || parsed === null) {
      return {};
    }
    return Object.fromEntries(Object.entries(parsed).filter(([, value]) => isTimerEntry(value)));
  } catch {
    return {};
  }
}

function isTimerEntry(value: unknown): value is TimerEntry {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const { date, elapsedMs, startedAt } = value as Record<string, unknown>;
  return (
    typeof date === "string" &&
    typeof elapsedMs === "number" &&
    elapsedMs >= 0 &&
    (startedAt === null || typeof startedAt === "number")
  );
}
