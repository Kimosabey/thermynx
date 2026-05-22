import { useRef, useState } from "react";

export function useAgentStream() {
  const [trace,       setTrace]       = useState([]);
  const [output,      setOutput]      = useState("");
  const [running,     setRunning]     = useState(false);
  const [done,        setDone]        = useState(false);
  const [meta,        setMeta]        = useState(null);
  const [error,       setError]       = useState(null);
  // Multi-agent state
  const [plan,        setPlan]        = useState(null);
  const [delegations, setDelegations] = useState([]);
  const [synthesis,   setSynthesis]   = useState("");
  const abortRef = useRef(null);

  async function start(mode, goal, context = null) {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const isOrchestrator = mode === "orchestrator";
    setTrace([]);
    setOutput("");
    setPlan(null);
    setDelegations([]);
    setSynthesis("");
    setRunning(true);
    setDone(false);
    setMeta(null);
    setError(null);

    const url  = isOrchestrator ? "/api/v1/agent/orchestrate" : "/api/v1/agent/run";
    const body = isOrchestrator
      ? { goal, context }
      : { mode, goal, context };

    try {
      const res = await fetch(url, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
        signal:  ctrl.signal,
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `HTTP ${res.status}`);

      const reader = res.body.getReader();
      const dec    = new TextDecoder();
      let buf      = "";

      while (true) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop();

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const frame = JSON.parse(line.slice(6));
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
              setOutput((p) => p + frame.content);
            } else if (t === "plan") {
              setPlan({ rationale: frame.rationale, subtasks: frame.subtasks, run_id: frame.run_id });
              setDelegations(frame.subtasks.map((s, i) => ({
                idx:        i,
                specialist: s.specialist,
                goal:       s.goal,
                status:     "pending",
                trace:      [],
                output:     "",
                steps:      0,
                error:      null,
              })));
            } else if (t === "delegate_start") {
              setDelegations((prev) => prev.map((d) => d.idx === frame.idx ? { ...d, status: "running" } : d));
            } else if (t === "delegate_token") {
              setDelegations((prev) => {
                const copy = prev.slice();
                const slot = copy[frame.idx];
                if (slot) slot.output += frame.content;
                return copy;
              });
            } else if (t === "delegate_done") {
              setDelegations((prev) => prev.map((d) =>
                d.idx === frame.idx ? { ...d, status: "done", steps: frame.steps } : d
              ));
            } else if (t === "delegate_error") {
              setDelegations((prev) => prev.map((d) =>
                d.idx === frame.idx ? { ...d, status: "error", error: frame.detail } : d
              ));
            } else if (t === "synthesis_start") {
              // marker — UI can switch focus to the synthesis pane
            } else if (t === "synthesis_token") {
              setSynthesis((p) => p + frame.content);
            } else if (t === "done") {
              setMeta(frame);
              setDone(true);
            } else if (t === "error") {
              setError(frame.detail);
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (e) {
      if (e.name !== "AbortError") setError(e.message);
    } finally {
      setRunning(false);
    }
  }

  function stop() {
    abortRef.current?.abort();
    setRunning(false);
  }

  return {
    trace, output, running, done, meta, error,
    plan, delegations, synthesis,
    start, stop,
  };
}
