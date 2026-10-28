import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountMenu } from "./account-menu";

const { signOut, unsubscribeDevice } = vi.hoisted(() => ({
  signOut: vi.fn(),
  unsubscribeDevice: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { signOut },
}));
vi.mock("@/lib/notifications/browser", () => ({ unsubscribeDevice }));

const user = { name: "Ada Lovelace", email: "ada@example.com", image: null };
const cacheNames = ["serwist-precache-v2", "pages", "pages-rsc"];
const deleteCache = vi.fn(async () => true);
const replace = vi.fn();
const originalLocation = window.location;

beforeEach(() => {
  signOut.mockReset().mockResolvedValue({ data: { success: true } });
  unsubscribeDevice.mockReset().mockResolvedValue(null);
  deleteCache.mockClear();
  replace.mockClear();
  vi.stubGlobal("caches", { keys: async () => cacheNames, delete: deleteCache });
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...originalLocation, replace },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
});

const trigger = () => screen.getByRole("button", { name: "Account menu for Ada Lovelace" });

describe("AccountMenu", () => {
  it("AC2: shows the user's initials when there is no photo", () => {
    render(<AccountMenu user={user} />);
    expect(trigger()).toHaveTextContent("AL");
  });

  it("AC8: opens with the keyboard and shows the account email", async () => {
    render(<AccountMenu user={user} />);

    trigger().focus();
    await userEvent.keyboard("{Enter}");

    expect(await screen.findByRole("menu")).toHaveTextContent("ada@example.com");
    expect(screen.getByRole("menuitem", { name: "Sign out" })).toBeVisible();
  });

  it("AC5: signs out, clears runtime page caches, and replaces the history entry", async () => {
    render(<AccountMenu user={user} />);

    await userEvent.click(trigger());
    await userEvent.click(await screen.findByRole("menuitem", { name: "Sign out" }));

    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/sign-in"));
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(deleteCache).toHaveBeenCalledWith("pages");
    expect(deleteCache).toHaveBeenCalledWith("pages-rsc");
    expect(deleteCache).not.toHaveBeenCalledWith("serwist-precache-v2");
  });

  it("stops this device's push subscription before signing out", async () => {
    render(<AccountMenu user={user} />);

    await userEvent.click(trigger());
    await userEvent.click(await screen.findByRole("menuitem", { name: "Sign out" }));

    await vi.waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(unsubscribeDevice).toHaveBeenCalledTimes(1);
    expect(unsubscribeDevice.mock.invocationCallOrder[0]).toBeLessThan(
      signOut.mock.invocationCallOrder[0] ?? 0,
    );
  });
});
