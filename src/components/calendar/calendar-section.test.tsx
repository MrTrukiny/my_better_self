import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CALENDAR_SCOPES } from "@/lib/calendar/scopes";
import { CalendarSection } from "./calendar-section";
import { CalendarSyncNotice } from "./calendar-sync-notice";

const { linkSocial, disconnect, syncNow, offline } = vi.hoisted(() => ({
  linkSocial: vi.fn(),
  disconnect: vi.fn(),
  syncNow: vi.fn(),
  offline: { value: false },
}));

vi.mock("@/lib/auth-client", () => ({ authClient: { linkSocial } }));
vi.mock("next/offline", () => ({ useOffline: () => offline.value }));

beforeEach(() => {
  linkSocial.mockReset().mockResolvedValue({ data: { url: "https://accounts.google.com" } });
  disconnect.mockReset().mockResolvedValue({ status: "success" });
  syncNow.mockReset().mockResolvedValue({ status: "success" });
  offline.value = false;
});

const NOW = new Date("2026-10-27T14:00:00Z");

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
      syncNow={syncNow}
      now={NOW}
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
    expect(screen.getByText("Connected: Cleaning")).toHaveAttribute("role", "status");
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
    expect(screen.getByRole("button", { name: "Sync now" })).toBeDisabled();
  });

  it("spec 007 AC7: says when the calendar last synced", () => {
    const { unmount } = renderSection({ connection: connected });
    expect(screen.getByText("Last synced 10 minutes ago")).toHaveAttribute("role", "status");
    unmount();

    renderSection({ connection: { ...connected, lastSyncedAt: null } });
    expect(screen.getByText("Not synced yet")).toBeInTheDocument();
  });

  it("spec 007 AC5: syncs once, shows a busy state, then says it synced", async () => {
    let finish: (state: { status: "success" }) => void = () => {};
    syncNow.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    renderSection({ connection: connected });
    await userEvent.click(screen.getByRole("button", { name: "Sync now" }));

    const busy = await screen.findByRole("button", { name: "Syncing…" });
    expect(busy).toBeDisabled();
    await userEvent.click(busy);
    expect(syncNow).toHaveBeenCalledOnce();

    await act(async () => finish({ status: "success" }));
    expect(await screen.findByText("Synced just now")).toHaveAttribute("role", "status");
    expect(screen.getByRole("button", { name: "Sync now" })).toBeEnabled();
  });

  it("spec 007 AC6: a failed sync doesn't claim success, and a replan error shows", async () => {
    syncNow.mockResolvedValue({ status: "error" });
    const { unmount } = renderSection({ connection: connected });
    await userEvent.click(screen.getByRole("button", { name: "Sync now" }));
    expect(await screen.findByRole("button", { name: "Sync now" })).toBeEnabled();
    expect(screen.queryByText("Synced just now")).toBeNull();
    expect(screen.getByText("Last synced 10 minutes ago")).toBeInTheDocument();
    unmount();

    syncNow.mockResolvedValue({ status: "error", formError: "Couldn't update your plan." });
    renderSection({ connection: connected });
    await userEvent.click(screen.getByRole("button", { name: "Sync now" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't update your plan.");
    expect(screen.queryByText("Synced just now")).toBeNull();
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
