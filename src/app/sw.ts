/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";
import { openToday, parsePush, showReminder } from "@/lib/notifications/worker";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// `/` only matches the Today page itself: the check below adds a slash for nested routes.
const OFFLINE_DOCUMENT_ROUTES = [
  "/",
  "/earlier-days",
  "/rooms",
  "/tasks",
  "/home-profile",
  "/plan",
  "/schedule",
  "/notifications",
  "/settings",
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Today, inventory, task, plan, and settings RSC payloads are keyed by the router state they were fetched from, so a
    // cached one can be stale offline. These pages are read offline from documents instead; see
    // docs/decisions/0005-offline-inventory-reading.md.
    {
      matcher: ({ request, url, sameOrigin }) =>
        sameOrigin &&
        request.headers.get("RSC") === "1" &&
        OFFLINE_DOCUMENT_ROUTES.some(
          (route) => url.pathname === route || url.pathname.startsWith(`${route}/`),
        ),
      handler: new NetworkOnly(),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();

self.addEventListener("push", (event) => {
  event.waitUntil(showReminder(self.registration, parsePush(event.data)));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(openToday(self.clients, self.location.origin));
});
