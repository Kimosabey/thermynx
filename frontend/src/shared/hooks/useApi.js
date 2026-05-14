import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Data-fetching hook with loading state, error handling, 30s timeout,
 * and request deduplication.
 *
 * Usage:
 *   const { data, isLoading, error, refetch } = useApi("/api/v1/equipment");
 *
 *   // With options:
 *   const { data } = useApi("/api/v1/efficiency?hours=24", { ttl: 120_000 });
 *
 * Options:
 *   enabled    — set false to skip the fetch (default true)
 *   ttl        — ms before auto-refetch (default: no auto-refetch)
 *   onSuccess  — callback(data) after successful fetch
 */
export default function useApi(url, { enabled = true, ttl, onSuccess } = {}) {
  const [data,      setData]      = useState(null);
  const [isLoading, setIsLoading] = useState(!!enabled);
  const [error,     setError]     = useState(null);
  const abortRef  = useRef(null);
  const inFlight  = useRef(false);

  const fetchData = useCallback(async () => {
    if (!url || inFlight.current) return;

    inFlight.current = true;
    setIsLoading(true);
    setError(null);

    // Cancel any previous in-flight request
    abortRef.current?.abort();
    const controller  = new AbortController();
    abortRef.current  = controller;

    // 30-second timeout
    const timeoutId = setTimeout(() => controller.abort(), 30_000);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        cache: "no-store",
      });

      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try {
          const body = await res.json();
          detail = body.detail || detail;
        } catch { /* ignore parse error */ }
        throw new Error(detail);
      }

      const json = await res.json();
      setData(json);
      onSuccess?.(json);
    } catch (e) {
      if (e.name === "AbortError") return;    // intentional cancel — not an error
      setError(e.message || "Request failed");
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
      inFlight.current = false;
    }
  }, [url, onSuccess]);

  useEffect(() => {
    if (!enabled) return;
    fetchData();
    return () => abortRef.current?.abort();
  }, [enabled, fetchData]);

  // Auto-refetch on TTL
  useEffect(() => {
    if (!ttl || !enabled) return;
    const id = setInterval(fetchData, ttl);
    return () => clearInterval(id);
  }, [ttl, enabled, fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}
