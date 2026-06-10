import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { ChevronDown, ChevronUp, AlertCircle, Loader2 } from "lucide-react";
import { NyxAvatar } from "./nyxBranding";
import ModeChip from "./ModeChip";
import NyxStatusLine from "./NyxStatusLine";
import NyxMarkdown from "./NyxMarkdown";
import SqlResultBlock from "./SqlResultBlock";
import TraceStep from "@/shared/ui/TraceStep";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { AuditPanel } from "@/features/analyzer/AuditPanel";
import { FeedbackBar } from "@/features/analyzer/FeedbackBar";
import { buildCitationMarkdownComponents, CitationsList } from "@/features/analyzer/CitationFootnotes";
import type { AssistantTurnData, CitationChunk, Delegation } from "./useNyxConversation";

export interface AssistantTurnProps {
  turn: AssistantTurnData;
  onOpenCitation: (chunk: CitationChunk) => void;
}

// Per-status delegation badge styling (legacy colorScheme subtle variants:
// gray / cyan / green / red).
const DELEGATE_STYLE: Record<Delegation["status"], CSSProperties> = {
  pending: { backgroundColor: "rgba(148,163,184,0.16)", color: "#64748b" },
  running: { backgroundColor: "rgba(6,182,212,0.12)", color: "#06b6d4" },
  done: { backgroundColor: "rgba(16,185,129,0.12)", color: "#10b981" },
  error: { backgroundColor: "rgba(239,68,68,0.12)", color: "#ef4444" },
};

