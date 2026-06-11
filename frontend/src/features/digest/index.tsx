import { useState } from "react";
import { motion } from "framer-motion";
import { Sun, RefreshCw, TriangleAlert, Zap, IndianRupee, Lightbulb, Loader2 } from "lucide-react";
import PageShell from "@/shared/ui/PageShell";
import PageHeader from "@/shared/ui/PageHeader";
import PageHeaderIcon from "@/shared/ui/PageHeaderIcon";
import Eyebrow from "@/shared/ui/Eyebrow";
import GlassCard from "@/shared/ui/GlassCard";
import KpiCard from "@/shared/ui/KpiCard";
import EmptyState from "@/shared/ui/EmptyState";
import ErrorAlert from "@/shared/ui/ErrorAlert";
import { SkeletonKpiCard, SkeletonListCard } from "@/shared/ui/SkeletonCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import useApi from "@/shared/hooks/useApi";
import { apiFetch } from "@/shared/api/client";
import { useModelToast } from "@/shared/ai/useModels";

interface Digest {
  id: number | string;
  created_at?: string | null;
  hours?: number | null;
  status?: string | null;
  headline?: string | null;
  total_kwh?: number | null;
  total_cost_inr?: number | null;
  anomaly_count?: number | null;
  critical_count?: number | null;
  worst_equipment?: string | null;
  worst_kw_per_tr?: number | null;
  recommendation?: string | null;
}

interface DigestLatestResponse {
  digest?: Digest | null;
}

interface DigestHistoryResponse {
  digests?: Digest[];
}

const fmtNum = (v: number | string | null | undefined, digits = 2): string =>
  v == null ? "—" : Number(v).toLocaleString(undefined, { maximumFractionDigits: digits });

const fmtWhen = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return String(iso).slice(0, 19);
  }
};

const titleCase = (s: string | null | undefined): string =>
  (s || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default function DigestPage() {
  const { data, isLoading, error, refetch } = useApi<DigestLatestResponse>("/api/v1/digest/latest");
  const { data: hist, refetch: refetchHist } = useApi<DigestHistoryResponse>("/api/v1/digest?limit=14");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const notifyModel = useModelToast();

  const digest = data?.digest || null;
  const history = (hist?.digests || []).filter((d) => d.id !== digest?.id);

  async function generateNow() {
    notifyModel("text", { prefix: "Digest" });
    setGenerating(true);
    setGenError(null);
    try {
      const res = await apiFetch("/api/v1/digest/run?hours=24", { method: "POST" });
      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try {
          detail = ((await res.json()) as { detail?: string }).detail || detail;
        } catch {
          /* ignore */
        }
        throw new Error(detail);
      }
      await Promise.all([refetch(), refetchHist()]);
    } catch (e) {
      setGenError((e as Error).message || "Failed to generate digest");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Morning Digest"
        subtitle="Auto-generated daily plant-health summary · refreshed each morning (06:00 UTC)"
        icon={<PageHeaderIcon icon={<Sun size={20} strokeWidth={1.85} />} />}
        actions={
          <Button size="sm" onClick={generateNow} disabled={generating}>
            {generating ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw size={15} strokeWidth={2} />
            )}
            {generating ? "Generating…" : "Generate now"}
          </Button>
        }
      />

      <ErrorAlert error={genError} onDismiss={() => setGenError(null)} />
      {!digest && <ErrorAlert error={error} onRetry={refetch} />}

      {isLoading && !digest ? (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonKpiCard key={i} />
            ))}
          </div>
          <SkeletonListCard rows={4} />
        </>
      ) : !digest ? (
        <EmptyState
          icon={<Sun size={28} strokeWidth={1.6} />}
          title="No digest yet"
          description="The morning digest runs daily at 06:00 UTC. Generate one now to preview it."
          action={{ label: generating ? "Generating…" : "Generate now", onClick: generateNow }}
        />
      ) : (
        <>
          {/* Headline card */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <GlassCard>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <Eyebrow>
                  {fmtWhen(digest.created_at)} · last {digest.hours}h
                </Eyebrow>
                {digest.status === "degraded" && (
                  <Badge className="h-auto rounded-4xl border border-warn/30 bg-warn/10 px-2 py-0.5 text-[10px] font-medium text-warn">
                    narrative fallback (LLM offline)
                  </Badge>
                )}
              </div>
              <p className="mt-2 text-xl font-bold leading-[1.4] text-ink">{digest.headline}</p>
            </GlassCard>
          </motion.div>

          {/* KPI grid */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Plant energy"
              value={digest.total_kwh}
              unit="kWh"
              decimals={0}
              accent="accent.cyan"
              icon={<Zap size={16} strokeWidth={1.85} />}
            />
            <KpiCard
              label="Plant cost (₹)"
              value={digest.total_cost_inr}
              decimals={0}
              accent="status.good"
              icon={<IndianRupee size={16} strokeWidth={1.85} />}
            />
            <KpiCard
              label="Anomalies"
              value={digest.anomaly_count}
              decimals={0}
              accent={(digest.critical_count ?? 0) > 0 ? "status.bad" : "text.primary"}
              helpText={`${digest.critical_count} critical`}
              icon={<TriangleAlert size={16} strokeWidth={1.85} />}
            />
            <KpiCard
              label="Least-efficient chiller"
              value={digest.worst_equipment ? titleCase(digest.worst_equipment) : "—"}
              accent="accent.primary"
              helpText={digest.worst_kw_per_tr == null ? undefined : `${fmtNum(digest.worst_kw_per_tr, 3)} kW/TR`}
            />
          </div>

          {/* Recommendation */}
          {digest.recommendation && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
              <GlassCard>
                <div className="mb-2 flex items-center gap-2">
                  <Lightbulb size={16} strokeWidth={2} />
                  <Eyebrow className="mb-0">Recommended action</Eyebrow>
                </div>
                <p className="text-base text-ink">{digest.recommendation}</p>
              </GlassCard>
            </motion.div>
          )}

          {/* History */}
          {history.length > 0 && (
            <GlassCard hover={false} className="overflow-hidden p-0">
              <div className="border-b border-border-subtle px-5 py-4">
                <p className="text-sm font-bold text-ink">Earlier digests</p>
              </div>
              {history.map((d, i) => (
                <div key={d.id}>
                  {i > 0 && <Separator className="bg-border-subtle" />}
                  <div className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-xs text-ink-muted">{fmtWhen(d.created_at)}</p>
                      <p className="line-clamp-1 text-sm text-ink">{d.headline}</p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-4 text-xs text-ink-muted">
                      <div className="flex items-center gap-1">
                        <Zap size={13} />
                        {fmtNum(d.total_kwh, 0)} kWh
                      </div>
                      <div className="flex items-center gap-1">
                        <IndianRupee size={13} />
                        {fmtNum(d.total_cost_inr, 0)}
                      </div>
                      <div
                        className={`flex items-center gap-1 ${(d.critical_count ?? 0) > 0 ? "text-bad" : "text-ink-muted"}`}
                      >
                        <TriangleAlert size={13} />
                        {d.anomaly_count}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </GlassCard>
          )}
        </>
      )}
    </PageShell>
  );
}
