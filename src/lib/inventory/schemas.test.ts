import { describe, expect, it } from "vitest";
import { isDuplicateRoomNameError, itemInputSchema, parseInput, roomInputSchema } from "./schemas";

const validItem = { type: "window", name: "Living room windows", count: "3", note: "" };

describe("roomInputSchema", () => {
  it("trims the name", () => {
    expect(parseInput(roomInputSchema, { name: "  Kitchen " })).toEqual({
      ok: true,
      data: { name: "Kitchen" },
    });
  });

  it.each([
    ["", "Enter a name."],
    ["   ", "Enter a name."],
    ["a".repeat(61), "Use 60 characters or fewer."],
  ])("AC6: rejects %j", (name, message) => {
    expect(parseInput(roomInputSchema, { name })).toEqual({
      ok: false,
      fieldErrors: { name: message },
    });
  });

  it("accepts exactly 60 characters", () => {
    expect(parseInput(roomInputSchema, { name: "a".repeat(60) }).ok).toBe(true);
  });
});

describe("itemInputSchema", () => {
  it("AC3: parses form values, turning an empty note into null", () => {
    expect(parseInput(itemInputSchema, validItem)).toEqual({
      ok: true,
      data: { type: "window", name: "Living room windows", count: 3, note: null },
    });
  });

  it.each(["1", "99"])("accepts a count of %s", (count) => {
    expect(parseInput(itemInputSchema, { ...validItem, count }).ok).toBe(true);
  });

  it.each(["0", "100", "1.5", "", "two"])("AC6: rejects a count of %j", (count) => {
    expect(parseInput(itemInputSchema, { ...validItem, count })).toEqual({
      ok: false,
      fieldErrors: { count: "Enter a whole number from 1 to 99." },
    });
  });

  it("AC6: rejects an unknown type", () => {
    expect(parseInput(itemInputSchema, { ...validItem, type: "spaceship" })).toEqual({
      ok: false,
      fieldErrors: { type: "Choose a type." },
    });
  });

  it("AC6: limits the note to 200 characters", () => {
    expect(parseInput(itemInputSchema, { ...validItem, note: "a".repeat(200) }).ok).toBe(true);
    expect(parseInput(itemInputSchema, { ...validItem, note: "a".repeat(201) })).toEqual({
      ok: false,
      fieldErrors: { note: "Use 200 characters or fewer." },
    });
  });

  it("reports several invalid fields at once", () => {
    const result = parseInput(itemInputSchema, { type: "", name: "", count: "0", note: "" });
    expect(result.ok === false && Object.keys(result.fieldErrors).sort()).toEqual([
      "count",
      "name",
      "type",
    ]);
  });
});

describe("isDuplicateRoomNameError", () => {
  const pgError = { code: "23505", constraint: "room_user_id_name_unique" };

  it("AC6: recognizes the unique violation, also when wrapped by Drizzle", () => {
    expect(isDuplicateRoomNameError(pgError)).toBe(true);
    expect(isDuplicateRoomNameError(new Error("Failed query", { cause: pgError }))).toBe(true);
  });

  it("ignores other errors", () => {
    expect(isDuplicateRoomNameError({ code: "23505", constraint: "other" })).toBe(false);
    expect(isDuplicateRoomNameError(new Error("boom"))).toBe(false);
  });
});
