import { describe, expect, it } from "vitest";
import { EMAIL_NOT_ALLOWED, signInErrorMessage } from "./auth-errors";

describe("signInErrorMessage", () => {
  it("AC3: explains that a non-allowlisted account has no access", () => {
    expect(signInErrorMessage(EMAIL_NOT_ALLOWED)).toBe("This account doesn't have access.");
  });

  it("AC6: tells the user they cancelled at Google", () => {
    expect(signInErrorMessage("access_denied")).toBe("Sign-in was cancelled. Try again.");
  });

  it("AC6: falls back to a generic message for unknown codes", () => {
    expect(signInErrorMessage("state_mismatch")).toBe(
      "Something went wrong while signing in. Try again.",
    );
  });

  it("returns nothing when there is no error", () => {
    expect(signInErrorMessage(undefined)).toBeUndefined();
    expect(signInErrorMessage("")).toBeUndefined();
  });
});
