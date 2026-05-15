import { useState, useEffect, useRef, useCallback } from "react";
import { apiFetch } from "../api/client";

/**
 * Data-fetching hook with loading state, error handling, 30s timeout,
 * and aborted requests discarded using a fetch generation counter (never no-ops mid-flight).
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
  const abortRef     = useRef(null);
  const fetchGenRef  = useRef(0);

  const fetchData = useCallback(async () => {
    if (!url) return;

    // New attempt supersedes any in-flight fetch (fixes React Strict Mode + abort race
    // where `inFlight` previously caused the follow-up fetch to no-op permanently).
    fetchGenRef.current += 1;
    const gen = fetchGenRef.current;

    abortRef.current?.abort();
    const controller  = new AbortController();
    abortRef.current  = controller;

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
          const body = await res.json();
          detail = body.detail || detail;
        } catch { /* ignore parse error */ }
        throw new Error(detail);
      }

      const json = await res.json();
      if (stillActive()) {
        setData(json);
        onSuccess?.(json);
      }
    } catch (e) {
      if (e.name === "AbortError") return; // intentional cancel — not an error
      if (stillActive()) setError(e.message || "Request failed");
    } finally {
      clearTimeout(timeoutId);
      // Only flip loading after the latest attempt; aborted/stale completes must not steal UI state.
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
