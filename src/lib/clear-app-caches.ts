/**
 * Deletes the service worker's runtime caches, which can hold signed-in pages.
 * The precache only has static assets and the offline page, so it is kept.
 */
export async function clearAppCaches(): Promise<void> {
  if (typeof caches === "undefined") {
    return;
  }
  const names = await caches.keys();
  await Promise.all(
    names.filter((name) => !name.includes("precache")).map((name) => caches.delete(name)),
  );
}
