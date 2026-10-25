import { describe, expect, it } from "vitest";
import { getItemType, ITEM_TYPE_IDS, ITEM_TYPES } from "./item-types";

describe("item types", () => {
  it("AC3: offers the agreed starting list, ending with Other", () => {
    expect(ITEM_TYPE_IDS).toEqual([
      "window",
      "door",
      "mirror",
      "floor",
      "rug",
      "light-fixture",
      "shelf",
      "desk",
      "table",
      "sofa",
      "bed",
      "closet",
      "cabinet",
      "countertop",
      "appliance",
      "sink",
      "toilet",
      "shower",
      "bathtub",
      "other",
    ]);
  });

  it("gives every type a label and an icon", () => {
    for (const type of ITEM_TYPES) {
      expect(type.label).toMatch(/^[A-Z][a-z ]+$/);
      expect(type.icon).toBeTruthy();
    }
  });

  it("looks a type up by id", () => {
    expect(getItemType("light-fixture")?.label).toBe("Light fixture");
    expect(getItemType("spaceship")).toBeUndefined();
  });
});
