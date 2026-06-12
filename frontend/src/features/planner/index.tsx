import { useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import {
  Waypoints,
  Play,
  ScanSearch,
  Zap,
  Microscope,
  Wrench,
  Network,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import PageShell from "@/shared/ui/PageShell";
import PageHeader from "@/shared/ui/PageHeader";
import PageHeaderIcon from "@/shared/ui/PageHeaderIcon";
import GlassCard from "@/shared/ui/GlassCard";
import Eyebrow from "@/shared/ui/Eyebrow";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import MovingBorder from "@/shared/ui/MovingBorder";
import { useModelToast } from "@/shared/ai/useModels";
import { ENGINE_COLOR } from "@/shared/theme/engineColors";

/**
 * Planner Inspector — run ONLY the orchestrator's planner (gemma4) on a goal and
 * show how it decomposes it into specialist sub-tasks. No specialists execute.
 * Hits POST /api/v1/agent/plan (JSON, one-shot). Useful for understanding/debugging
 * planner behaviour without paying for a full multi-agent run.
 */

interface Subtask {
  specialist: string;
  goal: string;
}
interface Plan {
  rationale?: string;
  subtasks: Subtask[];
}
interface PlanResponse {
  plan?: Plan | null;
  model?: string;
  refusal?: string;
  error?: string;
  detail?: string;
}

const SPECIALIST_META: Record<string, { Icon: LucideIcon; color: string; label: string }> = {
  investigator: { Icon: ScanSearch, color: ENGINE_COLOR.investigator, label: "Investigator" },
  optimizer: { Icon: Zap, color: ENGINE_COLOR.optimizer, label: "Optimizer" },
  root_cause: { Icon: Microscope, color: ENGINE_COLOR.root_cause, label: "Root Cause" },
  maintenance: { Icon: Wrench, color: ENGINE_COLOR.maintenance, label: "Maintenance" },
};

const PRESETS = [
  "Diagnose why total plant energy is up, propose fixes, and plan maintenance",
  "Investigate Chiller 1 problems, find optimisations, and produce a maintenance plan",
  "Full plant audit: investigate issues, optimise operations, plan next-week maintenance",
  "Compare both chillers, root-cause the weaker one, and recommend actions",
];

export default function PlannerInspector() {
  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const notifyModel = useModelToast();
  const goalOk = goal.trim().length >= 3;

  async function run() {
    if (!goalOk || loading) return;
    setLoading(true);
    setPlan(null);
    setError(null);
    setRefusal(null);
    setModel(null);
    notifyModel("planner", { prefix: "Planner" });
    try {
      const res = await fetch("/api/v1/agent/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: goal.trim() }),
      });
      const data: PlanResponse = await res.json().catch(() => ({}) as PlanResponse);
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
      setModel(data.model ?? null);
      if (data.refusal) {
        setRefusal(data.refusal);
        return;
      }
      if (data.error) {
        setError(data.error);
        return;
      }
      setPlan(data.plan ?? null);
    } catch (e) {
      setError((e as Error).message ?? "Planner request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell className="max-w-[980px]">
      <PageHeader
        title="Planner Inspector"
        subtitle={
          <>
            See how the orchestrator's planner (
            <span className="font-semibold text-brand">{model || "gemma4:12b"}</span>) breaks a goal into
            specialist sub-tasks — no specialists run.
          </>
        }
        icon={<PageHeaderIcon icon={<Waypoints size={20} strokeWidth={1.85} />} />}
        className="mb-6"
      />

      <GlassCard className="p-5">
        <Label
          htmlFor="planner-goal"
          className="mb-1 block text-[10px] font-bold tracking-[0.10em] text-ink-muted uppercase"
        >
          Goal
        </Label>
        <Textarea
          id="planner-goal"
          value={goal}
          onChange={(e) => setGoal(e.target.value.slice(0, 2000))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) run();
          }}
          placeholder="e.g. Diagnose why energy is up 12%, propose fixes, and plan maintenance for next month"
          rows={3}
          maxLength={2000}
          className="resize-y rounded-[10px] border border-border-subtle bg-elevated text-sm text-ink placeholder:text-ink-muted focus-visible:ring-0"
          style={{ "--tw-ring-color": "transparent" } as CSSProperties}
        />
        <div className="mt-2 mb-3 flex flex-wrap gap-2">
          {PRESETS.map((p, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setGoal(p)}
              className="rounded-full border border-border-subtle bg-chip px-3 py-1 text-[11px] text-ink-muted transition-colors hover:border-border-brand hover:text-brand"
            >
              {p}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-ink-muted">Ctrl+Enter to plan · runs only the planner</p>
          <motion.div whileTap={{ scale: 0.96 }}>
            <MovingBorder
              icon={loading ? undefined : Play}
              tone="primary"
              size="md"
              onClick={run}
              isDisabled={!goalOk || loading}
            >
              {loading ? "Planning…" : "Run Planner"}
            </MovingBorder>
          </motion.div>
        </div>
      </GlassCard>

      {(loading || plan || error || refusal) && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="mt-5"
        >
          {loading && (
            <GlassCard className="flex items-center gap-2 p-5">
              <Loader2 className="size-4 animate-spin text-brand" />
              <p className="text-sm text-ink-muted">
                Planner is decomposing the goal… (gemma4 may cold-load on the first run)
              </p>
            </GlassCard>
          )}
          {refusal && !loading && (
            <GlassCard className="p-5">
              <p className="text-sm text-warn">{refusal}</p>
            </GlassCard>
          )}
          {error && !loading && (
            <GlassCard className="p-5">
              <p role="alert" className="text-sm text-bad">
                {error}
              </p>
            </GlassCard>
          )}
          {plan && !loading && (
            <GlassCard className="p-5">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Network size={16} strokeWidth={2} color="#1F3FFE" />
                <Eyebrow>Planner output</Eyebrow>
                <Badge className="ml-auto rounded-md border border-border-subtle bg-chip px-2 text-[9px] text-ink-muted">
                  {plan.subtasks.length} subtask{plan.subtasks.length === 1 ? "" : "s"}
                </Badge>
                {model && (
                  <Badge className="rounded-md border border-border-brand bg-[var(--glow)] px-2 text-[9px] font-bold text-brand">
                    {model}
                  </Badge>
                )}
              </div>
              {plan.rationale && <p className="mb-3 text-sm text-ink">{plan.rationale}</p>}
              <div className="flex flex-col gap-2">
                {plan.subtasks.map((s, i) => {
                  const m = SPECIALIST_META[s.specialist] || { color: "#64748b", label: s.specialist };
                  return (
                    <div
                      key={i}
                      className="flex min-w-0 items-center gap-3 rounded-md border border-border-subtle bg-chip px-3 py-2"
                    >
                      <p className="w-[18px] text-[11px] font-bold text-ink-muted tabular-nums">{i + 1}</p>
                      <Badge
                        className="rounded-md border px-2 py-[2px] text-[9px] tracking-[0.06em] uppercase"
                        style={{ backgroundColor: m.color + "22", color: m.color, borderColor: m.color + "44" }}
                      >
                        {m.label}
                      </Badge>
                      <p className="min-w-0 flex-1 text-xs text-ink [overflow-wrap:anywhere]">{s.goal}</p>
                    </div>
                  );
                })}
              </div>
            </GlassCard>
          )}
        </motion.div>
      )}
    </PageShell>
  );
}
