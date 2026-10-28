import { APP_NAME } from "@/lib/app-config";

/** Push and notification-click handling for the service worker (`src/app/sw.ts`). */

export type PushReminder = { title: string; body: string; tag: string };

const ICON = "/icons/icon-192.png";
const GENERIC: PushReminder = {
  title: APP_NAME,
  body: "Time to check today's cleaning.",
  tag: "reminder",
};

export function parsePush(data: { json(): unknown } | null): PushReminder {
  try {
    const value = data?.json() as Partial<PushReminder> | undefined;
    if (value && typeof value.title === "string" && typeof value.body === "string") {
      return { title: value.title, body: value.body, tag: value.tag ?? GENERIC.tag };
    }
  } catch {
    // Fall through to the generic reminder.
  }
  return GENERIC;
}

export function showReminder(
  registration: { showNotification(title: string, options: NotificationOptions): Promise<void> },
  reminder: PushReminder,
): Promise<void> {
  return registration.showNotification(reminder.title, {
    body: reminder.body,
    tag: reminder.tag,
    icon: ICON,
    badge: ICON,
  });
}

type WindowLike = {
  url: string;
  focus(): Promise<unknown>;
  navigate(url: string): Promise<unknown>;
};

/** Every reminder is about today's session, so a tap always lands on Today. */
export async function openToday(
  clients: {
    matchAll(options: {
      type: "window";
      includeUncontrolled: boolean;
    }): Promise<readonly WindowLike[]>;
    openWindow(url: string): Promise<unknown>;
  },
  origin: string,
): Promise<void> {
  const today = new URL("/", origin).toString();
  const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
  const open = windows.find((window) => window.url.startsWith(origin));
  if (open) {
    try {
      await open.focus();
      await open.navigate(today);
      return;
    } catch {
      // An uncontrolled window can't be navigated from here; open a new one instead.
    }
  }
  await clients.openWindow(today);
}
