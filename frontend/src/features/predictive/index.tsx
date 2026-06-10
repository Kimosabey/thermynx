import { useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import { Activity, TrendingUp, CheckCircle2, ClipboardList, Loader2 } from "lucide-react";

import PageShell from "@/shared/ui/PageShell";
import PageHeader from "@/shared/ui/PageHeader";
import PageHeaderIcon from "@/shared/ui/PageHeaderIcon";
import GlassCard from "@/shared/ui/GlassCard";
import EmptyState from "@/shared/ui/EmptyState";
import ErrorAlert from "@/shared/ui/ErrorAlert";
import { SkeletonEquipCard } from "@/shared/ui/SkeletonCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import useApi from "@/shared/hooks/useApi";
import useAppToast from "@/shared/hooks/useAppToast";
import { useModelToast } from "@/shared/ai/useModels";
import { apiFetch } from "@/shared/api/client";

// ── Response shapes (derived from legacy field usage) ──────────────────────
type Severity = "critical" | "warning" | "watch" | "none";

interface Signal {
  metric: string;
  severity?: Severity;
  summary?: string;
  projected_days_to_threshold?: number | null;
  early_avg?: number | null;
  late_avg?: number | null;
  threshold?: number | null;
  samples?: number;
}

interface Asset {
  equipment_id: string | number;
  name: string;
  degrading?: boolean;
  narrative?: string;
  signals?: Signal[];
}

interface DegradationResponse {
  assets?: Asset[];
  degrading_count?: number;
  days?: number;
}

interface RunResponse {
  created_count: number;
}

const fmt = (v: number | null | undefined, d = 3): string =>
  v == null ? "—" : Number(v).toLocaleString(undefined, { maximumFractionDigits: d });

/**
 * Severity → tint. Mirrors the legacy Chakra `Badge colorScheme` + `variant="subtle"`
 * look, plus the `.400` text color used for the "days to poor line" caption.
 * Colors are intentionally literal (matches ZScorePill convention).
 */
const SEV: Record<Severity, { label: string; text: string; bg: string }> = {
  critical: { label: "Critical", text: "#FC8181", bg: "rgba(252,129,129,0.16)" }, // red
  warning: { label: "Warning", text: "#F6AD55", bg: "rgba(246,173,85,0.16)" }, // orange
  watch: { label: "Watch", text: "#F6E05E", bg: "rgba(246,224,94,0.16)" }, // yellow
  none: { label: "Stable", text: "#A0AEC0", bg: "rgba(160,174,192,0.16)" }, // gray
};

function SignalRow({ s }: { s: Signal }) {
  const sev = SEV[s.severity ?? "none"] ?? SEV.none;
  return (
    <div className="border-t border-border-subtle py-3">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={14} strokeWidth={2} />
          <p className="text-sm font-semibold">{s.metric}</p>
          <Badge
            variant="secondary"
            className="border-transparent text-[10px]"
            style={{ background: sev.bg, color: sev.text }}
          >
            {sev.label}
          </Badge>
        </div>
        {s.projected_days_to_threshold != null && (
          <p className="text-xs" style={{ color: sev.text }}>
            ~{fmt(s.projected_days_to_threshold, 0)} days to poor line
          </p>
        )}
      </div>
      <p className="text-sm text-ink-secondary">{s.summary}</p>
      {s.early_avg != null && s.late_avg != null && (
        <p className="mt-1 text-xs text-ink-muted">
          earlier {fmt(s.early_avg)} → now {fmt(s.late_avg)} (threshold {fmt(s.threshold)}) · {s.samples} samples
        </p>
      )}
    </div>
  );
}

export default function PredictivePage() {
  const toast = useAppToast();
  const notifyModel = useModelToast();
  const { data, isLoading, error, refetch } = useApi<DegradationResponse>(
    "/api/v1/predictive/degradation?days=14",
    {
      onSuccess: (d) => {
        if ((d?.assets || []).some((a) => a.narrative)) notifyModel("text", { prefix: "Predictive" });
      },
    },
  );
  const [running, setRunning] = useState(false);

  const assets = data?.assets || [];
  const degradingCount = data?.degrading_count || 0;

  async function proposeWorkOrders() {
    setRunning(true);
    try {
      const res = await apiFetch("/api/v1/predictive/run?days=14", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { detail?: string };
        throw new Error(body.detail || `HTTP ${res.status}`);
      }
      const out = (await res.json()) as RunResponse;
      const title = `${out.created_count} PM work order${out.created_count === 1 ? "" : "s"} proposed`;
      const description = out.created_count
        ? "Review them in Work Orders."
        : "Nothing new — existing PMs cover current trends.";
      if (out.created_count) toast.success(title, description);
      else toast.info(title, description);
    } catch (e) {
      toast.error("Propose failed", (e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Predictive Maintenance"
        subtitle="Trend-based degradation — proposes PM work orders before the metric crosses the poor line"
        icon={<PageHeaderIcon icon={<Activity size={20} strokeWidth={1.85} />} />}
        actions={
          <Button size="sm" onClick={proposeWorkOrders} disabled={running || !degradingCount}>
            {running ? <Loader2 className="animate-spin" /> : <ClipboardList size={15} />}
            {running ? "Proposing…" : "Propose PM work orders"}
          </Button>
        }
      />

      <ErrorAlert error={error} onRetry={refetch} />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <SkeletonEquipCard key={i} />
          ))}
        </div>
      ) : assets.length === 0 ? (
        <EmptyState
          icon={<Activity size={28} strokeWidth={1.6} />}
          title="No chiller data"
          description="Need a multi-day window of running telemetry to assess trends."
        />
      ) : (
        <>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
            <GlassCard>
              <div className="flex items-center gap-2">
                {degradingCount ? <TrendingUp size={16} /> : <CheckCircle2 size={16} />}
                <p className="text-sm">
                  {degradingCount
                    ? `${degradingCount} asset${degradingCount === 1 ? "" : "s"} showing a degrading trend over the last ${data?.days} days.`
                    : `No degrading trends in the last ${data?.days} days — all chillers stable.`}
                </p>
              </div>
            </GlassCard>
          </motion.div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {assets.map((a) => (
              <GlassCard key={a.equipment_id}>
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-bold">{a.name}</p>
                  <Badge
                    variant="secondary"
                    className="border-transparent"
                    style={
                      a.degrading
                        ? ({ background: "rgba(246,173,85,0.16)", color: "#F6AD55" } as CSSProperties)
                        : ({ background: "rgba(104,211,145,0.16)", color: "#68D391" } as CSSProperties)
                    }
                  >
                    {a.degrading ? "degrading" : "stable"}
                  </Badge>
                </div>
                {a.narrative && <p className="mb-2 text-sm text-ink-secondary">{a.narrative}</p>}
                {(a.signals || []).map((s) => (
                  <SignalRow key={s.metric} s={s} />
                ))}
              </GlassCard>
            ))}
          </div>
        </>
      )}
    </PageShell>
  );
}
