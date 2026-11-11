import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { isEmailAllowed, parseAllowlist } from "@/lib/allowlist";
import { SESSION_OPTIONS } from "@/lib/app-config";
import { EMAIL_NOT_ALLOWED } from "@/lib/auth-errors";
import { getEnv } from "@/lib/env";
import { isInvited, joinInvitation, membershipOf } from "@/lib/household/queries";
import { signInAllowed } from "@/lib/household/rules";

const env = getEnv();
const allowlist = parseAllowlist(env.ALLOWED_EMAILS);

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
  session: SESSION_OPTIONS,
  databaseHooks: {
    user: {
      create: {
        // Owners come from the allowlist; everyone else needs an invitation (ADR 0011).
        before: async (user) => {
          const onAllowlist = isEmailAllowed(user.email, allowlist);
          if (
            !signInAllowed({ onAllowlist, invited: !onAllowlist && (await isInvited(user.email)) })
          ) {
            rejectNotAllowed();
          }
        },
        after: async (user) => {
          if (!isEmailAllowed(user.email, allowlist)) {
            await joinInvitation(user.email, user.id);
          }
        },
      },
    },
    session: {
      create: {
        // Also covers owners removed from the allowlist and members removed from a household.
        before: async (session) => {
          const [owner] = await db
            .select({ email: schema.user.email })
            .from(schema.user)
            .where(eq(schema.user.id, session.userId));
          const onAllowlist = isEmailAllowed(owner?.email, allowlist);
          const invited = !onAllowlist && (await membershipOf(session.userId)) !== null;
          if (!signInAllowed({ onAllowlist, invited })) {
            rejectNotAllowed();
          }
        },
      },
    },
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
