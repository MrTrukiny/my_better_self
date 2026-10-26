import { describe, expect, it } from "vitest";
import { describeLocale, preferredLanguage } from "./locale";

describe("preferredLanguage", () => {
  it("takes the highest-ranked language tag", () => {
    expect(preferredLanguage("es-CO,es;q=0.9,en-US;q=0.8")).toBe("es-CO");
    expect(preferredLanguage("en;q=0.5, es-419;q=0.9")).toBe("es-419");
  });

  it("returns null for a missing, wildcard, or invalid header", () => {
    expect(preferredLanguage(null)).toBeNull();
    expect(preferredLanguage("")).toBeNull();
    expect(preferredLanguage("*")).toBeNull();
    expect(preferredLanguage("not a tag!")).toBeNull();
  });
});

describe("describeLocale", () => {
  it("names the language and region, and the time zone", () => {
    expect(describeLocale({ language: "es-CO", timeZone: "America/Bogota" })).toBe(
      "device language es-CO (Spanish (Colombia)), time zone America/Bogota",
    );
  });

  it("says what is unknown", () => {
    expect(describeLocale({ language: "es", timeZone: null })).toBe(
      "device language es (Spanish), time zone unknown",
    );
    expect(describeLocale({ language: null, timeZone: null })).toBe("unknown");
  });
});
