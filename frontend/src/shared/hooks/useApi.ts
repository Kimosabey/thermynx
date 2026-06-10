import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/shared/api/client";

/**
 * Data-fetching hook with loading state, error handling, 30s timeout, and
 * aborted requests discarded via a fetch generation counter (never no-ops
 * mid-flight).
 *
 * Usage:
 *   const { data, isLoading, error, refetch } = useApi<Equipment[]>("/api/v1/equipment");
 *   const { data } = useApi("/api/v1/efficiency?hours=24", { ttl: 120_000 });
 *
 * Options:
 *   enabled    — set false to skip the fetch (default true)
 *   ttl        — ms before auto-refetch (default: no auto-refetch)
 *   onSuccess  — callback(data) after a successful fetch
 */
export interface UseApiOptions<T> {
  enabled?: boolean;
  ttl?: number;
  onSuccess?: (data: T) => void;
}

export interface UseApiResult<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export default function useApi<T = unknown>(
  url: string | null | undefined,
  { enabled = true, ttl, onSuccess }: UseApiOptions<T> = {},
): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(!!enabled);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fetchGenRef = useRef(0);

  // Hold onSuccess in a ref. If it were a fetchData dependency, an inline
  // callback (new identity every render — the common call site) would re-create
  // fetchData → re-run the fetch effect → setState → re-render → re-fetch …
  // i.e. an infinite request loop. With the ref, fetchData is stable per `url`.
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  const fetchData = useCallback(async () => {
    if (!url) return;

    // New attempt supersedes any in-flight fetch (fixes React Strict Mode + abort
    // race where `inFlight` previously caused the follow-up fetch to no-op).
    fetchGenRef.current += 1;
    const gen = fetchGenRef.current;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const stillActive = () => gen === fetchGenRef.current;

    setIsLoading(true);
    setError(null);

    // 30-second timeout
    const timeoutId = setTimeout(() => controller.abort(), 30_000);

    try {
      const res = await apiFetch(url, {
        signal: controller.signal,
        cache: "no-store",
      });

      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try {
          const body = (await res.json()) as { detail?: string };
          detail = body.detail || detail;
        } catch {
          /* ignore parse error */
        }
        throw new Error(detail);
      }

      const json = (await res.json()) as T;
      if (stillActive()) {
        setData(json);
        onSuccess?.(json);
      }
    } catch (e) {
      const err = e as { name?: string; message?: string };
      if (err.name === "AbortError") return; // intentional cancel — not an error
      if (stillActive()) setError(err.message || "Request failed");
    } finally {
      clearTimeout(timeoutId);
      // Only flip loading after the latest attempt; aborted/stale completes must
      // not steal UI state.
      if (stillActive()) setIsLoading(false);
    }
  }, [url, onSuccess]);

  useEffect(() => {
    if (!enabled) return;
    fetchData();
    return () => {
      fetchGenRef.current += 1;
      abortRef.current?.abort();
    };
  }, [enabled, fetchData]);

  // Auto-refetch on TTL
  useEffect(() => {
    if (!ttl || !enabled) return;
    const id = setInterval(fetchData, ttl);
    return () => clearInterval(id);
  }, [ttl, enabled, fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}
