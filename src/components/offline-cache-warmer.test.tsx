import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OfflineCacheWarmer } from "./offline-cache-warmer";

const { offline } = vi.hoisted(() => ({ offline: { value: false } }));
vi.mock("@/hooks/use-is-offline", () => ({ useIsOffline: () => offline.value }));

const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response("ok"));

beforeEach(async () => {
  // Let refreshes started by the previous test finish, since they are tracked per URL.
  await new Promise((resolve) => setTimeout(resolve, 0));
  offline.value = false;
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => new Response("ok"));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function deferredResponse() {
  let resolve: (response: Response) => void = () => {};
  const promise = new Promise<Response>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("OfflineCacheWarmer", () => {
  it("fetches each page so the service worker keeps a fresh copy", () => {
    render(<OfflineCacheWarmer urls={["/rooms", "/rooms/a"]} version="v1" />);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(["/rooms", "/rooms/a"]);
  });

  it("refetches when the data changes, and not on unrelated re-renders", async () => {
    const { rerender } = render(<OfflineCacheWarmer urls={["/rooms"]} version="v1" />);
    rerender(<OfflineCacheWarmer urls={["/rooms"]} version="v1" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    rerender(<OfflineCacheWarmer urls={["/rooms"]} version="v2" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("waits for a refresh in flight, so an older copy can't replace a newer one", async () => {
    const first = deferredResponse();
    fetchMock.mockImplementationOnce(() => first.promise);

    const { rerender } = render(<OfflineCacheWarmer urls={["/rooms"]} version="v1" />);
    rerender(<OfflineCacheWarmer urls={["/rooms"]} version="v2" />);
    rerender(<OfflineCacheWarmer urls={["/rooms"]} version="v3" />);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    first.resolve(new Response("v1"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does nothing while offline", () => {
    offline.value = true;
    render(<OfflineCacheWarmer urls={["/rooms"]} version="v1" />);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
