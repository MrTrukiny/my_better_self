import { describe, expect, it } from "vitest";
import { DEFAULT_AI_MODEL, parseEnv } from "./env";

const valid = {
  DATABASE_URL: "postgres://user:pass@localhost:5432/db",
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "http://localhost:4837",
  GOOGLE_CLIENT_ID: "client-id",
  GOOGLE_CLIENT_SECRET: "client-secret",
  ALLOWED_EMAILS: "owner@example.com",
};

describe("parseEnv", () => {
  it("returns the parsed values when everything is set", () => {
    expect(parseEnv(valid)).toEqual({
      ...valid,
      AI_MODEL: DEFAULT_AI_MODEL,
      AI_FAKE: false,
      CALENDAR_FAKE: false,
    });
  });

  it("turns on the fake calendar only for CALENDAR_FAKE=1", () => {
    expect(parseEnv({ ...valid, CALENDAR_FAKE: "1" }).CALENDAR_FAKE).toBe(true);
    expect(parseEnv({ ...valid, CALENDAR_FAKE: "true" }).CALENDAR_FAKE).toBe(false);
  });

  it("keeps the job secret optional outside Vercel production", () => {
    expect(parseEnv(valid).CRON_SECRET).toBeUndefined();
    expect(parseEnv({ ...valid, VERCEL_ENV: "preview" }).CRON_SECRET).toBeUndefined();
    expect(parseEnv({ ...valid, CRON_SECRET: "s".repeat(32) }).CRON_SECRET).toBe("s".repeat(32));
  });

  it("requires a long job secret in Vercel production", () => {
    expect(() => parseEnv({ ...valid, VERCEL_ENV: "production" })).toThrow(/CRON_SECRET/);
    expect(() => parseEnv({ ...valid, CRON_SECRET: "short" })).toThrow(/CRON_SECRET/);
    expect(
      parseEnv({ ...valid, VERCEL_ENV: "production", CRON_SECRET: "s".repeat(32) }).CRON_SECRET,
    ).toBe("s".repeat(32));
  });

  it("rejects the fake calendar in Vercel production", () => {
    const production = { ...valid, VERCEL_ENV: "production", CRON_SECRET: "s".repeat(32) };
    expect(() => parseEnv({ ...production, CALENDAR_FAKE: "1" })).toThrow(/CALENDAR_FAKE/);
    expect(parseEnv({ ...valid, VERCEL_ENV: "preview", CALENDAR_FAKE: "1" }).CALENDAR_FAKE).toBe(
      true,
    );
  });

  it("keeps the AI settings optional, with a default model", () => {
    const parsed = parseEnv({ ...valid, GOOGLE_GENERATIVE_AI_API_KEY: "key", AI_MODEL: "m" });
    expect(parsed.GOOGLE_GENERATIVE_AI_API_KEY).toBe("key");
    expect(parsed.AI_MODEL).toBe("m");
    expect(parseEnv(valid).GOOGLE_GENERATIVE_AI_API_KEY).toBeUndefined();
  });

  it("turns on the fake AI only for AI_FAKE=1", () => {
    expect(parseEnv({ ...valid, AI_FAKE: "1" }).AI_FAKE).toBe(true);
    expect(parseEnv({ ...valid, AI_FAKE: "0" }).AI_FAKE).toBe(false);
  });

  it("names every missing variable in the error", () => {
    expect(() => parseEnv({})).toThrow(
      /DATABASE_URL[\s\S]*BETTER_AUTH_SECRET[\s\S]*ALLOWED_EMAILS/,
    );
  });

  it("rejects a short auth secret", () => {
    expect(() => parseEnv({ ...valid, BETTER_AUTH_SECRET: "short" })).toThrow(/BETTER_AUTH_SECRET/);
  });

  it("rejects URLs that are not URLs", () => {
    expect(() => parseEnv({ ...valid, BETTER_AUTH_URL: "localhost" })).toThrow(/BETTER_AUTH_URL/);
  });
});
