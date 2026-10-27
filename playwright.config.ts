import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
import { E2E_CRON_SECRET } from "./e2e/support/calendar";

if (!process.env.CI && existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

// E2E_PORT lets several checkouts run their suites side by side.
const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  // Local runs use the Neon dev branch over the internet, so every render and Server Action pays
  // several network round trips; CI talks to Postgres on the same machine.
  expect: { timeout: process.env.CI ? 5_000 : 10_000 },
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
    command: `pnpm db:migrate && pnpm build && pnpm exec next start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    // Sessions created by the e2e auth instance are bound to this origin. AI_FAKE swaps Gemini
    // for deterministic proposals and CALENDAR_FAKE swaps Google Calendar for an in-memory fake,
    // so e2e never calls Google.
    env: {
      BETTER_AUTH_URL: baseURL,
      AI_FAKE: "1",
      CALENDAR_FAKE: "1",
      CRON_SECRET: E2E_CRON_SECRET,
    },
  },
});
