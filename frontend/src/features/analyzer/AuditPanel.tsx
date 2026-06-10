/**
 * AuditPanel — renders the two post-generation checks under the answer:
 *
 *   1. `audit`        — regex-based postcheck (numeric / equipment / citation flags)
 *                       emitted as SSE `audit` frame by services/postcheck.py
 *   2. `verification` — LLM self-critique pass (services/critique.py) emitted
 *                       as SSE `verification` frame
 *
 * Both are collapsible. Default: closed when clean, open when flags present.
 */
import { useState, type ComponentType } from "react";
import { ShieldCheck, ShieldAlert, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import GlassCard from "@/shared/ui/GlassCard";
import Eyebrow from "@/shared/ui/Eyebrow";

// ── API shapes ──────────────────────────────────────────────────────────────

/** One regex-postcheck flag (numeric / equipment / citation). */
export interface AuditFlag {
  claim?: string;
  mention?: string;
  source?: string;
  chunk?: number | string;
  reason?: string;
}

/** One retrieved-but-unreferenced chunk. */
export interface UncitedChunk {
  source_id: string;
  chunk_idx: number | string;
  score?: number | string | null;
}

/** Regex-based postcheck result (SSE `audit` frame). */
export interface AuditResult {
  flag_count?: number;
  numeric_flags?: AuditFlag[];
  equipment_flags?: AuditFlag[];
  citation_flags?: AuditFlag[];
  uncited_chunks?: UncitedChunk[];
}

/** One LLM-critique claim entry. */
export interface VerificationClaim {
  claim: string;
  expected?: string | number | null;
}

/** LLM self-critique result (SSE `verification` frame). */
export interface VerificationResult {
  overall?: string;
  status?: "ok" | "skipped" | string;
  model?: string;
  summary?: string;
  reason?: string;
  suspicious?: VerificationClaim[];
  unverified?: VerificationClaim[];
  verified?: VerificationClaim[];
}

type IconType = ComponentType<{ size?: number | string; strokeWidth?: number; color?: string }>;

function FlagRow({ icon: Icon, label, items }: { icon: IconType; label: string; items?: AuditFlag[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <div className="mb-[6px] flex items-center gap-2">
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

export function AuditPanel({
  audit,
  verification,
}: {
  audit?: AuditResult | null;
  verification?: VerificationResult | null;
}) {
  // Default open if either has flags
  const auditFlags = audit?.flag_count || 0;
  const verdictOverall = verification?.overall;
  const verdictDirty = !!verdictOverall && verdictOverall !== "ok";
  const isDirty = auditFlags > 0 || verdictDirty;

  const [expanded, setExpanded] = useState(isDirty);

  if (!audit && !verification) return null;
  // Skip "skipped" verifications with nothing else to show
  if (!audit && verification?.status === "skipped") return null;

  const Icon = isDirty ? ShieldAlert : ShieldCheck;
  const iconColor = isDirty ? "#ef4444" : "#10b981";

  return (
    <GlassCard hover={false} className="mt-3 overflow-hidden p-0">
      <button
        type="button"
        onClick={() => setExpanded((x) => !x)}
        className={`flex w-full items-center gap-2 px-4 py-3 text-left transition-[background] duration-150 hover:bg-[rgba(31,63,254,0.04)] ${
          expanded ? "border-b border-border-subtle" : ""
        }`}
      >
        <Icon size={14} strokeWidth={2} color={iconColor} />
        <Eyebrow>{isDirty ? "Fact-check flagged" : "Fact-check clean"}</Eyebrow>

        {auditFlags > 0 && (
          <span
            className="ml-1 inline-flex items-center rounded-[6px] border px-2 py-0.5 text-[9px] font-medium"
            style={{
              background: "rgba(239,68,68,0.12)",
              color: "#ef4444",
              borderColor: "rgba(239,68,68,0.3)",
            }}
          >
            {auditFlags} regex flag{auditFlags === 1 ? "" : "s"}
          </span>
        )}
        {verdictOverall && verdictOverall !== "ok" && (
          <span
            className="ml-1 inline-flex items-center rounded-[6px] border px-2 py-0.5 text-[9px] font-medium"
            style={{
              background: verdictOverall === "fail" ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.12)",
              color: verdictOverall === "fail" ? "#ef4444" : "#f59e0b",
              borderColor: verdictOverall === "fail" ? "rgba(239,68,68,0.3)" : "rgba(245,158,11,0.3)",
            }}
          >
            critique: {verdictOverall}
          </span>
        )}
        {!isDirty && (
          <span
            className="ml-1 inline-flex items-center rounded-[6px] border px-2 py-0.5 text-[9px] font-medium"
            style={{
              background: "rgba(16,185,129,0.10)",
              color: "#10b981",
              borderColor: "rgba(16,185,129,0.3)",
            }}
          >
            all good
          </span>
        )}
        <span className="ml-auto text-ink-muted">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-3">
              {/* Regex postcheck flags */}
              {audit && (audit.flag_count ?? 0) > 0 && (
                <div className={verification ? "mb-4" : ""}>
                  <p className="mb-2 text-[10px] text-ink-muted">
                    Regex-based audit (no LLM) — values that don&apos;t appear in the source data.
                  </p>
                  <FlagRow icon={ShieldAlert} label="Numeric claims" items={audit.numeric_flags} />
                  {(audit.equipment_flags?.length ?? 0) > 0 && (
                    <div className="mt-3">
                      <FlagRow icon={ShieldAlert} label="Equipment names" items={audit.equipment_flags} />
                    </div>
                  )}
                  {(audit.citation_flags?.length ?? 0) > 0 && (
                    <div className="mt-3">
                      <FlagRow icon={ShieldAlert} label="Citations" items={audit.citation_flags} />
                    </div>
                  )}
                </div>
              )}

              {audit && audit.flag_count === 0 && (
                <p className="text-[11px] text-ink-muted">
                  Regex audit found no orphan numbers, fabricated equipment names, or unmatched citations.
                </p>
              )}

              {/* Uncited chunks — informational, not a flag */}
              {(audit?.uncited_chunks?.length ?? 0) > 0 && (
                <div className="mt-3">
                  <p className="mb-1 text-[10px] font-semibold tracking-[0.08em] text-ink-muted uppercase">
                    Uncited sources ({audit?.uncited_chunks?.length})
                  </p>
                  <p className="mb-2 text-[10px] text-ink-muted">
                    These documents were retrieved but not referenced in the answer.
                  </p>
                  {audit?.uncited_chunks?.slice(0, 4).map((c, i) => (
                    <p key={i} className="mb-[2px] text-[11px] text-ink-muted">
                      • {c.source_id} §{c.chunk_idx}
                      {c.score ? (
                        <span className="text-ink-muted"> (rel {parseFloat(String(c.score)).toFixed(2)})</span>
                      ) : null}
                    </p>
                  ))}
                </div>
              )}

              {/* LLM critique */}
              {verification && verification.status === "ok" && (
                <div className={(audit?.flag_count ?? 0) > 0 ? "mt-4" : ""}>
                  <p className="mb-2 text-[10px] text-ink-muted">
                    LLM critique pass{verification.model ? ` (${verification.model})` : ""} — semantic claim-vs-data check.
                  </p>
                  {verification.summary && (
                    <p className="mb-2 text-[11px] italic text-ink">&quot;{verification.summary}&quot;</p>
                  )}
                  {(verification.suspicious?.length ?? 0) > 0 && (
                    <div className="mb-2">
                      <p className="mb-1 text-[10px] font-bold text-[#ef4444]">
                        SUSPICIOUS ({verification.suspicious?.length})
                      </p>
                      {verification.suspicious?.slice(0, 5).map((s, i) => (
                        <p key={i} className="mb-0.5 pl-2 text-[11px] text-ink-muted">
                          • {s.claim} {s.expected ? `(expected ${s.expected})` : ""}
                        </p>
                      ))}
                    </div>
                  )}
                  {(verification.unverified?.length ?? 0) > 0 && (
                    <div className="mb-2">
                      <p className="mb-1 text-[10px] font-bold text-[#f59e0b]">
                        UNVERIFIED ({verification.unverified?.length})
                      </p>
                      {verification.unverified?.slice(0, 5).map((u, i) => (
                        <p key={i} className="mb-0.5 pl-2 text-[11px] text-ink-muted">
                          • {u.claim}
                        </p>
                      ))}
                    </div>
                  )}
                  {(verification.verified?.length ?? 0) > 0 &&
                    verification.suspicious?.length === 0 && (
                      <p className="text-[11px] text-[#10b981]">
                        ✓ {verification.verified?.length} claim
                        {verification.verified?.length === 1 ? "" : "s"} verified against source data
                      </p>
                    )}
                </div>
              )}

              {verification &&
                verification.status === "skipped" &&
                (audit?.flag_count ?? 0) > 0 && (
                  <p className="mt-3 text-[10px] italic text-ink-muted">
                    LLM critique skipped: {verification.reason || "auditor unavailable"}
                  </p>
                )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}
