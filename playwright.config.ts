import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

if (!process.env.CI && existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    // Service workers and offline behavior are only reliable in a production build.
    command: `pnpm db:migrate && pnpm build && pnpm start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    // Sessions created by the e2e auth instance are bound to this origin.
    env: { BETTER_AUTH_URL: baseURL },
  },
});
