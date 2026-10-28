import { describe, expect, it } from "vitest";
import { parseInput } from "@/lib/inventory/schemas";
import { notificationPrefsSchema, prefsFormValues, subscriptionSchema } from "./schemas";

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }
  return data;
}

describe("notificationPrefsSchema", () => {
  it("parses the form", () => {
    const values = prefsFormValues(
      form({ beforeEnabled: "1", beforeMinutes: "5", eveningEnabled: "0", eveningTime: "21:30" }),
    );
    expect(parseInput(notificationPrefsSchema, values)).toEqual({
      ok: true,
      data: { beforeEnabled: true, beforeMinutes: 5, eveningEnabled: false, eveningTime: "21:30" },
    });
  });

  it("accepts only the offered leads", () => {
    const values = prefsFormValues(
      form({ beforeEnabled: "1", beforeMinutes: "10", eveningEnabled: "1", eveningTime: "20:00" }),
    );
    expect(parseInput(notificationPrefsSchema, values)).toMatchObject({
      ok: false,
      fieldErrors: { beforeMinutes: "Choose how long before your session." },
    });
  });

  it("needs a valid evening time", () => {
    const values = prefsFormValues(
      form({ beforeEnabled: "1", beforeMinutes: "15", eveningEnabled: "1", eveningTime: "" }),
    );
    expect(parseInput(notificationPrefsSchema, values)).toMatchObject({
      ok: false,
      fieldErrors: { eveningTime: "Enter a time, like 20:00." },
    });
  });
});

describe("subscriptionSchema", () => {
  it("accepts a browser subscription and rejects one without keys", () => {
    const subscription = {
      endpoint: "https://push.example/abc",
      keys: { p256dh: "key", auth: "secret" },
    };
    expect(subscriptionSchema.safeParse(subscription).success).toBe(true);
    expect(subscriptionSchema.safeParse({ endpoint: subscription.endpoint }).success).toBe(false);
    expect(
      subscriptionSchema.safeParse({ ...subscription, endpoint: "http://push.example/abc" })
        .success,
    ).toBe(false);
  });
});