export default function AssistantTurn({ turn, onOpenCitation }: AssistantTurnProps) {
  const streaming = turn.status === "routing" || turn.status === "streaming";
  const [traceOpen, setTraceOpen] = useState(true);

  const components = useMemo(
    () => (turn.citations?.length ? buildCitationMarkdownComponents(turn.citations, onOpenCitation) : {}),
    [turn.citations, onOpenCitation],
  );

  const toolCallSteps = (turn.trace || []).filter((f) => f.type === "tool_call").length;

  return (
    <div className="mb-6 flex items-start justify-start gap-3">
      <NyxAvatar />
      <div className="min-w-0 flex-1 overflow-hidden rounded-xl rounded-bl-sm border border-border-subtle bg-surface shadow-sm">
        {/* header: model name + mode chip + timing */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle bg-chip px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-ink">Nyx</span>
            {turn.routedMode?.engine && <ModeChip readOnly engine={turn.routedMode.engine} />}
            {turn.routedMode?.overridden && (
              <Badge
                className="text-[9px]"
                style={{ backgroundColor: "rgba(124,58,237,0.12)", color: "#a78bfa" }}
              >
                forced
              </Badge>
            )}
          </div>
          {turn.meta && (
            <div className="flex min-w-0 items-center gap-2">
              {turn.meta.model && (
                <Badge
                  className="max-w-[140px] overflow-hidden rounded-md px-2 text-[9px] text-ellipsis whitespace-nowrap md:max-w-[220px]"
                  style={{ backgroundColor: "var(--glow)", color: "var(--cyan)" }}
                  title={turn.meta.model}
                >
                  {turn.meta.model}
                </Badge>
              )}
              {turn.meta.total_ms != null && (
                <Badge
                  variant="outline"
                  className="rounded-md border-border-subtle bg-surface px-2 text-[9px] text-ink-muted"
                >
                  {(turn.meta.total_ms / 1000).toFixed(1)}s
                </Badge>
              )}
            </div>
          )}
        </div>

        <div
          className="px-4 py-5 md:px-6"
          role="log"
          aria-live="polite"
          aria-atomic="false"
          aria-relevant="additions text"
          aria-busy={streaming}
        >
          {/* live status */}
          {streaming && !turn.markdown && (
            <div className="mb-3">
              <NyxStatusLine engine={turn.routedMode?.engine} routing={turn.status === "routing"} />
            </div>
          )}

          {/* reasoning trace (agent) */}
          {turn.trace?.length > 0 && (
            <div className="mb-3 overflow-hidden rounded-[10px] border border-border-subtle">
              <Button
                variant="ghost"
                size="xs"
                className="w-full justify-between rounded-none px-3 py-2"
                aria-expanded={traceOpen}
                aria-controls="nyx-trace"
                onClick={() => setTraceOpen((o) => !o)}
              >
                <span className="text-[11px] font-bold text-ink-muted">
                  Nyx's reasoning · {toolCallSteps} step(s)
                </span>
                {traceOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </Button>
              <Collapsible open={traceOpen}>
                <CollapsibleContent>
                  <div id="nyx-trace" className="border-t border-border-subtle px-3 py-2">
                    {turn.trace.map((f, i) => (
                      <TraceStep
                        key={i}
                        frame={f}
                        accent="cyan"
                        status={f.type === "tool_call" && streaming && i === turn.trace.length - 1 ? "running" : "done"}
                      />
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}

          {/* orchestrate plan + delegations */}
          {turn.plan && (
            <div className="mb-3 rounded-[10px] border border-border-subtle p-3">
              <p className="mb-1 text-[11px] font-bold tracking-[0.08em] text-ink-muted uppercase">Plan</p>
              {turn.plan.rationale && <p className="mb-2 text-xs text-ink-secondary">{turn.plan.rationale}</p>}
              {turn.delegations.map((d) => (
                <div key={d.idx} className="flex items-center gap-2 py-1">
                  <Badge className="text-[9px]" style={DELEGATE_STYLE[d.status] || DELEGATE_STYLE.pending}>
                    {d.specialist}
                  </Badge>
                  <span className="line-clamp-1 min-w-0 flex-1 text-[11px] text-ink-muted">{d.goal}</span>
                  {d.status === "running" && <Loader2 size={12} className="animate-spin text-cyan" />}
                  {d.steps ? <span className="text-[10px] text-ink-faint">{d.steps} steps</span> : null}
                </div>
              ))}
            </div>
          )}

          {/* answer */}
          {turn.markdown &&
            (turn.refusal ? (
              <div>
                <div className="mb-1.5 flex items-center gap-1.5 text-warn">
                  <AlertCircle size={13} />
                  <span className="text-[11px] font-bold tracking-[0.06em] uppercase">Engine declined</span>
                </div>
                <div className="text-ink-muted">
                  <NyxMarkdown content={turn.markdown} components={components} />
                </div>
              </div>
            ) : (
              <NyxMarkdown content={turn.markdown} components={components} />
            ))}

          {/* SQL result */}
          {turn.sql && <SqlResultBlock sql={turn.sql} />}

          {/* error */}
          {turn.error && (
            <div className="mt-2 flex items-center gap-2 text-bad">
              <AlertCircle size={15} />
              <span className="text-sm">{turn.error}</span>
            </div>
          )}

          {/* fact-check */}
          {!streaming && (turn.audit || turn.verification) && (
            <div className="mt-3">
              <AuditPanel audit={turn.audit} verification={turn.verification} />
            </div>
          )}

          {/* citations */}
          {!streaming && turn.citations?.length > 0 && (
            <div className="mt-3">
              <CitationsList chunks={turn.citations} onOpen={onOpenCitation} />
            </div>
          )}

          {/* feedback */}
          {!streaming && turn.auditId && (
            <div className="mt-2">
              <FeedbackBar auditId={turn.auditId} />
            </div>
          )}

          {/* stopped chip */}
          {!streaming && turn.status === "stopped" && (
            <Badge className="mt-2 rounded-md bg-chip px-2 text-[9px] text-ink-muted">Stopped</Badge>
          )}

          {/* empty terminal state */}
          {!streaming && !turn.markdown && !turn.sql && !turn.error && !turn.trace?.length && !turn.plan && (
            <p className="text-sm text-ink-muted">No response.</p>
          )}
        </div>
      </div>
    </div>
  );
}
