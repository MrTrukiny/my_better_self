import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignInForm } from "./sign-in-form";

const { social, offline } = vi.hoisted(() => ({
  social: vi.fn(),
  offline: { value: false },
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { signIn: { social } },
}));

vi.mock("next/offline", () => ({
  useOffline: () => offline.value,
}));

beforeEach(() => {
  social.mockReset();
  offline.value = false;
});

const button = () => screen.getByRole("button", { name: /google|signing in/i });

describe("SignInForm", () => {
  it("starts with focus on the Google button", () => {
    render(<SignInForm callbackURL="/" />);
    expect(button()).toHaveFocus();
  });

  it("AC1: sends the user back to the requested page after Google", async () => {
    social.mockReturnValue(new Promise(() => {}));
    render(<SignInForm callbackURL="/rooms" />);

    await userEvent.click(button());

    expect(social).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/rooms",
      errorCallbackURL: "/sign-in?callbackURL=%2Frooms",
    });
  });

  it("AC6: shows a busy state and ignores a second press", async () => {
    social.mockReturnValue(new Promise(() => {}));
    render(<SignInForm callbackURL="/" />);

    await userEvent.click(button());
    await userEvent.click(button());

    expect(button()).toHaveAccessibleName("Signing in...");
    expect(button()).toBeDisabled();
    expect(social).toHaveBeenCalledTimes(1);
  });

  it("AC6: recovers with a message when the redirect cannot start", async () => {
    social.mockResolvedValue({ error: { message: "network" } });
    render(<SignInForm callbackURL="/" />);

    await userEvent.click(button());

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Something went wrong while signing in. Try again.");
    expect(alert).toHaveFocus();
    expect(button()).toBeEnabled();
  });

  it("AC3: announces an error passed from the callback and moves focus to it", () => {
    render(<SignInForm callbackURL="/" errorMessage="This account doesn't have access." />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("This account doesn't have access.");
    expect(alert).toHaveFocus();
  });

  it("AC7: disables sign-in with a visible reason when offline", () => {
    offline.value = true;
    render(<SignInForm callbackURL="/" />);

    expect(button()).toBeDisabled();
    expect(button()).toHaveAccessibleDescription(
      "You're offline. Connect to the internet to sign in.",
    );
  });
});
