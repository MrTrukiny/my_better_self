import { randomUUID } from "node:crypto";
import { type BrowserContext, test as base, type TestInfo } from "@playwright/test";
import { createTestAuth } from "./support/auth";

type Owner = { id: string; name: string; email: string };
type TestAuth = ReturnType<typeof createTestAuth>;
type Cookies = Parameters<BrowserContext["addCookies"]>[0];

type WorkerFixtures = {
  testAuth: TestAuth;
};

type TestFixtures = {
  /**
   * Creates an owner in the database with a unique email and returns cookies for its session.
   * Every owner created this way is deleted after the test.
   */
  createOwner: (name: string) => Promise<{ owner: Owner; cookies: Cookies }>;
  /** Creates an owner and adds its session cookies to the browser context. */
  signedInUser: Owner;
};

/** Cleanup gets its own budget, so a slow database can't push the test past its timeout. */
const CLEANUP_TIMEOUT = 20_000;

export const test = base.extend<TestFixtures, WorkerFixtures>({
  testAuth: [
    // biome-ignore lint/correctness/noEmptyPattern: Playwright requires a destructuring pattern.
    async ({}, use, workerInfo) => {
      const baseURL = workerInfo.project.use.baseURL;
      if (!baseURL) {
        throw new Error("Playwright baseURL is required for e2e auth.");
      }
      const testAuth = createTestAuth({ baseURL });
      await testAuth.deleteStaleUsers();
      await use(testAuth);
      await testAuth.close();
    },
    { scope: "worker" },
  ],

  createOwner: [
    async ({ testAuth }, use, testInfo) => {
      const { test: helpers } = await testAuth.auth.$context;
      const created: string[] = [];
      await use(async (name) => {
        const user = helpers.createUser({ name, email: `e2e-${randomUUID()}@example.com` });
        await helpers.saveUser(user);
        created.push(user.id);
        const cookies = await helpers.getCookies({ userId: user.id, domain: "localhost" });
        return { owner: { id: user.id, name: user.name, email: user.email }, cookies };
      });
      await deleteOwners(testAuth, created, testInfo);
    },
    { timeout: CLEANUP_TIMEOUT + 10_000 },
  ],

  signedInUser: async ({ createOwner, context }, use) => {
    const { owner, cookies } = await createOwner("E2E Owner");
    await context.addCookies(cookies);
    await use(owner);
  },
});

/**
 * A failed cleanup only warns: the emails are unique, so a leftover owner can't clash with a later
 * run, and the next worker to start deletes it once it is stale.
 */
async function deleteOwners(testAuth: TestAuth, ids: string[], testInfo: TestInfo) {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`timed out after ${CLEANUP_TIMEOUT} ms`)),
      CLEANUP_TIMEOUT,
    );
  });
  try {
    await Promise.race([Promise.all(ids.map((id) => testAuth.deleteUser(id))), timeout]);
  } catch (error) {
    const description = `Couldn't delete e2e owners ${ids.join(", ")}: ${String(error)}`;
    testInfo.annotations.push({ type: "warning", description });
    console.warn(description);
  } finally {
    clearTimeout(timer);
  }
}

export { expect } from "@playwright/test";
