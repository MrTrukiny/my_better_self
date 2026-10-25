import { describe, expect, it } from "vitest";
import { safeCallbackPath } from "./callback-url";

describe("safeCallbackPath", () => {
  it("AC1: keeps a same-origin path with its query and hash", () => {
    expect(safeCallbackPath("/rooms/1?tab=items#top")).toBe("/rooms/1?tab=items#top");
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["absolute URL", "https://evil.example/steal"],
    ["protocol-relative URL", "//evil.example"],
    ["backslash trick", "/\\evil.example"],
    ["javascript URL", "javascript:alert(1)"],
    ["relative path without slash", "rooms"],
    ["the sign-in page itself", "/sign-in?callbackURL=/"],
  ])("falls back to / for a %s", (_label, value) => {
    expect(safeCallbackPath(value)).toBe("/");
  });
});
