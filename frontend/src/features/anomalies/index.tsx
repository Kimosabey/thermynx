import { useEffect, useState, type CSSProperties } from "react";
import {
  TriangleAlert,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, type Variants } from "framer-motion";

import PageShell from "@/shared/ui/PageShell";
import PageHeader from "@/shared/ui/PageHeader";
import PageHeaderIcon from "@/shared/ui/PageHeaderIcon";
import Eyebrow from "@/shared/ui/Eyebrow";
import ZScorePill from "@/shared/ui/ZScorePill";
import PeriodSelect, { HOURS_OPTIONS_ANOMALY } from "@/shared/ui/PeriodSelect";
import GlassCard from "@/shared/ui/GlassCard";
import { SkeletonEquipCard } from "@/shared/ui/SkeletonCard";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";

import { apiFetch } from "@/shared/api/client";
import useAppToast from "@/shared/hooks/useAppToast";
import { useModelToast } from "@/shared/ai/useModels";

// ─────────────────────────────────────────────────────────────────────────────
// Motion (verbatim from legacy)
// ─────────────────────────────────────────────────────────────────────────────
const stagger: Variants = { animate: { transition: { staggerChildren: 0.05 } } };
const fadeUp: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

// ─────────────────────────────────────────────────────────────────────────────
// Severity / confidence palettes (literal hex — intentionally not theme tokens)
// ─────────────────────────────────────────────────────────────────────────────
interface SeverityMeta {
  color: string;
  bg: string;
  border: string;
  label: string;
}

const SEVERITY_META: Record<string, SeverityMeta> = {
  critical: { color: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.25)", label: "CRITICAL" },
  warning: { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.25)", label: "WARNING" },
};

const CONF_COLOR: Record<string, string> = { high: "#10b981", medium: "#f59e0b", low: "#64748b" };

// ─────────────────────────────────────────────────────────────────────────────
// Domain types (derived from legacy field usage)
// ─────────────────────────────────────────────────────────────────────────────
interface Anomaly {
  id?: string | number | null;
  equipment_id: string;
  equipment_name?: string;
  metric: string;
  value?: number;
  z_score?: number;
  baseline_mean?: number;
  baseline_std?: number;
  severity?: string;
  confidence?: number | null;
  timestamp?: string | null;
  description?: string;
}

interface LikelyCause {
  cause: string;
  confidence: string;
  evidence?: string;
}

interface CausalExplanation {
  summary?: string;
  likely_causes?: LikelyCause[];
  recommended_checks?: string[];
  status?: string;
  reason?: string;
}

interface WorkOrderResponse {
  title: string;
}

