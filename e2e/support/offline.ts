import { type BrowserContext, expect, type Page } from "@playwright/test";

export const OFFLINE_NOTICE =
  "You're offline. You can browse what's saved, but changes need a connection.";

/** Reloads once the service worker is ready, so it controls the page from then on. */
export async function controlWithServiceWorker(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
}

/**
 * Goes offline and opens `path` as a full page load, the way `OfflineAwareLink` navigates offline.
 *
 * The current page is left before the network drops. If it is still streaming a Server Action
 * result or an RSC payload when that happens, Next recovers by reloading the current URL, and that
 * late reload can replace the navigation to `path`.
 */
export async function openOffline(page: Page, context: BrowserContext, path: string) {
  await page.goto("about:blank");
  await context.setOffline(true);
  await page.goto(path);
}

/** Waits until the service worker holds a copy of `path` that contains `text`. */
export async function expectCachedPage(page: Page, path: string, text: string) {
  await expect
    .poll(() =>
      page.evaluate(
        async ([url, expected]) => {
          const cached = await caches.match(url);
          return cached ? (await cached.text()).includes(expected) : false;
        },
        [path, text],
      ),
    )
    .toBe(true);
}
