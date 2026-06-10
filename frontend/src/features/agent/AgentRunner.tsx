import { useRef, useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ClipboardList,
  CheckCheck,
  X,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import GlassCard from "@/shared/ui/GlassCard";
import Eyebrow from "@/shared/ui/Eyebrow";
import TraceStepDS from "@/shared/ui/TraceStep";
import TracingBeam from "@/shared/ui/TracingBeam";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import useAppToast from "@/shared/hooks/useAppToast";
import type { TraceFrame, AgentMeta, AgentAudit } from "./useAgentStream";

// ── Agent audit panel — parity with analyzer page ───────────────────────────
// The legacy AgentRunner wrapped the analyzer's <AuditPanel> (mapping the agent
// audit shape → analyzer shape with verification=null). The analyzer feature is
// ported separately, so we reproduce the audit-only rendering locally to keep
// the agent feature self-contained. Behavior matches AuditPanel({ audit,
// verification: null }) for the agent's audit frames.

interface AuditFlag {
  claim?: string;
  mention?: string;
  source?: string;
  chunk?: number | string;
  reason?: string;
}

interface UncitedChunk {
  source_id?: string;
  chunk_idx?: number | string;
  score?: number | string;
}

interface AuditShape {
  flag_count?: number;
  numeric_flags?: AuditFlag[];
  equipment_flags?: AuditFlag[];
  citation_flags?: AuditFlag[];
  uncited_chunks?: UncitedChunk[];
}

function FlagRow({
  icon: Icon,
  label,
  items,
}: {
  icon: typeof ShieldAlert;
  label: string;
  items?: AuditFlag[];
}) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <Icon size={11} color="#ef4444" />
        <p className="text-[10px] font-bold tracking-[0.08em] text-ink uppercase">
          {label} — {items.length}
        </p>
      </div>
      <div className="pl-4">
        {items.map((f, i) => (
          <p key={i} className="mb-0.5 text-[11px] leading-[1.55] text-ink-muted">
            <span className="font-semibold text-ink">
              {f.claim || f.mention || `${f.source} §${f.chunk}`}
            </span>
            {" — "}
            <span>{f.reason}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

function AgentAuditPanel({ audit }: { audit?: AgentAudit | null }) {
  const a = (audit ?? null) as AuditShape | null;
  const auditFlags = a?.flag_count || 0;
  const isDirty = auditFlags > 0;

  const [expanded, setExpanded] = useState(isDirty);

  if (!a) return null;

  const Icon = isDirty ? ShieldAlert : ShieldCheck;
  const iconColor = isDirty ? "#ef4444" : "#10b981";

  return (
    <GlassCard className="mt-3 overflow-hidden p-0">
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={cnFlex(
              "flex w-full items-center gap-2 px-4 py-3 transition-colors hover:bg-[rgba(31,63,254,0.04)]",
              expanded ? "border-b border-border-subtle" : "",
            )}
          >
            <Icon size={14} strokeWidth={2} color={iconColor} />
            <Eyebrow>{isDirty ? "Fact-check flagged" : "Fact-check clean"}</Eyebrow>

            {auditFlags > 0 && (
              <Badge className="ml-1 rounded-md border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.12)] px-2 text-[9px] text-[#ef4444]">
                {auditFlags} regex flag{auditFlags === 1 ? "" : "s"}
              </Badge>
            )}
            {!isDirty && (
              <Badge className="ml-1 rounded-md border border-[rgba(16,185,129,0.3)] bg-[rgba(16,185,129,0.10)] px-2 text-[9px] text-[#10b981]">
                all good
              </Badge>
            )}
            <span className="ml-auto text-ink-muted">
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </span>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 py-3">
            {/* Regex postcheck flags */}
            {a.flag_count != null && a.flag_count > 0 && (
              <div>
                <p className="mb-2 text-[10px] text-ink-muted">
                  Regex-based audit (no LLM) — values that don't appear in the source data.
                </p>
                <FlagRow icon={ShieldAlert} label="Numeric claims" items={a.numeric_flags} />
                {a.equipment_flags && a.equipment_flags.length > 0 && (
                  <div className="mt-3">
                    <FlagRow icon={ShieldAlert} label="Equipment names" items={a.equipment_flags} />
                  </div>
                )}
                {a.citation_flags && a.citation_flags.length > 0 && (
                  <div className="mt-3">
                    <FlagRow icon={ShieldAlert} label="Citations" items={a.citation_flags} />
                  </div>
                )}
              </div>
            )}

            {a.flag_count === 0 && (
              <p className="text-[11px] text-ink-muted">
                Regex audit found no orphan numbers, fabricated equipment names, or unmatched citations.
              </p>
            )}

            {/* Uncited chunks — informational, not a flag */}
            {a.uncited_chunks && a.uncited_chunks.length > 0 && (
              <div className="mt-3">
                <p className="mb-1 text-[10px] font-semibold tracking-[0.08em] text-ink-muted uppercase">
                  Uncited sources ({a.uncited_chunks.length})
                </p>
                <p className="mb-2 text-[10px] text-ink-muted">
                  These documents were retrieved but not referenced in the answer.
                </p>
                {a.uncited_chunks.slice(0, 4).map((c, i) => (
                  <p key={i} className="mb-0.5 text-[11px] text-ink-muted">
                    • {c.source_id} §{c.chunk_idx}
                    {c.score ? (
                      <span className="text-ink-muted"> (rel {parseFloat(String(c.score)).toFixed(2)})</span>
                    ) : null}
                  </p>
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </GlassCard>
  );
}

// Tiny local class joiner to avoid pulling cn into a leaf where only one call
// composes two strings.
function cnFlex(...parts: string[]): string {
  return parts.filter(Boolean).join(" ");
}

// Strip citation artefacts that qwen2.5 emits but shouldn't appear in the UI.
// Handles: <citation>…</citation>, [^N], 【N†source】, bare [N] refs at end of sentences.
function stripCitations(text: string): string {
  return text
    .replace(/<citation[^>]*>[\s\S]*?<\/citation>/gi, "") // <citation> XML tags
    .replace(/【\d+†[^】]*】/g, "") // 【1†source】 style
    .replace(/\[\^[\w\d]+\]/g, "") // [^1] footnote refs
    .replace(/\s*\[\d+(?:,\s*\d+)*\](?=\s|[.,;!?]|$)/g, "") // inline [1] [1,2,3]
    .replace(/\n{3,}/g, "\n\n") // collapse triple+ blank lines
    .trim();
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="h-1 w-1 rounded-full bg-brand"
          animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </div>
  );
}

// ── Work-order proposal card ─────────────────────────────────────────────────
// Rendered when a tool_result frame has result.status === "proposed".
// The agent called propose_work_order — now a human must Approve or Dismiss.
interface WorkOrderProposal {
  title: string;
  diagnosis?: string;
  equipment_id?: string;
  equipment_name?: string;
  priority?: string;
  recommended_actions?: string;
}

interface CreatedWorkOrder {
  id?: string;
  [key: string]: unknown;
}

type ProposalState = "pending" | "creating" | "created" | "dismissed" | "error";

function WorkOrderProposalCard({ proposal }: { proposal: WorkOrderProposal }) {
  const [state, setState] = useState<ProposalState>("pending");
  const [wo, setWo] = useState<CreatedWorkOrder | null>(null);
  const toast = useAppToast();

  const handleApprove = useCallback(async () => {
    setState("creating");
    try {
      const r = await fetch("/api/v1/work-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: proposal.title,
          description: proposal.diagnosis,
          equipment_id: proposal.equipment_id,
          priority: proposal.priority || "normal",
          source: "agent",
          diagnosis: proposal.diagnosis,
          recommended_actions: proposal.recommended_actions,
        }),
      });
      if (!r.ok)
        throw new Error(
          ((await r.json().catch(() => ({}))) as { detail?: string }).detail || `HTTP ${r.status}`,
        );
      const d: CreatedWorkOrder = await r.json();
      setWo(d);
      setState("created");
      toast.success(`Work order created (#${d.id?.slice(0, 8)})`);
    } catch (e) {
      setState("error");
      toast.error(`Failed: ${(e as Error).message}`);
    }
  }, [proposal, toast]);

  return (
    <GlassCard className="mt-3 rounded-lg border border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.04)] p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <ClipboardList size={14} strokeWidth={2} color="#f59e0b" />
        <Eyebrow style={{ color: "#f59e0b" }}>Work order proposal — human review required</Eyebrow>
        {state === "created" && (
          <Badge className="ml-auto rounded-md border border-[rgba(16,185,129,0.3)] bg-[rgba(16,185,129,0.15)] px-2 text-[9px] text-[#10b981]">
            Created
          </Badge>
        )}
        {state === "dismissed" && (
          <Badge className="ml-auto rounded-md border border-border-subtle bg-chip px-2 text-[9px] text-ink-muted">
            Dismissed
          </Badge>
        )}
      </div>

      <div className="mb-3">
        <p className="mb-1 text-sm font-bold text-ink">{proposal.title}</p>
        {proposal.equipment_name && (
          <Badge className="mr-2 rounded-md border border-border-subtle bg-chip px-2 text-[9px] text-ink-muted">
            {proposal.equipment_name}
          </Badge>
        )}
        <Badge
          className="rounded-md border border-border-subtle px-2 text-[9px]"
          style={{
            backgroundColor:
              proposal.priority === "critical" ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.12)",
            color: proposal.priority === "critical" ? "#ef4444" : "#f59e0b",
          }}
        >
          {proposal.priority || "normal"}
        </Badge>
      </div>

      {proposal.diagnosis && (
        <div className="mb-2">
          <p className="mb-1 text-[10px] font-semibold tracking-[0.08em] text-ink-muted uppercase">
            Diagnosis
          </p>
          <p className="text-xs text-ink">{proposal.diagnosis}</p>
        </div>
      )}
      {proposal.recommended_actions && (
        <div className="mb-3">
          <p className="mb-1 text-[10px] font-semibold tracking-[0.08em] text-ink-muted uppercase">
            Recommended actions
          </p>
          <p className="text-xs text-ink">{proposal.recommended_actions}</p>
        </div>
      )}

      {state === "created" && wo && (
        <p className="mt-2 text-[10px] text-good">
          Work order created successfully — view it on the Work Orders page.
        </p>
      )}
      {state === "error" && (
        <p className="mt-2 text-[10px] text-bad">
          Failed to create. Check the Work Orders page or try again.
        </p>
      )}

      {state === "pending" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            className="min-h-[40px] bg-[#f59e0b] text-white hover:bg-[#f59e0b]/90 md:min-h-0"
            onClick={handleApprove}
          >
            <CheckCheck size={11} />
            Approve &amp; Create
          </Button>
          <Button size="sm" variant="ghost" className="min-h-[40px] md:min-h-0" onClick={() => setState("dismissed")}>
            <X size={11} />
            Dismiss
          </Button>
        </div>
      )}
    </GlassCard>
  );
}

// Trace row — delegates to the shared design-system TraceStep, but intercepts
// `propose_work_order` results that came back `proposed` to render the
// Approve/Dismiss work-order card (the human-in-the-loop branch the legacy
// trace step handled). Everything else renders via TraceStepDS for parity.
function TraceRow({ frame }: { frame: TraceFrame }) {
  const result = frame.result as { status?: string; proposal?: WorkOrderProposal } | undefined;
  if (frame.type === "tool_result" && frame.tool === "propose_work_order" && result?.status === "proposed" && result.proposal) {
    return (
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
        className="mb-2"
      >
        <WorkOrderProposalCard proposal={result.proposal} />
      </motion.div>
    );
  }
  return <TraceStepDS frame={frame} status="done" />;
}

// MarkdownRenderer — legacy wrapped ReactMarkdown in a Box with sx for
// h2/h3/p/code/etc. Reproduced via [&_…]: arbitrary utilities on the wrapper.
function MarkdownOutput({ content }: { content: string }) {
  const cleaned = stripCitations(content);
  return (
    <div
      className={cnFlex(
        "max-w-full overflow-hidden",
        "[&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:border-b [&_h2]:border-border-subtle [&_h2]:pb-2 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-ink",
        "[&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:text-sm [&_h3]:font-bold [&_h3]:text-brand",
        "[&_p]:mb-3 [&_p]:text-sm [&_p]:leading-[1.8] [&_p]:break-words [&_p]:text-ink",
        "[&_ul]:mb-3 [&_ul]:pl-5 [&_ol]:mb-3 [&_ol]:pl-5",
        "[&_li]:mb-1 [&_li]:text-sm [&_li]:break-words [&_li]:text-ink",
        "[&_strong]:font-bold [&_strong]:text-ink",
        "[&_code]:rounded-[5px] [&_code]:bg-[rgba(31,63,254,0.06)] [&_code]:px-[5px] [&_code]:py-[2px] [&_code]:font-mono [&_code]:text-[0.82em] [&_code]:break-all [&_code]:text-brand",
        "[&_pre]:mb-3 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border-subtle [&_pre]:bg-elevated [&_pre]:p-4 [&_pre]:text-xs",
        "[&_table]:mb-3 [&_table]:block [&_table]:max-w-full [&_table]:w-full [&_table]:overflow-x-auto [&_table]:border-collapse [&_table]:text-sm",
        "[&_th]:border [&_th]:border-border-subtle [&_th]:bg-elevated [&_th]:px-3 [&_th]:py-[6px] [&_th]:text-xs [&_th]:font-semibold [&_th]:text-ink-muted",
        "[&_td]:border [&_td]:border-border-subtle [&_td]:px-3 [&_td]:py-[6px]",
        "[&_img]:h-auto [&_img]:max-w-full",
        "[&_a]:break-all [&_a]:text-brand",
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{cleaned}</ReactMarkdown>
    </div>
  );
}

export interface AgentRunnerProps {
  trace: TraceFrame[];
  output: string;
  running: boolean;
  done: boolean;
  meta: AgentMeta | null;
  error: string | null;
  agentAudit: AgentAudit | null;
}

export default function AgentRunner({
  trace,
  output,
  running,
  done,
  meta,
  error,
  agentAudit,
}: AgentRunnerProps) {
  // NOTE: the legacy timeline used @formkit/auto-animate for FLIP-style add/
  // remove transitions on the trace list. That dependency is not present in the
  // new app; each TraceStep already animates its own entrance (framer-motion),
  // so a plain ref preserves the same observable behavior without the dep.
  const timelineRef = useRef<HTMLDivElement>(null);
  const outputScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the output pane to the bottom as tokens stream in — scroll
  // ONLY this pane (direct scrollTop), never scrollIntoView, which bubbles to
  // the page's <main> scroll and jumps the whole page on every token.
  useEffect(() => {
    const el = outputScrollRef.current;
    if (!el) return;
    // Don't hijack manual scroll — only follow when near the bottom.
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [output, running]);

  if (!running && !output && !error) return null;

  const metaTyped = meta as
    | { model?: string; steps?: number; total_ms?: number }
    | null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mt-5"
    >
      <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)] items-stretch gap-4 lg:grid-cols-[minmax(300px,0.4fr)_minmax(0,1fr)] lg:gap-5 xl:grid-cols-[minmax(340px,0.38fr)_minmax(0,1fr)]">
        {/* ── Left: reasoning trace ── */}
        <div className="min-w-0">
          <Eyebrow className="mb-3">Reasoning Trace</Eyebrow>
          <GlassCard
            className="max-h-[40vh] overflow-hidden p-0 lg:max-h-[min(64vh,580px)]"
            role="log"
            aria-live="polite"
            aria-atomic="false"
            aria-relevant="additions"
            aria-label="Agent reasoning steps"
          >
            <TracingBeam>
              <div className="relative" ref={timelineRef}>
                {trace.map((f, i) => (
                  <TraceRow key={i} frame={f} />
                ))}
                {running && (
                  <TraceStepDS
                    frame={{
                      type: "tool_call",
                      tool: "__thinking__",
                      runningLabel: "Thinking…",
                      step: trace.length + 1,
                    }}
                    status="running"
                  />
                )}
                {!running && trace.length === 0 && (
                  <div className="flex items-center gap-2 px-3 py-2">
                    <Loader2 className="size-3 animate-spin text-brand" />
                    <p className="text-xs text-ink-muted">starting…</p>
                  </div>
                )}
              </div>
            </TracingBeam>
          </GlassCard>
        </div>

        {/* ── Right: streaming output ── */}
        <div className="flex min-w-0 flex-col">
          <Eyebrow className="mb-3 opacity-0">Output</Eyebrow>
          {/* spacer to align with left Eyebrow */}
          <GlassCard
            glow={done}
            className="flex min-h-[320px] min-w-0 flex-1 flex-col overflow-hidden p-0 h-[40vh] lg:h-[min(64vh,580px)] lg:min-h-[unset]"
          >
            {/* Header bar */}
            <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border-subtle bg-elevated px-5 py-3">
              <div className="flex items-center gap-2">
                {running ? (
                  <ThinkingDots />
                ) : (
                  <div className="h-2 w-2 rounded-full bg-good shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
                )}
                <p className="text-xs font-semibold text-ink-muted">
                  {running ? "Agent is working…" : done ? "Complete" : "Output"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {metaTyped && (
                  <>
                    <div className="rounded-md border border-[rgba(31,63,254,0.2)] bg-[rgba(31,63,254,0.1)] px-2 py-[3px] text-[9px] font-bold text-brand">
                      {metaTyped.model}
                    </div>
                    <div className="rounded-md border border-border-subtle bg-surface px-2 py-[3px] text-[9px] font-semibold text-ink-muted">
                      {metaTyped.steps} steps · {((metaTyped.total_ms ?? 0) / 1000).toFixed(1)}s
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Scrollable content */}
            <div
              ref={outputScrollRef}
              className="flex-1 overflow-y-auto px-4 py-5 md:px-6 [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[rgba(31,63,254,0.25)]"
              role="log"
              aria-live="polite"
              aria-atomic="false"
              aria-relevant="additions text"
              aria-busy={running}
              aria-label="Agent final answer"
            >
              {error ? (
                <p role="alert" className="text-sm text-bad">
                  {error}
                </p>
              ) : output ? (
                <MarkdownOutput content={output} />
              ) : running ? (
                <div className="flex items-center gap-3 pt-2">
                  <ThinkingDots />
                  <p className="text-xs text-ink-muted">Waiting for first token…</p>
                </div>
              ) : null}
            </div>
            {/* Agent audit panel — parity with analyzer page */}
            {!running && agentAudit && (
              <div className="px-3 pt-2 pb-3 md:px-4">
                <AgentAuditPanel audit={agentAudit} />
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </motion.div>
  );
}
