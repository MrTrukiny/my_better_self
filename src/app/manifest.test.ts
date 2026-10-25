import { describe, expect, it } from "vitest";
import manifest from "./manifest";

describe("web app manifest", () => {
  const result = manifest();

  it("is installable as a standalone app", () => {
    expect(result.display).toBe("standalone");
    expect(result.start_url).toBe("/");
    expect(result.name).toBeTruthy();
  });

  it("ships 192px, 512px and maskable icons", () => {
    const icons = result.icons ?? [];
    expect(icons.some((icon) => icon.sizes === "192x192")).toBe(true);
    expect(icons.some((icon) => icon.sizes === "512x512" && icon.purpose === "any")).toBe(true);
    expect(icons.some((icon) => icon.purpose === "maskable")).toBe(true);
  });
});
