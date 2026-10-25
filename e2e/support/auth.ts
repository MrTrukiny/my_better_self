import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { testUtils } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../../src/db/schema";

/**
 * Test-only Better Auth instance with `testUtils`, sharing the app's database and secret
 * so the sessions it creates are valid for the server under test. Never import from `src/`.
 */
export function createTestAuth({ baseURL }: { baseURL: string }) {
  const pool = new Pool({ connectionString: requireEnv("DATABASE_URL"), max: 2 });
  const auth = betterAuth({
    baseURL,
    secret: requireEnv("BETTER_AUTH_SECRET"),
    database: drizzleAdapter(drizzle({ client: pool, schema }), { provider: "pg", schema }),
    plugins: [testUtils()],
  });
  return { auth, close: () => pool.end() };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set for e2e tests (see .env.example).`);
  }
  return value;
}
