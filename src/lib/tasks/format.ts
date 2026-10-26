import type { TaskEntry } from "./queries";

export function formatFrequency(days: number): string {
  if (days === 1) {
    return "Every day";
  }
  if (days === 365) {
    return "Every year";
  }
  if (days % 30 === 0) {
    return days === 30 ? "Every month" : `Every ${days / 30} months`;
  }
  if (days % 7 === 0 && days < 28) {
    return days === 7 ? "Every week" : `Every ${days / 7} weeks`;
  }
  return `Every ${days} days`;
}

export function formatMinutes(minutes: number): string {
  return `${minutes} min`;
}

/** What a task belongs to, within its room group. */
export function targetLabel(entry: TaskEntry): string {
  if (entry.itemName) {
    return entry.itemName;
  }
  return entry.roomId ? "Whole room" : "Whole home";
}

export type TaskGroup = { id: string; title: string; entries: TaskEntry[] };

/** Groups by room, with the whole home first and rooms in `roomOrder` (inventory order). */
export function groupByTarget(entries: TaskEntry[], roomOrder: string[]): TaskGroup[] {
  const home: TaskGroup = { id: "home", title: "Whole home", entries: [] };
  const rooms = new Map<string, TaskGroup>();
  for (const entry of entries) {
    if (!entry.roomId) {
      home.entries.push(entry);
      continue;
    }
    let group = rooms.get(entry.roomId);
    if (!group) {
      group = { id: entry.roomId, title: entry.roomName ?? "Room", entries: [] };
      rooms.set(entry.roomId, group);
    }
    group.entries.push(entry);
  }
  const rank = (id: string) => {
    const index = roomOrder.indexOf(id);
    return index === -1 ? roomOrder.length : index;
  };
  const sortedRooms = [...rooms.values()].sort((a, b) => rank(a.id) - rank(b.id));
  return [home, ...sortedRooms].filter((group) => group.entries.length > 0);
}

/** Average minutes per day the tasks take, given how often each one comes back. */
export function dailyMinutes(entries: TaskEntry[]): number {
  return Math.round(entries.reduce((sum, entry) => sum + entry.minutes / entry.frequencyDays, 0));
}
