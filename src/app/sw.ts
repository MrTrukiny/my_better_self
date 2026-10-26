/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const OFFLINE_DOCUMENT_ROUTES = ["/rooms", "/tasks", "/home-profile"];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Inventory and task RSC payloads are keyed by the router state they were fetched from, so a
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
