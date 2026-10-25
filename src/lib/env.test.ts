import { describe, expect, it } from "vitest";
import { DEFAULT_AI_MODEL, parseEnv } from "./env";

const valid = {
  DATABASE_URL: "postgres://user:pass@localhost:5432/db",
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  GOOGLE_CLIENT_ID: "client-id",
  GOOGLE_CLIENT_SECRET: "client-secret",
  ALLOWED_EMAILS: "owner@example.com",
};

describe("parseEnv", () => {
  it("returns the parsed values when everything is set", () => {
    expect(parseEnv(valid)).toEqual({ ...valid, AI_MODEL: DEFAULT_AI_MODEL, AI_FAKE: false });
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
