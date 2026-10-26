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
 * Goes offline and waits for the current page to notice, so the next navigation doesn't race
 * with Next reloading the current page from cache.
 */
export async function goOffline(page: Page, context: BrowserContext) {
  await context.setOffline(true);
  await expect(page.getByText(OFFLINE_NOTICE).first()).toBeVisible();
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
