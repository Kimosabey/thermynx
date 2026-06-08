import { useEffect, useState } from "react";
import { useToast } from "@chakra-ui/react";
import { apiFetch } from "../api/client";

/**
 * Live model roster — which Ollama model powers each task (from /api/v1/models).
 * Module-level cache so every component shares one fetch.
 */
let _cache = null;
let _inflight = null;

export async function fetchModels() {
  if (_cache) return _cache;
  if (!_inflight) {
    _inflight = apiFetch("/api/v1/models")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { _cache = d; _inflight = null; return d; })
      .catch(() => { _inflight = null; return null; });
  }
  return _inflight;
}

export function useModelRoster() {
  const [roster, setRoster] = useState(_cache);
  useEffect(() => {
    let on = true;
    fetchModels().then((d) => { if (on) setRoster(d); });
    return () => { on = false; };
  }, []);
  return roster;
}

/**
 * useModelToast() → notify(taskKey, { prefix })
 * Fires a bottom-right toast naming the model handling that task, e.g.
 *   notify("text", { prefix: "Analyzing" })  →  "Analyzing · gemma3:27b"
 * Task keys: text | tool | sql | planner | auditor | rag | vision | embed.
 * Deduped per task via a stable toast id so rapid re-runs don't stack.
 */
export function useModelToast() {
  const toast = useToast();
  return async (taskKey, { prefix } = {}) => {
    const roster = await fetchModels();
    const t = roster?.tasks?.[taskKey];
    if (!t) return;
    const id = `model-${taskKey}`;
    if (toast.isActive(id)) toast.close(id);
    toast({
      id,
      title: prefix ? `${prefix} · ${t.model}` : t.model,
      description: `🧠 ${t.label}`,
      status: "info",
      duration: 2600,
      isClosable: true,
      position: "bottom-right",
      variant: "subtle",
    });
  };
}
