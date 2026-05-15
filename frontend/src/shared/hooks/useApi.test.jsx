import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import useApi from "./useApi";

function mockFetchRespectingAbort(impl) {
  return vi.fn().mockImplementation((url, opts) => impl(url, opts));
}

describe("useApi", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      mockFetchRespectingAbort((_url, opts) =>
        Promise.resolve({
          ok: true,
          json: async () => ({ ok: true }),
        })
      )
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("loads JSON when the response is OK", async () => {
    global.fetch = mockFetchRespectingAbort(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ hello: "world" }),
      })
    );
    const { result } = renderHook(() => useApi("/api/v1/example"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual({ hello: "world" });
    expect(result.current.error).toBe(null);
  });

  it("ignores stale fetch results after AbortError from a superseding refetch", async () => {
    let seq = 0;
    global.fetch = mockFetchRespectingAbort((_url, opts) => {
      seq += 1;
      const n = seq;
      const slow = n === 1;
      return new Promise((resolve, reject) => {
        const id = setTimeout(
          () => {
            resolve({ ok: true, json: async () => ({ seq: n }) });
          },
          slow ? 120 : 8
        );
        opts?.signal?.addEventListener("abort", () => {
          clearTimeout(id);
          const err = new Error("Aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    });

    const { result } = renderHook(() => useApi("/api/v1/slow-then-fast"));

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => expect(result.current.data?.seq).toBe(2), { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 150));
    expect(result.current.data).toEqual({ seq: 2 });
  });
});
