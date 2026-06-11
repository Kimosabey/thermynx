import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Cpu, X } from "lucide-react";
import { toast } from "sonner";

import { apiFetch } from "@/shared/api/client";
import type { ModelRoster, ModelTask } from "@/shared/types";

/**
 * Live model roster — which Ollama model powers each task (from /api/v1/models),
 * with maker / country / size / purpose. Module-level cache → one fetch shared.
 */
let _cache: ModelRoster | null = null;
let _inflight: Promise<ModelRoster | null> | null = null;

export async function fetchModels(): Promise<ModelRoster | null> {
  if (_cache) return _cache;
  if (!_inflight) {
    _inflight = apiFetch("/api/v1/models")
      .then((r) => (r.ok ? (r.json() as Promise<ModelRoster>) : null))
      .then((d) => {
        _cache = d;
        _inflight = null;
        return d;
      })
      .catch(() => {
        _inflight = null;
        return null;
      });
  }
  return _inflight;
}

export function useModelRoster(): ModelRoster | null {
  const [roster, setRoster] = useState<ModelRoster | null>(_cache);
  useEffect(() => {
    let on = true;
    fetchModels().then((d) => {
      if (on) setRoster(d);
    });
    return () => {
      on = false;
    };
  }, []);
  return roster;
}

/** Modern glass toast card: gradient icon tile · model · purpose · maker chip. */
function ModelToastCard({
  prefix,
  t,
  onClose,
}: {
  prefix?: string;
  t: ModelTask;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      role="status"
      className="relative flex min-w-[300px] max-w-[380px] items-center gap-3 overflow-hidden rounded-[14px] border border-border-subtle bg-glass py-3 pr-3 pl-[14px] shadow-[0_12px_40px_rgba(0,0,0,0.28),0_0_0_1px_rgba(6,182,212,0.10)] backdrop-blur-md"
    >
      {/* accent rail */}
      <span
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: "linear-gradient(180deg, #1F3FFE, #06B6D4)" }}
      />

      {/* gradient icon tile */}
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-[10px] text-white shadow-[0_4px_14px_rgba(6,182,212,0.35)]"
        style={{ background: "linear-gradient(135deg, #1F3FFE, #06B6D4)" }}
      >
        <Cpu size={18} strokeWidth={2} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-2">
          {prefix && (
            <span className="shrink-0 text-[10px] font-bold tracking-[0.08em] text-cyan uppercase">
              {prefix}
            </span>
          )}
          <span className="truncate text-[13px] font-extrabold text-ink tabular-nums">{t.model}</span>
        </div>
        <p className="truncate text-[11px] leading-tight text-ink-muted">{t.purpose || t.label}</p>
        {t.maker && t.maker !== "—" && (
          <div className="mt-1 flex items-center gap-1.5">
            <span className="rounded-full border border-border-subtle bg-chip px-1.5 py-px text-[9px] text-ink-secondary">
              {t.flag ? `${t.flag} ` : ""}
              {t.maker}
            </span>
            {t.params && t.params !== "—" && <span className="text-[10px] text-ink-faint">{t.params}</span>}
            {t.kind && t.kind !== "—" && <span className="text-[10px] text-ink-faint">· {t.kind}</span>}
          </div>
        )}
      </div>

      <button
        type="button"
        aria-label="Dismiss"
        onClick={onClose}
        className="shrink-0 self-start p-1 text-ink-faint transition-colors hover:text-ink"
      >
        <X size={13} strokeWidth={2.5} />
      </button>
    </motion.div>
  );
}

// All model toasts share ONE id so they occupy a single slot — a new model
// (tool → text → auditor as a run progresses) REPLACES the previous one in
// place rather than stacking. Guarantees model toasts never collide/overlap,
// regardless of how many models a flow engages or how fast they fire.
const MODEL_TOAST_ID = "model-inuse";

/**
 * useModelToast() → notify(taskKey, { prefix })
 * Fires a single, self-replacing bottom-right toast naming the model + maker
 * handling a task. Task keys: text | tool | sql | planner | auditor | rag |
 * vision | embed. Because every model toast uses MODEL_TOAST_ID, sequential
 * model handoffs update one toast in place — they never stack or overlap.
 */
export function useModelToast() {
  return async (taskKey: string, { prefix }: { prefix?: string } = {}) => {
    const roster = await fetchModels();
    const task = roster?.tasks?.[taskKey];
    if (!task) return;
    toast.custom((id) => <ModelToastCard prefix={prefix} t={task} onClose={() => toast.dismiss(id)} />, {
      id: MODEL_TOAST_ID,
      duration: 2800,
    });
  };
}
