import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { isEmailAllowed, parseAllowlist } from "@/lib/allowlist";
import { EMAIL_NOT_ALLOWED } from "@/lib/auth-errors";
import { getEnv } from "@/lib/env";

const env = getEnv();
const allowlist = parseAllowlist(env.ALLOWED_EMAILS);

const DAY_IN_SECONDS = 60 * 60 * 24;

function rejectNotAllowed(): never {
  throw new APIError("FORBIDDEN", {
    code: EMAIL_NOT_ALLOWED,
    message: "This account is not on the allowlist.",
  });
}

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      prompt: "select_account",
    },
  },
  session: {
    expiresIn: 30 * DAY_IN_SECONDS,
    updateAge: DAY_IN_SECONDS,
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (!isEmailAllowed(user.email, allowlist)) {
            rejectNotAllowed();
          }
        },
      },
    },
    session: {
      create: {
        // Also covers existing users who were removed from the allowlist later.
        before: async (session) => {
          const [owner] = await db
            .select({ email: schema.user.email })
            .from(schema.user)
            .where(eq(schema.user.id, session.userId));
          if (!isEmailAllowed(owner?.email, allowlist)) {
            rejectNotAllowed();
          }
        },
      },
    },
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