interface AnomaliesResponse {
  anomalies?: Anomaly[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Anomaly card
// ─────────────────────────────────────────────────────────────────────────────
function AnomalyCard({ anomaly }: { anomaly: Anomaly }) {
  const meta = SEVERITY_META[anomaly.severity ?? ""] ?? SEVERITY_META.warning;
  const time = anomaly.timestamp
    ? new Date(anomaly.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })
    : "—";

  const [open, setOpen] = useState(false);
  const [explain, setExplain] = useState<CausalExplanation | null>(null);
  const [exLoad, setExLoad] = useState(false);
  const [exErr, setExErr] = useState<string | null>(null);
  const [woLoading, setWoLoading] = useState(false);

  const toast = useAppToast();
  const notifyModel = useModelToast();
  // Parity with legacy: navigate hook retained (referenced to satisfy noUnusedLocals).
  const navigate = useNavigate();
  void navigate;

  async function createWorkOrder() {
    setWoLoading(true);
    const title = `Investigate ${anomaly.equipment_name || anomaly.equipment_id} ${anomaly.metric}`;
    const lines = [
      `Anomaly detected on ${anomaly.equipment_name || anomaly.equipment_id}.`,
      `Metric: ${anomaly.metric} = ${anomaly.value} (z-score ${anomaly.z_score?.toFixed(2)}).`,
      anomaly.timestamp ? `Observed at ${anomaly.timestamp}.` : null,
      anomaly.description || null,
    ].filter(Boolean) as string[];
    const diagnosis = explain?.summary
      ? explain.summary +
        (explain.likely_causes?.length
          ? "\n\nLikely causes:\n" +
            explain.likely_causes.map((c) => `• [${c.confidence}] ${c.cause}`).join("\n")
          : "")
      : null;
    const actions = explain?.recommended_checks?.length
      ? explain.recommended_checks.map((s) => `• ${s}`).join("\n")
      : null;
    try {
      const r = await apiFetch("/api/v1/work-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          equipment_id: anomaly.equipment_id,
          priority: anomaly.severity === "critical" ? "high" : "normal",
          description: lines.join("\n"),
          source: "anomaly",
          source_ref: anomaly.id || null,
          diagnosis,
          recommended_actions: actions,
          created_by: "operator",
        }),
      });
      if (!r.ok) {
        const data = (await r.json().catch(() => ({}))) as { detail?: string };
        throw new Error(data.detail || `HTTP ${r.status}`);
      }
      const wo = (await r.json()) as WorkOrderResponse;
      toast.success("Work order created", wo.title);
    } catch (e) {
      toast.error("Create failed", (e as Error).message);
    } finally {
      setWoLoading(false);
    }
  }

  async function loadExplanation() {
    setOpen(true);
    if (explain || exLoad) return;
    notifyModel("text", { prefix: "Explain" });
    setExLoad(true);
    setExErr(null);
    try {
      const r = await apiFetch("/api/v1/causal/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          equipment_id: anomaly.equipment_id,
          metric: anomaly.metric,
          value: anomaly.value,
          z_score: anomaly.z_score,
          timestamp: anomaly.timestamp,
          hours_context: 6,
        }),
      });
      if (!r.ok) {
        const data = (await r.json().catch(() => ({}))) as { detail?: string };
        throw new Error(data?.detail || `HTTP ${r.status}`);
      }
      setExplain((await r.json()) as CausalExplanation);
    } catch (e) {
      setExErr((e as Error).message);
    } finally {
      setExLoad(false);
    }
  }

  return (
    <motion.div variants={fadeUp}>
      <GlassCard className="p-4">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <p className="text-sm font-bold text-ink">
              {(anomaly.equipment_name || anomaly.equipment_id).replace(/_/g, " ")}
            </p>
            <p className="mt-0.5 text-xs text-ink-muted">
              {anomaly.metric.replace(/_/g, " ")} · {time}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ZScorePill value={anomaly.z_score ?? 0} />
            {anomaly.confidence != null && (
              <Badge
                title="Detection confidence"
                className="h-auto rounded-full border border-border-subtle bg-chip px-2 py-[2px] text-[9px] font-bold text-ink-muted"
              >
                {Math.round(anomaly.confidence * 100)}% conf
              </Badge>
            )}
            <Badge
              className="h-auto rounded-full border px-2 py-[2px] text-[9px] font-bold"
              style={{ background: meta.bg, color: meta.color, borderColor: meta.border }}
            >
              {meta.label}
            </Badge>
          </div>
        </div>

        <div className="mb-3 flex gap-3 sm:gap-4 md:gap-6">
          <div>
            <Eyebrow className="mb-1">Value</Eyebrow>
            <p className="text-lg font-bold tabular-nums" style={{ color: meta.color }}>
              {anomaly.value?.toFixed(3) ?? "—"}
            </p>
          </div>
          <div>
            <Eyebrow className="mb-1">Baseline</Eyebrow>
            <p className="text-lg font-bold text-ink tabular-nums">
              {anomaly.baseline_mean?.toFixed(3) ?? "—"}
            </p>
          </div>
          <div>
            <Eyebrow className="mb-1">Std Dev</Eyebrow>
            <p className="text-lg font-bold text-ink-muted tabular-nums">
              ±{anomaly.baseline_std?.toFixed(3) ?? "—"}
            </p>
          </div>
        </div>

        {anomaly.description && (
          <div className="mb-3 rounded-md border border-border-subtle bg-chip px-3 py-2">
            <p className="text-xs leading-[1.6] text-ink-muted">{anomaly.description}</p>
          </div>
        )}

        {/* Causal explanation + Create WO actions */}
        <div className="flex justify-end gap-2">
          <Button
            size="xs"
            variant="ghost"
            onClick={createWorkOrder}
            disabled={woLoading}
            className="text-brand"
          >
            {woLoading ? (
              <Loader2 className="animate-spin" />
            ) : (
              <ClipboardList size={12} strokeWidth={2.2} />
            )}
            Create WO
          </Button>
          <Button
            size="xs"
            variant="ghost"
            onClick={() => (open ? setOpen(false) : loadExplanation())}
            className="text-brand"
          >
            <Sparkles size={12} strokeWidth={2.2} />
            {open ? "Hide why" : "Explain why"}
            {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </Button>
        </div>

        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleContent>
            <div className="mt-3 border-t border-border-subtle pt-3">
              {exLoad && (
                <div className="flex items-center gap-2">
                  <Loader2 className="size-3 animate-spin text-ink-muted" />
                  <p className="text-xs text-ink-muted">Asking model for likely causes…</p>
                </div>
              )}
              {exErr && <p className="text-xs text-bad">{exErr}</p>}
              {explain && (
                <div>
                  {explain.summary && <p className="mb-3 text-xs text-ink">{explain.summary}</p>}
                  {(explain.likely_causes || []).length > 0 && (
                    <div className="mb-3">
                      <Eyebrow className="mb-2">Likely causes</Eyebrow>
                      {explain.likely_causes!.map((c, i) => (
                        <div key={i} className="flex items-start gap-2 py-1">
                          <Badge
                            className="h-auto rounded-[6px] border border-border-subtle bg-chip px-2 text-[9px]"
                            style={{ color: CONF_COLOR[c.confidence] || CONF_COLOR.low }}
                          >
                            {c.confidence}
                          </Badge>
                          <div className="flex-1">
                            <p className="text-xs font-semibold text-ink">{c.cause}</p>
                            {c.evidence && (
                              <p className="mt-[2px] text-[11px] text-ink-muted">{c.evidence}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {(explain.recommended_checks || []).length > 0 && (
                    <div>
                      <Eyebrow className="mb-2">Recommended checks</Eyebrow>
                      {explain.recommended_checks!.map((s, i) => (
                        <div key={i} className="flex items-start gap-2 py-[2px]">
                          <div className="mt-[7px] size-[4px] shrink-0 rounded-full bg-brand" />
                          <p className="text-xs text-ink">{s}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {explain.status === "skipped" && (
                    <p className="text-xs text-warn">⚠ Skipped: {explain.reason}</p>
                  )}
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </GlassCard>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <GlassCard className="flex flex-col items-center justify-center gap-3 p-12">
      <CheckCircle2 className="size-10 text-good" strokeWidth={1.85} />
      <p className="text-sm font-semibold text-good">No anomalies detected</p>
      <p className="max-w-[320px] text-center text-xs text-ink-muted">
        All equipment is operating within normal statistical range
      </p>
    </GlassCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default function AnomaliesPage() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [hours, setHours] = useState(6);
  const [loading, setLoading] = useState(true);
  const [lastScan, setLastScan] = useState<Date | null>(null);

  function load() {
    setLoading(true);
    apiFetch(`/api/v1/anomalies/live?hours=${hours}`)
      .then((r) => r.json() as Promise<AnomaliesResponse>)
      .then((d) => {
        setAnomalies(d.anomalies ?? []);
        setLastScan(new Date());
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hours]);

  const critical = anomalies.filter((a) => a.severity === "critical");
  const warning = anomalies.filter((a) => a.severity === "warning");

  const summaryChips = [
    { label: "Critical", count: critical.length, color: "#ef4444", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.2)" },
    { label: "Warning", count: warning.length, color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.2)" },
    { label: "Total", count: anomalies.length, color: "#64748b", bg: "rgba(100,116,139,0.08)", border: "rgba(100,116,139,0.15)" },
  ];

  return (
    <PageShell>
      <PageHeader
        title="Anomaly Detector"
        icon={<PageHeaderIcon icon={<TriangleAlert size={20} strokeWidth={1.85} />} />}
        subtitle={
          <>
            Statistical z-score detection · auto-scan every 5 min
            {lastScan &&
              ` · last scanned ${lastScan.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`}
          </>
        }
        actions={
          <>
            <PeriodSelect value={hours} onChange={setHours} options={HOURS_OPTIONS_ANOMALY} width="130px" />
            <motion.div whileTap={{ scale: 0.95 }}>
              <Button
                size="sm"
                variant="secondary"
                onClick={load}
                className="rounded-[10px] border border-border-subtle bg-glass text-xs backdrop-blur-md hover:border-border-strong"
              >
                Scan now
              </Button>
            </motion.div>
          </>
        }
      />

      {/* Summary chips */}
      <div className="mb-6 flex flex-wrap gap-3">
        {summaryChips.map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-2 rounded-[10px] border px-3 py-2"
            style={{ background: s.bg, borderColor: s.border } as CSSProperties}
          >
            <p className="text-xs font-bold tabular-nums" style={{ color: s.color }}>
              {s.count}
            </p>
            <p className="text-xs text-ink-muted">{s.label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <motion.div key={i} variants={fadeUp} initial="initial" animate="animate">
              <SkeletonEquipCard />
            </motion.div>
          ))}
        </div>
      ) : anomalies.length === 0 ? (
        <EmptyState />
      ) : (
        <motion.div
          variants={stagger}
          initial="initial"
          animate="animate"
          className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-2"
        >
          {anomalies.map((a, i) => (
            <AnomalyCard key={`${a.equipment_id}-${a.metric}-${a.timestamp}-${i}`} anomaly={a} />
          ))}
        </motion.div>
      )}
    </PageShell>
  );
}
