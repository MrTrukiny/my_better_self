import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OfflineCacheWarmer } from "./offline-cache-warmer";

const { offline } = vi.hoisted(() => ({ offline: { value: false } }));
vi.mock("@/hooks/use-is-offline", () => ({ useIsOffline: () => offline.value }));

const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response("ok"));

beforeEach(() => {
  offline.value = false;
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("OfflineCacheWarmer", () => {
  it("AC7: fetches each inventory page so the service worker keeps a fresh copy", () => {
    render(<OfflineCacheWarmer urls={["/rooms", "/rooms/a"]} version="v1" />);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(["/rooms", "/rooms/a"]);
  });

  it("refetches when the data changes, and not on unrelated re-renders", () => {
    const { rerender } = render(<OfflineCacheWarmer urls={["/rooms"]} version="v1" />);
    rerender(<OfflineCacheWarmer urls={["/rooms"]} version="v1" />);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    rerender(<OfflineCacheWarmer urls={["/rooms"]} version="v2" />);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does nothing while offline", () => {
    offline.value = true;
    render(<OfflineCacheWarmer urls={["/rooms"]} version="v1" />);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
