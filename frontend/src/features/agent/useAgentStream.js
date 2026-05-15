import { useRef, useState } from "react";

export function useAgentStream() {
  const [trace,      setTrace]      = useState([]);
  const [output,     setOutput]     = useState("");
  const [running,    setRunning]    = useState(false);
  const [done,       setDone]       = useState(false);
  const [meta,       setMeta]       = useState(null);
  const [error,      setError]      = useState(null);
  const abortRef = useRef(null);

  async function start(mode, goal, context = null) {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setTrace([]);
    setOutput("");
    setRunning(true);
    setDone(false);
    setMeta(null);
    setError(null);

    try {
      const res = await fetch("/api/v1/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, goal, context }),
        signal: ctrl.signal,
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
            if (frame.type === "tool_call" || frame.type === "tool_result") {
              setTrace((p) => [...p, frame]);
            } else if (frame.type === "token") {
              setOutput((p) => p + frame.content);
            } else if (frame.type === "done") {
              setMeta(frame);
              setDone(true);
            } else if (frame.type === "error") {
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

  return { trace, output, running, done, meta, error, start, stop };
}
