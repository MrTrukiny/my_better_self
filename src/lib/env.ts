import "server-only";
import { z } from "zod";

export const DEFAULT_AI_MODEL = "gemini-3.5-flash";

const envSchema = z
  .object({
    DATABASE_URL: z.url(),
    BETTER_AUTH_SECRET: z.string().min(32, "must be at least 32 characters"),
    BETTER_AUTH_URL: z.url(),
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    ALLOWED_EMAILS: z.string().min(1, "list at least one email, comma-separated"),
    // AI is optional so the app runs without a key; proposing tasks then reports a failure.
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1).optional(),
    AI_MODEL: z.string().min(1).default(DEFAULT_AI_MODEL),
    AI_FAKE: z
      .string()
      .optional()
      .transform((value) => value === "1"),
    // Test-only: an in-memory Google Calendar, so e2e and CI never call Google.
    CALENDAR_FAKE: z
      .string()
      .optional()
      .transform((value) => value === "1"),
    // Bearer secret for the daily job (/api/cron/daily); Vercel Cron sends it.
    CRON_SECRET: z.string().min(32, "must be at least 32 characters").optional(),
    VERCEL_ENV: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.VERCEL_ENV === "production" && !env.CRON_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["CRON_SECRET"],
        message: "is required in production",
      });
    }
    if (env.VERCEL_ENV === "production" && env.CALENDAR_FAKE) {
      ctx.addIssue({
        code: "custom",
        path: ["CALENDAR_FAKE"],
        message: "must not be set in production",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables (see .env.example):\n${problems}`);
  }
  return result.data;
}

let cached: Env | undefined;

/** Parsed on first use, so unit tests can import this module without real secrets. */
export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
