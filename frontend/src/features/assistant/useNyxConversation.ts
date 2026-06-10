import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/shared/api/client";
import { useModelToast } from "@/shared/ai/useModels";
import type { CitationChunk } from "@/features/analyzer/CitationFootnotes";
import type { AuditResult, VerificationResult } from "@/features/analyzer/AuditPanel";
import { modeToastTask } from "./nyxModes";

// Re-export the analyzer's citation chunk shape so the Nyx turn timeline and the
// analyzer's CitationsList / CitationDrawer / footnote markers share one type
// (legacy passed the same chunk objects between the two features).
export type { CitationChunk };

/**
 * Nyx conversation engine — owns the turn timeline + threads + routing + the
 * unified SSE/JSON streaming. One turn at a time streams (sequential), so a
 * single token buffer is safe. Reuses the analyzer + useAgentStream frame
 * vocabularies, merged by EFFECT ON THE TURN (not by origin engine).
 *
 * Ported VERBATIM from the legacy `useNyxConversation.js` — the 40ms token
 * buffer flush, AbortController handling, and reader loop are load-bearing;
 * only types were added.
 */

// ── Turn / audit / verification shapes (mirror analyzer) ────────────────────
export type TurnStatus = "routing" | "streaming" | "done" | "stopped" | "error";

export interface TraceFrame {
  type: string;
  idx?: number | null;
  step?: number | null;
  tool?: string;
  args?: Record<string, unknown> | null;
  result?: unknown;
  [key: string]: unknown;
}

export type DelegationStatus = "pending" | "running" | "done" | "error";

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

export interface TurnPlan {
  rationale?: string;
  subtasks?: Subtask[];
}

export interface Subtask {
  specialist: string;
  goal: string;
  [key: string]: unknown;
}

export interface RoutedMode {
  engine?: string;
  equipment_id?: string | null;
  hours?: number | null;
  overridden: boolean;
}

export type TurnMeta = Record<string, unknown> & {
  model?: string;
  total_ms?: number | null;
  audit_id?: string | null;
};

export type TurnAudit = AuditResult;
export type TurnVerification = VerificationResult;

export interface SqlResult {
  sql?: string;
  columns?: string[];
  rows?: Record<string, unknown>[];
  row_count?: number;
  warnings?: string[];
  [key: string]: unknown;
}

export interface UserTurnData {
  id: string;
  role: "user";
  text: string;
}

export interface AssistantTurnData {
  id: string;
  role: "assistant";
  status?: TurnStatus;
  routedMode?: RoutedMode | null;
  markdown?: string;
  trace: TraceFrame[];
  delegations: Delegation[];
  citations: CitationChunk[];
  audit?: TurnAudit | null;
  verification?: TurnVerification | null;
  plan?: TurnPlan;
  sql?: SqlResult;
  meta?: TurnMeta;
  auditId?: string | null;
  refusal?: boolean;
  error?: string;
}

export type Turn = UserTurnData | AssistantTurnData;

export interface ThreadSummary {
  id: string;
  title?: string;
  [key: string]: unknown;
}

interface ThreadMessage {
  id: string;
  role: string;
  content: string;
}

interface RouteDispatch {
  stream?: boolean;
  path?: string;
  body?: Record<string, unknown>;
}

interface RouteResponse {
  engine?: string;
  equipment_id?: string | null;
  hours?: number | null;
  preflight_refusal?: string | null;
  dispatch?: RouteDispatch;
}

const newId = (): string =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `t-${Math.random().toString(36).slice(2)}`;

type AssistantUpdater =
  | Partial<AssistantTurnData>
  | ((t: AssistantTurnData) => Partial<AssistantTurnData>);

