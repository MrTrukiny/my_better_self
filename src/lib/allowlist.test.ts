import { describe, expect, it } from "vitest";
import { isEmailAllowed, parseAllowlist } from "./allowlist";

describe("parseAllowlist", () => {
  it("splits on commas, trims, lowercases, and drops empty entries", () => {
    expect(parseAllowlist(" Owner@Example.com, ,second@example.com ,")).toEqual(
      new Set(["owner@example.com", "second@example.com"]),
    );
  });

  it("returns an empty set for an empty string", () => {
    expect(parseAllowlist("")).toEqual(new Set());
  });
});

describe("isEmailAllowed", () => {
  const allowlist = parseAllowlist("owner@example.com");

  it("accepts a listed email regardless of case and surrounding spaces", () => {
    expect(isEmailAllowed(" OWNER@example.com ", allowlist)).toBe(true);
  });

  it("rejects an unlisted email", () => {
    expect(isEmailAllowed("stranger@example.com", allowlist)).toBe(false);
  });

  it("rejects a missing email", () => {
    expect(isEmailAllowed(undefined, allowlist)).toBe(false);
  });

  it("rejects everything when the list is empty", () => {
    expect(isEmailAllowed("owner@example.com", new Set())).toBe(false);
  });
});
