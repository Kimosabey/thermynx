import GlassCard from "@/shared/ui/GlassCard";
import Eyebrow from "@/shared/ui/Eyebrow";
import { Clock } from "lucide-react";

/**
 * TimingPanel — lightweight in-app per-model trace (no Langfuse/infra needed).
 * Renders the per-graph-node wall time captured from the SSE `node_timing` frames
 * (exposed as `timings` by useAgentStream). On the orchestrator the nodes map 1:1
 * to models, so this reads as a per-model performance breakdown.
 *
 * Drop-in:  const { ..., timings } = useAgentStream();  →  <TimingPanel timings={timings} />
 */

interface Timing {
  node: string;
  ms: number;
}

// node → human label + the model that runs it (best-effort; guards have no model).
const NODE_META: Record<string, { label: string; model?: string }> = {
  preflight: { label: "Preflight (guard)" },
  context: { label: "Context fetch" },
  rag: { label: "RAG retrieve", model: "nomic-embed-text" },
  prompt: { label: "Prompt build" },
  llm: { label: "LLM answer", model: "phi4 / devstral" },
  tools: { label: "Tool exec" },
  postcheck: { label: "Postcheck (guard)" },
  critique: { label: "Critique", model: "phi4" },
  planner: { label: "Planner", model: "gemma4:12b" },
  await_approval: { label: "Awaiting approval" },
  specialists: { label: "Specialists", model: "devstral" },
  synthesis: { label: "Synthesis", model: "phi4" },
};

export default function TimingPanel({ timings }: { timings: Timing[] }) {
  if (!timings || timings.length === 0) return null;
  const total = timings.reduce((s, t) => s + t.ms, 0);
  const max = Math.max(1, ...timings.map((t) => t.ms));

  return (
    <GlassCard className="mt-4 p-5">
      <div className="mb-3 flex items-center gap-2">
        <Clock size={15} strokeWidth={2} color="#1F3FFE" />
        <Eyebrow>Model timing (per step)</Eyebrow>
        <span className="ml-auto text-[11px] font-semibold tabular-nums text-ink-muted">
          {(total / 1000).toFixed(1)}s total
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        {timings.map((t, i) => {
          const m = NODE_META[t.node] || { label: t.node };
          const pct = Math.round((t.ms / max) * 100);
          const slow = t.ms >= 8000; // a cross-model cold-load on 20 GB
          return (
            <div key={i} className="flex items-center gap-3 text-[12px]">
              <div className="w-[160px] shrink-0 truncate">
                <span className="font-semibold text-ink">{m.label}</span>
                {m.model && <span className="ml-1 text-ink-faint">· {m.model}</span>}
              </div>
              <div className="relative h-[8px] flex-1 overflow-hidden rounded-full bg-chip">
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300"
                  style={{ width: `${pct}%`, backgroundColor: slow ? "#f59e0b" : "#1F3FFE" }}
                />
              </div>
              <span className="w-[64px] shrink-0 text-right tabular-nums text-ink-muted">
                {t.ms >= 1000 ? `${(t.ms / 1000).toFixed(1)}s` : `${t.ms}ms`}
              </span>
            </div>
          );
        })}
      </div>

      <p className="mt-2 text-[10px] text-ink-muted">
        Per-node wall time (model cold-loads included). On 20 GB a cross-model step pays a cold-load;
        on the 48 GB box these stay warm.
      </p>
    </GlassCard>
  );
}
