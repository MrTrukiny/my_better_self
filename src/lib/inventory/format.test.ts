import { describe, expect, it } from "vitest";
import { itemCountLabel, itemLabel } from "./format";

describe("itemLabel", () => {
  it("shows the count only when there is more than one", () => {
    expect(itemLabel({ name: "Window", count: 1 })).toBe("Window");
    expect(itemLabel({ name: "Window", count: 3 })).toBe("Window x3");
  });
});

describe("itemCountLabel", () => {
  it("pluralizes the item count", () => {
    expect(itemCountLabel(0)).toBe("No items");
    expect(itemCountLabel(1)).toBe("1 item");
    expect(itemCountLabel(12)).toBe("12 items");
  });
});
