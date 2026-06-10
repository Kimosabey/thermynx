/**
 * MultiAgentRunner — render the orchestrator's plan + per-specialist sub-streams + synthesis.
 *
 * Layout:
 *   1. Plan card (rationale + ordered list of subtasks)
 *   2. Per-specialist accordion (status chip + live token stream + collapsible tool trace)
 *   3. Synthesis card (final markdown answer)
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Network,
  ScanSearch,
  Zap,
  Microscope,
  Wrench,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import GlassCard from "@/shared/ui/GlassCard";
import Eyebrow from "@/shared/ui/Eyebrow";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ENGINE_COLOR } from "@/shared/theme/engineColors";
import type { AgentPlan, Delegation, AgentMeta, DelegationStatus, TraceFrame } from "./useAgentStream";

interface SpecialistMeta {
  Icon: LucideIcon;
  color: string;
  label: string;
}

const SPECIALIST_META: Record<string, SpecialistMeta> = {
  investigator: { Icon: ScanSearch, color: ENGINE_COLOR.investigator, label: "Investigator" },
  optimizer: { Icon: Zap, color: ENGINE_COLOR.optimizer, label: "Optimizer" },
  root_cause: { Icon: Microscope, color: ENGINE_COLOR.root_cause, label: "Root Cause" },
  maintenance: { Icon: Wrench, color: ENGINE_COLOR.maintenance, label: "Maintenance" },
};

interface StatusMeta {
  color: string;
  bg: string;
  label: string;
}

const STATUS_META: Record<DelegationStatus | "stopped", StatusMeta> = {
  pending: { color: "var(--ink-muted)", bg: "var(--chip)", label: "queued" },
  running: { color: "#0ea5e9", bg: "rgba(14,165,233,0.12)", label: "running" },
  done: { color: "#10b981", bg: "rgba(16,185,129,0.12)", label: "done" },
  error: { color: "#ef4444", bg: "rgba(239,68,68,0.12)", label: "error" },
  stopped: { color: "var(--ink-muted)", bg: "var(--chip)", label: "stopped" },
};

function MarkdownBlock({ content }: { content?: string }) {
  return (
    <div
      className={cn(
        "max-w-full overflow-hidden",
        "[&_h2]:mt-3 [&_h2]:mb-2 [&_h2]:border-b [&_h2]:border-border-subtle [&_h2]:pb-2 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-ink",
        "[&_h3]:mt-3 [&_h3]:mb-2 [&_h3]:text-sm [&_h3]:font-bold [&_h3]:text-brand",
        "[&_p]:mb-2 [&_p]:text-sm [&_p]:leading-[1.7] [&_p]:break-words [&_p]:text-ink",
        "[&_ul]:mb-2 [&_ul]:pl-5 [&_ol]:mb-2 [&_ol]:pl-5",
        "[&_li]:mb-[2px] [&_li]:text-sm [&_li]:break-words [&_li]:text-ink",
        "[&_strong]:font-bold [&_strong]:text-ink",
        "[&_code]:rounded-[5px] [&_code]:bg-chip [&_code]:px-[5px] [&_code]:py-[1px] [&_code]:font-mono [&_code]:text-[0.82em] [&_code]:break-words [&_code]:text-brand",
        "[&_pre]:max-w-full [&_pre]:overflow-x-auto",
        "[&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto",
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content || ""}</ReactMarkdown>
    </div>
  );
}

function DelegationCard({ d }: { d: Delegation }) {
  const [open, setOpen] = useState(d.status === "running");
  const meta = SPECIALIST_META[d.specialist] || {
    Icon: Network,
    color: "#64748b",
    label: d.specialist,
  };
  const status = STATUS_META[d.status] || STATUS_META.pending;
  const SIcon = meta.Icon;

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <GlassCard className="overflow-hidden p-0">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "flex w-full items-center gap-3 px-4 py-3 text-left transition-[background] duration-150 hover:bg-[rgba(31,63,254,0.04)]",
            open ? "border-b border-border-subtle" : "",
          )}
        >
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border"
            style={{
              backgroundColor: meta.color + "22",
              borderColor: meta.color + "55",
              color: meta.color,
            }}
          >
            <SIcon size={15} strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-bold text-ink">{meta.label}</p>
              <Badge
                className="rounded-md border px-2 py-[2px] text-[9px] tracking-[0.06em] uppercase"
                style={{
                  backgroundColor: status.bg,
                  color: status.color,
                  borderColor: status.color + "44",
                }}
              >
                {d.status === "running" && <Loader2 className="mr-[6px] size-3 animate-spin" />}
                {status.label}
              </Badge>
              {d.steps > 0 && (
                <Badge className="rounded-md border border-border-subtle bg-chip px-2 text-[9px] text-ink-muted">
                  {d.steps} step{d.steps === 1 ? "" : "s"}
                </Badge>
              )}
            </div>
            <p className="mt-[2px] line-clamp-2 text-xs text-ink-muted">{d.goal}</p>
          </div>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 py-3">
                {d.trace.length > 0 && (
                  <div className="mb-3">
                    <Eyebrow className="mb-2">Tool calls</Eyebrow>
                    {d.trace.map((f: TraceFrame, i: number) => {
                      const args = f.args as Record<string, unknown> | undefined;
                      return (
                        <div key={i} className="flex min-w-0 items-center gap-2 py-[3px] text-[11px]">
                          {f.type === "tool_call" ? (
                            <div className="h-[6px] w-[6px] rounded-full bg-brand" />
                          ) : (
                            <CheckCircle2 size={11} strokeWidth={2.4} color="#10b981" />
                          )}
                          <p className="font-mono text-ink-muted">{String(f.tool ?? "")}</p>
                          {f.type === "tool_call" && args && Object.keys(args).length > 0 && (
                            <p className="line-clamp-1 min-w-0 font-mono text-ink-faint">
                              (
                              {Object.entries(args)
                                .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
                                .join(", ")}
                              )
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {d.output && (
                  <div>
                    <Eyebrow className="mb-2">Specialist findings</Eyebrow>
                    <MarkdownBlock content={d.output} />
                  </div>
                )}
                {d.error && (
                  <div className="mt-2 flex items-center gap-2">
                    <AlertCircle size={14} color="#ef4444" />
                    <p className="text-xs text-bad">{d.error}</p>
                  </div>
                )}
                {d.status === "pending" && (
                  <p className="text-xs text-ink-muted">Waiting for previous specialist…</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>
    </motion.div>
  );
}

export interface MultiAgentRunnerProps {
  plan: AgentPlan | null;
  delegations: Delegation[];
  synthesis: string;
  running: boolean;
  done: boolean;
  meta: AgentMeta | null;
  error: string | null;
}

export default function MultiAgentRunner({
  plan,
  delegations,
  synthesis,
  running,
  done,
  meta,
  error,
}: MultiAgentRunnerProps) {
  if (!plan && !running && !delegations.length && !error) return null;

  const metaTyped = meta as { model?: string; subtasks?: number; total_ms?: number } | null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mt-5"
    >
      {/* Plan card */}
      {plan && (
        <GlassCard className="mb-4 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Network size={16} strokeWidth={2} color="#1F3FFE" />
            <Eyebrow>Orchestrator plan</Eyebrow>
            <Badge className="ml-auto rounded-md border border-border-subtle bg-chip px-2 text-[9px] text-ink-muted">
              {plan.subtasks.length} subtask{plan.subtasks.length === 1 ? "" : "s"}
            </Badge>
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
                    style={{
                      backgroundColor: m.color + "22",
                      color: m.color,
                      borderColor: m.color + "44",
                    }}
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

      {/* Per-specialist accordion */}
      {delegations.length > 0 && (
        <div className="mb-4">
          <Eyebrow className="mb-3">Specialists at work</Eyebrow>
          <div className="flex flex-col gap-3">
            {delegations.map((d) => (
              <DelegationCard key={d.idx} d={d} />
            ))}
          </div>
        </div>
      )}

      {/* Synthesis */}
      {(synthesis ||
        (running && delegations.every((d) => d.status === "done") && delegations.length > 0)) && (
        <GlassCard glow={done} className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-border-subtle bg-elevated px-5 py-3">
            <div className="flex items-center gap-2">
              <Sparkles size={14} strokeWidth={2} color="#1F3FFE" />
              <p className="text-xs font-bold text-ink">Synthesised Answer</p>
            </div>
            <div className="flex items-center gap-2">
              {metaTyped && (
                <>
                  <div className="rounded-md border border-border-brand bg-[var(--glow)] px-2 py-[3px] text-[9px] font-bold text-brand">
                    {metaTyped.model}
                  </div>
                  <div className="rounded-md border border-border-subtle bg-chip px-2 py-[3px] text-[9px] font-semibold text-ink-muted">
                    {metaTyped.subtasks} subtasks · {((metaTyped.total_ms ?? 0) / 1000).toFixed(1)}s
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="min-h-[100px] px-4 py-5 md:px-6">
            {error ? (
              <p role="alert" className="text-sm text-bad">
                {error}
              </p>
            ) : synthesis ? (
              <MarkdownBlock content={synthesis} />
            ) : (
              <div className="flex items-center gap-2">
                <Loader2 className="size-3 animate-spin" />
                <p className="text-xs text-ink-muted">Composing final answer…</p>
              </div>
            )}
          </div>
        </GlassCard>
      )}
    </motion.div>
  );
}
