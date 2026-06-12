import { useRef, useState, useCallback, useEffect } from "react";
import { useModelToast } from "@/shared/ai/useModels";
import { makeModelToaster } from "@/shared/ai/modelStreamToast";

/**
 * SSE streaming hook for the agent surface. Ported VERBATIM from the legacy
 * `frontend/src/features/agent/useAgentStream.js` — the 40ms token-buffer flush
 * and AbortController handling are load-bearing; only types were added.
 *
 * F4.9 — the orchestrator can pause for operator approval of the plan. When the
 * backend emits `awaiting_approval`, the run halts with `awaitingApproval=true`;
 * `resume("approve"|"reject")` continues it via POST /api/v1/agent/resume. The
 * SSE frame loop is shared (`pump`) so the resume leg renders identically.
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
  // Per-node timing (node + ms) → lightweight in-app model trace (no Langfuse).
  const [timings, setTimings] = useState<{ node: string; ms: number }[]>([]);
  // F4.9 HITL — true while the orchestrator is paused awaiting plan approval.
  const [awaitingApproval, setAwaitingApproval] = useState(false);
  const approvalThreadId = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const tokenBuf = useRef("");
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Live model toasts driven by the SSE frames — kept in a ref so the empty-dep
  // useCallbacks always reach the current notify fn. The ref is synced in an
  // effect (not during render) to satisfy react-hooks/refs.
  const notify = useModelToast();
  const notifyRef = useRef(notify);
  useEffect(() => {
    notifyRef.current = notify;
  });

  // Drain an SSE response, dispatching frames to state. Shared by start() and
  // resume() so the orchestrator's resume continuation renders identically.
  const pump = useCallback(
    async (res: Response, isOrchestrator: boolean, mt: ReturnType<typeof makeModelToaster>) => {
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
            mt.frame(t); // toast each model the moment it's engaged (deduped)

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
            } else if (t === "awaiting_approval") {
              // F4.9 — orchestrator paused for sign-off. Stash the thread to resume;
              // the plan was already set by the preceding `plan` frame (fallback here).
              // Treat as a clean (non-error) terminal frame for this leg.
              approvalThreadId.current = frame.thread_id ?? null;
              if (frame.plan?.subtasks) {
                setPlan((prev) => prev ?? { rationale: frame.plan.rationale, subtasks: frame.plan.subtasks });
              }
              setAwaitingApproval(true);
              sawDone = true;
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
            } else if (t === "node_timing") {
              setTimings((prev) => [...prev, { node: frame.node, ms: frame.ms }]);
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
    },
    [],
  );

  // Flush any buffered tokens that didn't fire before a stream closed.
  const flushPending = useCallback(() => {
    if (flushTimer.current) {
      clearTimeout(flushTimer.current);
      flushTimer.current = null;
    }
    if (tokenBuf.current) {
      const remaining = tokenBuf.current;
      tokenBuf.current = "";
      setOutput((p) => p + remaining);
    }
  }, []);

  const start = useCallback(
    async (mode: string, goal: string, context: unknown = null, requireApproval = false) => {
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
      setTimings([]);
      setAwaitingApproval(false);
      approvalThreadId.current = null;
      setRunning(true);
      setDone(false);
      setMeta(null);
      setError(null);

      const mt = makeModelToaster((task, o) => notifyRef.current(task, o), isOrchestrator ? "Orchestrator" : "Agent");

      const url = isOrchestrator ? "/api/v1/agent/orchestrate" : "/api/v1/agent/run";
      const body = isOrchestrator
        ? { goal, context, require_approval: requireApproval }
        : { mode, goal, context };

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
        await pump(res, isOrchestrator, mt);
      } catch (e) {
        const err = e as { name?: string; message?: string };
        if (err.name !== "AbortError") setError(err.message ?? "Stream failed");
      } finally {
        flushPending();
        setRunning(false);
      }
    },
    [pump, flushPending],
  );

  // F4.9 — resume a paused orchestration with the operator's decision. `approve`
  // optionally carries an edited plan; `reject` cancels (backend returns a refusal).
  const resume = useCallback(
    async (action: "approve" | "reject", editedPlan: AgentPlan | null = null) => {
      const threadId = approvalThreadId.current;
      if (!threadId) return;
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      if (flushTimer.current) {
        clearTimeout(flushTimer.current);
        flushTimer.current = null;
      }
      setAwaitingApproval(false);
      setRunning(true);
      setError(null);

      const mt = makeModelToaster((task, o) => notifyRef.current(task, o), "Orchestrator");
      const body: { thread_id: string; action: string; plan?: AgentPlan } = { thread_id: threadId, action };
      if (action === "approve" && editedPlan) body.plan = editedPlan;

      try {
        const res = await fetch("/api/v1/agent/resume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
        await pump(res, true, mt);
      } catch (e) {
        const err = e as { name?: string; message?: string };
        if (err.name !== "AbortError") setError(err.message ?? "Resume failed");
      } finally {
        flushPending();
        setRunning(false);
        approvalThreadId.current = null;
      }
    },
    [pump, flushPending],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setRunning(false);
    setAwaitingApproval(false);
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
    timings,
    awaitingApproval,
    start,
    resume,
    stop,
  };
}
