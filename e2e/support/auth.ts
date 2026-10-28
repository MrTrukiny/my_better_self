import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { testUtils } from "better-auth/plugins";
import { and, eq, like, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../../src/db/schema";
import { SESSION_OPTIONS } from "../../src/lib/app-config";

/** Every e2e owner gets an address like this; `example.com` never belongs to a real account. */
export const E2E_EMAIL_PATTERN = "e2e-%@example.com";

/**
 * Test-only Better Auth instance with `testUtils`, sharing the app's database and secret
 * so the sessions it creates are valid for the server under test. Never import from `src/`.
 */
export function createTestAuth({ baseURL }: { baseURL: string }) {
  const pool = new Pool({ connectionString: requireEnv("DATABASE_URL"), max: 2 });
  const db = drizzle({ client: pool, schema });
  const auth = betterAuth({
    baseURL,
    secret: requireEnv("BETTER_AUTH_SECRET"),
    database: drizzleAdapter(db, { provider: "pg", schema }),
    // Sessions it creates match the app's, so the server doesn't refresh them on the first request.
    session: SESSION_OPTIONS,
    plugins: [testUtils()],
  });
  return {
    auth,
    /** Deletes an owner in one statement; sessions and app data go with it (ON DELETE CASCADE). */
    deleteUser: async (userId: string) => {
      await db.delete(schema.user).where(eq(schema.user.id, userId));
    },
    /**
     * Deletes e2e owners left behind by runs that were killed or failed to clean up. Only owners
     * older than an hour, so a run in progress elsewhere against the same database keeps its own.
     */
    deleteStaleUsers: async () => {
      await db
        .delete(schema.user)
        .where(
          and(
            like(schema.user.email, E2E_EMAIL_PATTERN),
            lt(schema.user.createdAt, sql`now() - interval '1 hour'`),
          ),
        );
    },
    /**
     * Moves the owner's first planned day `days` back, so a test can work with a past session.
     * Sessions can't be planned in the past through the app.
     */
    moveFirstDayBack: async (userId: string, days: number) => {
      await db.execute(sql`
        update ${schema.occurrence}
        set date = date - ${days}::int
        where user_id = ${userId}
          and date = (select min(date) from ${schema.occurrence} where user_id = ${userId})
      `);
    },
    /**
     * Records done times for a task on the days before the owner's first planned day, newest
     * first, as if they had been checked off then.
     */
    recordPastTimes: async (userId: string, taskName: string, minutes: number[]) => {
      await db.execute(sql`
        insert into ${schema.occurrence}
          (id, user_id, task_id, date, status, completed_at, actual_minutes, planned_minutes)
        select gen_random_uuid()::text, t.user_id, t.id,
          (select min(date) from ${schema.occurrence} where user_id = ${userId}) - n.i::int,
          'done', now(), n.m, t.minutes
        from ${schema.task} t,
          unnest(${`{${minutes.join(",")}}`}::int[]) with ordinality as n(m, i)
        where t.user_id = ${userId} and t.name = ${taskName}
      `);
    },
    close: () => pool.end(),
  };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set for e2e tests (see .env.example).`);
  }
  return value;
}
