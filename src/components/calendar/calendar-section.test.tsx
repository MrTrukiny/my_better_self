import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CALENDAR_SCOPES } from "@/lib/calendar/scopes";
import { CalendarSection } from "./calendar-section";
import { CalendarSyncNotice } from "./calendar-sync-notice";

const { linkSocial, disconnect, offline } = vi.hoisted(() => ({
  linkSocial: vi.fn(),
  disconnect: vi.fn(),
  offline: { value: false },
}));

vi.mock("@/lib/auth-client", () => ({ authClient: { linkSocial } }));
vi.mock("next/offline", () => ({ useOffline: () => offline.value }));

beforeEach(() => {
  linkSocial.mockReset().mockResolvedValue({ data: { url: "https://accounts.google.com" } });
  disconnect.mockReset().mockResolvedValue({ status: "success" });
  offline.value = false;
});

const connected = {
  status: "ok" as const,
  calendarName: "Cleaning",
  email: "owner@example.com",
  lastSyncedAt: new Date("2026-10-27T13:50:00Z"),
};

function renderSection(props: Partial<Parameters<typeof CalendarSection>[0]> = {}) {
  return render(
    <CalendarSection
      connection={null}
      denied={false}
      fake={false}
      email="owner@example.com"
      disconnect={disconnect}
      {...props}
    />,
  );
}

describe("CalendarSection", () => {
  it("AC1: explains what connecting does and offers to connect", () => {
    renderSection();
    expect(screen.getByRole("region", { name: "Google Calendar" })).toBeInTheDocument();
    expect(screen.getByText(/Adds each day's session to a Cleaning calendar/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect Google Calendar" })).toBeEnabled();
  });

  it("AC1: asks Google for the calendar scopes and offline access", async () => {
    renderSection();
    await userEvent.click(screen.getByRole("button", { name: "Connect Google Calendar" }));
    expect(linkSocial).toHaveBeenCalledWith({
      provider: "google",
      scopes: [...CALENDAR_SCOPES],
      callbackURL: "/api/calendar/connected",
      errorCallbackURL: "/schedule?calendar=denied",
      loginHint: "owner@example.com",
      additionalParams: { access_type: "offline", prompt: "consent" },
    });
  });

  it("AC1: says when starting the consent failed", async () => {
    linkSocial.mockResolvedValue({ error: { message: "nope" } });
    renderSection();
    await userEvent.click(screen.getByRole("button", { name: "Connect Google Calendar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't reach Google");
    expect(screen.getByRole("button", { name: "Connect Google Calendar" })).toBeEnabled();
  });

  it("AC1: says nothing was connected after a cancelled consent", () => {
    renderSection({ denied: true });
    expect(screen.getByRole("status")).toHaveTextContent("Google Calendar wasn't connected");
  });

  it("AC1: shows the connected calendar and account", () => {
    renderSection({ connection: connected });
    expect(screen.getByRole("status")).toHaveTextContent("Connected: Cleaning");
    expect(screen.getByText("owner@example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Disconnect" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Connect Google Calendar" })).toBeNull();
  });

  it("AC6: disconnects only after confirming", async () => {
    renderSection({ connection: connected });
    await userEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    const dialog = screen.getByRole("alertdialog", { name: "Disconnect Google Calendar?" });
    expect(dialog).toHaveTextContent(/Cleaning calendar and its events will be deleted/);
    expect(disconnect).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Disconnect calendar" }));
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it("AC6: keeps the dialog open with the error when disconnecting fails", async () => {
    disconnect.mockResolvedValue({ status: "error", formError: "Couldn't disconnect." });
    renderSection({ connection: connected });
    await userEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    await userEvent.click(screen.getByRole("button", { name: "Disconnect calendar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't disconnect.");
  });

  it("AC7: offers to reconnect when access was lost", () => {
    renderSection({ connection: { ...connected, status: "reauth" } });
    expect(screen.getByText("We couldn't update your calendar.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reconnect" })).toBeEnabled();
  });

  it("AC7: reports other failures without asking to reconnect", () => {
    renderSection({ connection: { ...connected, status: "error" } });
    expect(screen.getByText("We couldn't update your calendar.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reconnect" })).toBeNull();
  });

  it("AC8: disables connecting and disconnecting offline", () => {
    offline.value = true;
    const { unmount } = renderSection();
    expect(screen.getByRole("button", { name: "Connect Google Calendar" })).toBeDisabled();
    unmount();

    renderSection({ connection: { ...connected, status: "reauth" } });
    expect(screen.getByRole("button", { name: "Disconnect" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reconnect" })).toBeDisabled();
  });

  it("goes straight to the connect route with the fake calendar", async () => {
    const assign = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, assign });
    renderSection({ fake: true });
    await userEvent.click(screen.getByRole("button", { name: "Connect Google Calendar" }));
    expect(assign).toHaveBeenCalledWith("/api/calendar/connected");
    expect(linkSocial).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});

describe("CalendarSyncNotice", () => {
  it("AC7: shows nothing while syncs succeed", () => {
    const { container } = render(
      <CalendarSyncNotice status="ok" fake={false} email="owner@example.com" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("AC7: announces a failed sync", () => {
    render(<CalendarSyncNotice status="reauth" fake={false} email="owner@example.com" />);
    expect(screen.getByRole("status")).toHaveTextContent("We couldn't update your calendar.");
    expect(screen.getByRole("button", { name: "Reconnect" })).toBeInTheDocument();
  });
});
