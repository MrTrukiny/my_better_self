import { formatTime, parseTime } from "@/lib/scheduler/dates";

export type Slot = { start: string; end: string };

/**
 * Back-to-back slots from the session's start time, one per task in order, using estimated
 * minutes. They are the plan, so a task's status doesn't move them. Null without a start time.
 */
export function sessionSlots(
  start: string | null,
  tasks: readonly { minutes: number }[],
): (Slot | null)[] {
  const startMinutes = start === null ? null : parseTime(start);
  if (startMinutes === null) {
    return tasks.map(() => null);
  }
  let minutes = startMinutes;
  return tasks.map((task) => {
    const slot = { start: formatTime(minutes), end: formatTime(minutes + task.minutes) };
    minutes += task.minutes;
    return slot;
  });
}
