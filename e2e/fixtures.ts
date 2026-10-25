import { test as base } from "@playwright/test";
import { createTestAuth } from "./support/auth";

type SignedInUser = { id: string; name: string; email: string };

type WorkerFixtures = {
  testAuth: ReturnType<typeof createTestAuth>["auth"];
};

type TestFixtures = {
  /** Creates an owner in the database and adds its session cookies to the browser context. */
  signedInUser: SignedInUser;
};

export const test = base.extend<TestFixtures, WorkerFixtures>({
  testAuth: [
    // biome-ignore lint/correctness/noEmptyPattern: Playwright requires a destructuring pattern.
    async ({}, use, workerInfo) => {
      const baseURL = workerInfo.project.use.baseURL;
      if (!baseURL) {
        throw new Error("Playwright baseURL is required for e2e auth.");
      }
      const { auth, close } = createTestAuth({ baseURL });
      await use(auth);
      await close();
    },
    { scope: "worker" },
  ],

  signedInUser: async ({ testAuth, context }, use, testInfo) => {
    const { test: helpers } = await testAuth.$context;
    const user = helpers.createUser({
      name: "E2E Owner",
      email: `e2e-${testInfo.workerIndex}-${testInfo.testId}@example.com`.toLowerCase(),
    });
    await helpers.saveUser(user);
    await context.addCookies(await helpers.getCookies({ userId: user.id, domain: "localhost" }));

    await use({ id: user.id, name: user.name, email: user.email });

    await helpers.deleteUser(user.id);
  },
});

export { expect } from "@playwright/test";
