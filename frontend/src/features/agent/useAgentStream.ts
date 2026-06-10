import { useRef, useState, useCallback } from "react";

/**
 * SSE streaming hook for the agent surface. Ported VERBATIM from the legacy
 * `frontend/src/features/agent/useAgentStream.js` — the 40ms token-buffer flush
 * and AbortController handling are load-bearing; only types were added.
 */

export interface TraceFrame {
  type: "tool_call" | "tool_result";
  idx?: number | null;
  [key: string]: unknown;
}

export interface Subtask {
  specialist: string;
  goal: string;
  [key: string]: unknown;
}

export interface AgentPlan {
  rationale?: string;
  subtasks: Subtask[];
  run_id?: string;
}

export type DelegationStatus = "pending" | "running" | "done" | "error" | "stopped";

export interface Delegation {
  idx: number;
  specialist: string;
  goal: string;
  status: DelegationStatus;
  trace: TraceFrame[];
  output: string;
  steps: number;
  error: string | null;
}

export type AgentMeta = Record<string, unknown>;
export type AgentAudit = Record<string, unknown>;

export function useAgentStream() {
  const [trace, setTrace] = useState<TraceFrame[]>([]);
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [meta, setMeta] = useState<AgentMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Post-gen audit (same as analyzer)
  const [agentAudit, setAgentAudit] = useState<AgentAudit | null>(null);
  // Multi-agent state
  const [plan, setPlan] = useState<AgentPlan | null>(null);
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [synthesis, setSynthesis] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const tokenBuf = useRef("");
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = useCallback(async (mode: string, goal: string, context: unknown = null) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const isOrchestrator = mode === "orchestrator";
    // Cancel any pending token flush
    if (flushTimer.current) {
      clearTimeout(flushTimer.current);
      flushTimer.current = null;
    }
    tokenBuf.current = "";
    setTrace([]);
    setOutput("");
    setAgentAudit(null);
    setPlan(null);
    setDelegations([]);
    setSynthesis("");
    setRunning(true);
    setDone(false);
    setMeta(null);
    setError(null);

    const url = isOrchestrator ? "/api/v1/agent/orchestrate" : "/api/v1/agent/run";
    const body = isOrchestrator ? { goal, context } : { mode, goal, context };

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        throw new Error(
          ((await res.json().catch(() => ({}))) as { detail?: string }).detail || `HTTP ${res.status}`,
        );
      }
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let sawDone = false;
      let sawError = false;

      while (true) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            // SSE frames are server-defined; parse loosely and dispatch on `type`.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const frame: any = JSON.parse(line.slice(6));
            const t = frame.type;

            if (t === "tool_call" || t === "tool_result") {
              if (frame.idx != null && isOrchestrator) {
                setDelegations((prev) => {
                  const copy = prev.slice();
                  const slot = copy[frame.idx];
                  if (slot) slot.trace = [...slot.trace, frame];
                  return copy;
                });
              } else {
                setTrace((p) => [...p, frame]);
              }
            } else if (t === "token") {
              // Buffer tokens and flush at most every 40ms to avoid re-rendering
              // on every word.
              tokenBuf.current += frame.content;
              if (!flushTimer.current) {
                flushTimer.current = setTimeout(() => {
                  const chunk = tokenBuf.current;
                  tokenBuf.current = "";
                  flushTimer.current = null;
                  setOutput((p) => p + chunk);
                }, 40);
              }
            } else if (t === "plan") {
              setPlan({ rationale: frame.rationale, subtasks: frame.subtasks, run_id: frame.run_id });
              setDelegations(
                frame.subtasks.map((s: Subtask, i: number) => ({
                  idx: i,
                  specialist: s.specialist,
                  goal: s.goal,
                  status: "pending" as DelegationStatus,
                  trace: [],
                  output: "",
                  steps: 0,
                  error: null,
                })),
              );
            } else if (t === "delegate_start") {
              setDelegations((prev) =>
                prev.map((dg) => (dg.idx === frame.idx ? { ...dg, status: "running" } : dg)),
              );
            } else if (t === "delegate_token") {
              setDelegations((prev) => {
                const copy = prev.slice();
                const slot = copy[frame.idx];
                if (slot) slot.output += frame.content;
                return copy;
              });
            } else if (t === "delegate_done") {
              setDelegations((prev) =>
                prev.map((dg) => (dg.idx === frame.idx ? { ...dg, status: "done", steps: frame.steps } : dg)),
              );
            } else if (t === "delegate_error") {
              setDelegations((prev) =>
                prev.map((dg) => (dg.idx === frame.idx ? { ...dg, status: "error", error: frame.detail } : dg)),
              );
            } else if (t === "synthesis_start") {
              // marker — UI can switch focus to the synthesis pane
            } else if (t === "synthesis_token") {
              tokenBuf.current += frame.content;
              if (!flushTimer.current) {
                flushTimer.current = setTimeout(() => {
                  const chunk = tokenBuf.current;
                  tokenBuf.current = "";
                  flushTimer.current = null;
                  setSynthesis((p) => p + chunk);
                }, 40);
              }
            } else if (t === "audit") {
              setAgentAudit(frame.audit || null);
            } else if (t === "done") {
              setMeta(frame);
              setDone(true);
              sawDone = true;
            } else if (t === "error") {
              setError(frame.detail);
              sawError = true;
            }
          } catch (e) {
            if (import.meta.env?.DEV) {
              console.error("[agent] SSE parse error:", line?.slice(0, 120), e);
            }
          }
        }
        // An error frame is terminal — stop reading so a later 'done' frame
        // can't paint "Complete" alongside the error.
        if (sawError) break;
      }

      // Stream closed cleanly but the server never sent a terminal frame —
      // surface it so the UI doesn't sit on a half-finished answer forever.
      if (!sawDone && !sawError) setError("Connection closed before completion");
    } catch (e) {
      const err = e as { name?: string; message?: string };
      if (err.name !== "AbortError") setError(err.message ?? "Stream failed");
    } finally {
      // Flush any tokens that didn't fire before the stream closed
      if (flushTimer.current) {
        clearTimeout(flushTimer.current);
        flushTimer.current = null;
      }
      if (tokenBuf.current) {
        const remaining = tokenBuf.current;
        tokenBuf.current = "";
        setOutput((p) => p + remaining);
      }
      setRunning(false);
    }
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setRunning(false);
    setDelegations((prev) => prev.map((dg) => (dg.status === "running" ? { ...dg, status: "stopped" } : dg)));
  }, []);

  return {
    trace,
    output,
    running,
    done,
    meta,
    error,
    plan,
    delegations,
    synthesis,
    agentAudit,
    start,
    stop,
  };
}
