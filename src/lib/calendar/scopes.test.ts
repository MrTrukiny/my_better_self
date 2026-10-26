import { describe, expect, it } from "vitest";
import { CALENDAR_SCOPES, hasCalendarScopes, withoutCalendarScopes } from "./scopes";

const signIn = "openid,https://www.googleapis.com/auth/userinfo.email";

describe("hasCalendarScopes", () => {
  it("AC1: needs all three calendar scopes", () => {
    expect(hasCalendarScopes([signIn, ...CALENDAR_SCOPES].join(","))).toBe(true);
    expect(hasCalendarScopes([signIn, ...CALENDAR_SCOPES.slice(1)].join(","))).toBe(false);
    expect(hasCalendarScopes(signIn)).toBe(false);
    expect(hasCalendarScopes(null)).toBe(false);
  });
});

describe("withoutCalendarScopes", () => {
  it("AC6: keeps the sign-in scopes and drops the calendar ones", () => {
    expect(withoutCalendarScopes([signIn, ...CALENDAR_SCOPES].join(","))).toBe(signIn);
    expect(withoutCalendarScopes(null)).toBeNull();
  });
});