export function useNyxConversation() {
  const [turns, setTurns] = useState<Turn[]>([]); // [{id, role, ...}]
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [activeThreadId, setActiveThreadId] = useState("");
  const [busy, setBusy] = useState(false);

  const notifyModel = useModelToast();
  const abortRef = useRef<AbortController | null>(null);
  const sendingRef = useRef(false);
  const activeAidRef = useRef<string | null>(null);
  const bufRef = useRef("");
  const flushRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const threadRef = useRef("");
  useEffect(() => {
    threadRef.current = activeThreadId;
  }, [activeThreadId]);

  const patch = useCallback((id: string, updater: AssistantUpdater) => {
    setTurns((prev) =>
      prev.map((t) =>
        t.id === id && t.role === "assistant"
          ? { ...t, ...(typeof updater === "function" ? updater(t) : updater) }
          : t,
      ),
    );
  }, []);

  // ── threads ────────────────────────────────────────────────────────────────
  const refreshThreads = useCallback(async () => {
    try {
      const j = (await (await apiFetch("/api/v1/threads")).json()) as { threads?: ThreadSummary[] };
      setThreads(j.threads || []);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    // Initial threads fetch on mount — ported verbatim from the legacy hook;
    // refreshThreads() only setState()s after the network resolves (async),
    // never synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshThreads();
  }, [refreshThreads]);

  const newThread = useCallback(() => {
    abortRef.current?.abort();
    setBusy(false);
    setActiveThreadId("");
    setTurns([]);
  }, []);

  const selectThread = useCallback(async (id: string) => {
    abortRef.current?.abort();
    setBusy(false);
    setActiveThreadId(id);
    setTurns([]);
    if (!id) return;
    try {
      const j = (await (await apiFetch(`/api/v1/threads/${id}/messages`)).json()) as { messages?: ThreadMessage[] };
      setTurns(
        (j.messages || []).map((m): Turn =>
          m.role === "user"
            ? { id: m.id, role: "user", text: m.content }
            : { id: m.id, role: "assistant", status: "done", markdown: m.content, trace: [], delegations: [], citations: [] },
        ),
      );
    } catch {
      /* ignore */
    }
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setBusy(false);
    if (activeAidRef.current)
      patch(activeAidRef.current, (t) => (t.status === "done" ? {} : { status: "stopped" }));
  }, [patch]);

  // ── token buffer (40ms flush) ────────────────────────────────────────────
  function bufferToken(id: string, chunk: string) {
    bufRef.current += chunk;
    if (!flushRef.current) {
      flushRef.current = setTimeout(() => {
        const c = bufRef.current;
        bufRef.current = "";
        flushRef.current = null;
        patch(id, (t) => ({ markdown: (t.markdown || "") + c }));
      }, 40);
    }
  }
  function flushNow(id: string) {
    if (flushRef.current) {
      clearTimeout(flushRef.current);
      flushRef.current = null;
    }
    if (bufRef.current) {
      const c = bufRef.current;
      bufRef.current = "";
      patch(id, (t) => ({ markdown: (t.markdown || "") + c }));
    }
  }

  // ── SSE engines (analyze / agent / orchestrate) ─────────────────────────────
  async function runStream(id: string, endpoint: string, body: Record<string, unknown>, signal: AbortSignal) {
    const res = await apiFetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok)
      throw new Error(((await res.json().catch(() => ({}))) as { detail?: string }).detail || `HTTP ${res.status}`);
    if (!res.body) throw new Error("No response body");
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let sawDone = false;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        // SSE frames are server-defined; parse loosely and dispatch on `type`.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let f: any;
        try {
          f = JSON.parse(line.slice(6));
        } catch {
          continue;
        }
        const t = f.type;
        if (t === "token" || t === "synthesis_token") bufferToken(id, f.content || "");
        else if (t === "citations") patch(id, { citations: f.chunks || [] });
        else if (t === "audit") patch(id, { audit: f.audit || null });
        else if (t === "verification") patch(id, { verification: f.verdict || null });
        else if (t === "tool_call" || t === "tool_result") {
          if (f.idx != null)
            patch(id, (tn) => {
              const dels = tn.delegations.slice();
              if (dels[f.idx]) dels[f.idx] = { ...dels[f.idx], trace: [...dels[f.idx].trace, f] };
              return { delegations: dels };
            });
          else patch(id, (tn) => ({ trace: [...tn.trace, f] }));
        } else if (t === "plan")
          patch(id, {
            plan: { rationale: f.rationale, subtasks: f.subtasks },
            delegations: (f.subtasks || []).map((s: Subtask, i: number) => ({
              idx: i,
              specialist: s.specialist,
              goal: s.goal,
              status: "pending" as DelegationStatus,
              trace: [],
              output: "",
              steps: 0,
              error: null,
            })),
          });
        else if (t === "delegate_start")
          patch(id, (tn) => ({ delegations: tn.delegations.map((d) => (d.idx === f.idx ? { ...d, status: "running" } : d)) }));
        else if (t === "delegate_token")
          patch(id, (tn) => {
            const dels = tn.delegations.slice();
            if (dels[f.idx]) dels[f.idx] = { ...dels[f.idx], output: dels[f.idx].output + (f.content || "") };
            return { delegations: dels };
          });
        else if (t === "delegate_done")
          patch(id, (tn) => ({ delegations: tn.delegations.map((d) => (d.idx === f.idx ? { ...d, status: "done", steps: f.steps } : d)) }));
        else if (t === "delegate_error")
          patch(id, (tn) => ({ delegations: tn.delegations.map((d) => (d.idx === f.idx ? { ...d, status: "error", error: f.detail } : d)) }));
        else if (t === "done") {
          sawDone = true;
          flushNow(id);
          patch(id, { meta: f, auditId: f.audit_id || null, status: "done" });
        } else if (t === "error") throw new Error(f.detail || "Stream error");
      }
    }
    flushNow(id);
    if (!sawDone) throw new Error("Connection closed before completion");
  }

  // ── nl-query (plain JSON) ───────────────────────────────────────────────────
  async function runSql(id: string, body: Record<string, unknown>, signal: AbortSignal) {
    const res = await apiFetch("/api/v1/nl-query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    const j = (await res.json().catch(() => ({}))) as SqlResult & { detail?: string };
    if (!res.ok) throw new Error(j.detail || `HTTP ${res.status}`);
    patch(id, { sql: j, status: "done" });
  }

  // ── send a message ──────────────────────────────────────────────────────────
  const send = useCallback(
    async (message: string, forcedEngine: string | null = null) => {
      if (sendingRef.current) return;
      sendingRef.current = true;
      const text = (message || "").trim();
      if (!text || busy) {
        sendingRef.current = false;
        return;
      }
      setBusy(true);

      // auto-create a thread on first message → conversational memory by default
      let tid = threadRef.current;
      if (!tid) {
        try {
          const j = (await (
            await apiFetch("/api/v1/threads", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
          ).json()) as { id: string };
          tid = j.id;
          setActiveThreadId(tid);
          refreshThreads();
        } catch {
          /* memory-less fallback */
        }
      }

      const userId = newId(),
        aId = newId();
      activeAidRef.current = aId;
      setTurns((p) => [
        ...p,
        { id: userId, role: "user", text },
        { id: aId, role: "assistant", status: "routing", routedMode: null, markdown: "", trace: [], delegations: [], citations: [] },
      ]);

      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        // 1) route
        const rr = await apiFetch("/api/v1/assistant/route", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, thread_id: tid || null, force_engine: forcedEngine }),
          signal: ctrl.signal,
        });
        const route = (await rr.json()) as RouteResponse;
        patch(aId, {
          routedMode: { engine: route.engine, equipment_id: route.equipment_id, hours: route.hours, overridden: !!forcedEngine },
          status: "streaming",
        });
        try {
          notifyModel(modeToastTask(route.engine), { prefix: "Nyx" });
        } catch {
          /* non-blocking */
        }

        // preflight refusal → show + stop
        if (route.preflight_refusal) {
          patch(aId, { markdown: route.preflight_refusal, status: "done", refusal: true });
          return;
        }

        const d = route.dispatch || {};
        const body: Record<string, unknown> = { ...(d.body || {}) };
        if ("thread_id" in body) body.thread_id = tid || null;

        if (d.stream) await runStream(aId, d.path as string, body, ctrl.signal);
        else await runSql(aId, body, ctrl.signal);

        patch(aId, (t) => (t.status === "done" ? {} : { status: "done" }));
        if (tid) refreshThreads();
      } catch (e) {
        const err = e as { name?: string; message?: string };
        if (err.name !== "AbortError") patch(aId, { error: err.message || String(e), status: "error" });
        else patch(aId, { status: "stopped" });
      } finally {
        setBusy(false);
        sendingRef.current = false;
      }
    },
    // Deps ported verbatim from the legacy hook. runStream/runSql are inline
    // closures recreated each render (no stable identity) and are intentionally
    // excluded to preserve the original behavior.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busy, patch, refreshThreads, notifyModel],
  );

  return { turns, threads, activeThreadId, busy, send, stop, newThread, selectThread };
}
