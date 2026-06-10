import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { ScrollText, MessageSquareText, Bot, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import PageShell from "@/shared/ui/PageShell";
import PageHeader from "@/shared/ui/PageHeader";
import PageHeaderIcon from "@/shared/ui/PageHeaderIcon";
import GlassSelect from "@/shared/ui/GlassSelect";
import GlassCard from "@/shared/ui/GlassCard";
import Eyebrow from "@/shared/ui/Eyebrow";
import { SkeletonKpiCard } from "@/shared/ui/SkeletonCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import useApi from "@/shared/hooks/useApi";
import { useColorMode } from "@/app/theme/ColorModeProvider";

// ── Response shapes (derived from legacy field usage) ───────────────────────
interface AuditStats {
  analyses_total: number;
  agents_total: number;
  analyses_by_status?: Record<string, number>;
}

interface AnalysisRow {
  id: number | string;
  created_at?: string;
  status: string;
  equipment_id?: string;
  model?: string;
  question?: string;
  total_ms?: number | null;
}

interface AgentRow {
  id: number | string;
  created_at?: string;
  status: string;
  mode?: string;
  steps_taken?: number | null;
  model?: string;
  goal?: string;
  total_ms?: number | null;
}

interface AnalysesResponse {
  rows?: AnalysisRow[];
}

interface AgentsResponse {
  rows?: AgentRow[];
}

interface QualityPoint {
  ts: string;
  ok: number;
  error: number;
}

interface QualityResponse {
  series?: QualityPoint[];
  success_rate: number;
  bucket_hours: number;
  by_status?: Record<string, number>;
  latency_by_status?: Record<string, number | null>;
}

// ── Status chip color map (verbatim from legacy) ────────────────────────────
type StatusColor = { c: string; bg: string; b: string };
const STATUS_COLOR: Record<string, StatusColor> = {
  ok: { c: "#10b981", bg: "rgba(16,185,129,0.12)", b: "rgba(16,185,129,0.32)" },
  streaming: { c: "#0ea5e9", bg: "rgba(14,165,233,0.12)", b: "rgba(14,165,233,0.32)" },
  running: { c: "#0ea5e9", bg: "rgba(14,165,233,0.12)", b: "rgba(14,165,233,0.32)" },
  error: { c: "#ef4444", bg: "rgba(239,68,68,0.12)", b: "rgba(239,68,68,0.32)" },
};

function StatusChip({ status }: { status: string }) {
  const s = STATUS_COLOR[status] || STATUS_COLOR.ok;
  return (
    <div
      className="w-fit rounded-[6px] border px-2 py-[2px] text-[10px] font-bold tracking-[0.06em] uppercase"
      style={{ background: s.bg, borderColor: s.b, color: s.c }}
    >
      {status}
    </div>
  );
}

const MotionDiv = motion.div;

/**
 * Resolve the legacy `color` prop: design tokens map to utility classes; raw
 * hex values map to an inline color style. `text.primary` => text-ink.
 */
function resolveColor(color: string): { className: string; style?: CSSProperties } {
  if (color === "text.primary") return { className: "text-ink" };
  if (color === "text.muted") return { className: "text-ink-muted" };
  return { className: "", style: { color } };
}

function StatTile({
  label,
  value,
  color = "text.primary",
  delay = 0,
}: {
  label: string;
  value: ReactNode;
  color?: string;
  delay?: number;
}) {
  const resolved = resolveColor(color);
  return (
    <MotionDiv initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay }}>
      <GlassCard className="p-4">
        <Eyebrow className="mb-2">{label}</Eyebrow>
        <p
          className={`text-2xl font-bold tabular-nums ${resolved.className}`}
          style={resolved.style}
        >
          {value}
        </p>
      </GlassCard>
    </MotionDiv>
  );
}

export default function AuditPage() {
  const { colorMode } = useColorMode();
  const isDark = colorMode === "dark";
  const [hours, setHours] = useState<number>(24);

  const bucketHours = hours >= 168 ? 6 : 1;

  // Four parallel fetches mirror the legacy Promise.all. The legacy combined
  // `loading` flag is true until all four resolve (success OR error → resolved).
  const stats = useApi<AuditStats>(`/api/v1/audit/stats?hours=${hours}`);
  const analyses = useApi<AnalysesResponse>(`/api/v1/audit/analyses?hours=${hours}&limit=100`);
  const agents = useApi<AgentsResponse>(`/api/v1/audit/agents?hours=${hours}&limit=100`);
  const quality = useApi<QualityResponse>(`/api/v1/audit/quality?hours=${hours}&bucket_hours=${bucketHours}`);

  const statsData = stats.data;
  const analysesData = analyses.data;
  const agentsData = agents.data;
  const qualityData = quality.data;

  const loading =
    stats.isLoading || analyses.isLoading || agents.isLoading || quality.isLoading;

  const okCount = statsData?.analyses_by_status?.ok ?? 0;
  const errCount = statsData?.analyses_by_status?.error ?? 0;

  const qualityOption = useMemo<EChartsOption | null>(() => {
    if (!qualityData?.series?.length) return null;
    const xData = qualityData.series.map((p) =>
      new Date(p.ts).toLocaleString("en-IN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
    );
    const okData = qualityData.series.map((p) => p.ok);
    const errData = qualityData.series.map((p) => p.error);
    return {
      animation: true,
      animationDuration: 600,
      grid: { top: 24, right: 16, bottom: 32, left: 36 },
      legend: {
        data: ["OK", "Error"],
        top: 0,
        textStyle: { color: isDark ? "#CCCCD4" : "#3B3B42", fontSize: 11 },
        itemWidth: 12,
        itemHeight: 8,
      },
      xAxis: {
        type: "category",
        data: xData,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { fontSize: 10, color: isDark ? "#9D9DAA" : "#334155", hideOverlap: true, interval: "auto" },
        splitLine: { show: false },
        boundaryGap: false,
      },
      yAxis: {
        type: "value",
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { fontSize: 10, color: isDark ? "#9D9DAA" : "#334155" },
        splitLine: { lineStyle: { color: isDark ? "rgba(255,255,255,0.05)" : "rgba(31,63,254,0.06)", type: "dashed" } },
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: isDark ? "#0d1526" : "#fff",
        borderColor: isDark ? "#1e2d4a" : "#E0E7FF",
        borderRadius: 10,
        padding: [8, 12],
        textStyle: { fontSize: 11, color: isDark ? "#fff" : "#0D0D0D" },
      },
      series: [
        {
          name: "OK",
          type: "bar",
          stack: "verdict",
          data: okData,
          itemStyle: { color: "#10b981", borderRadius: [3, 3, 0, 0] },
          barMaxWidth: 18,
        },
        {
          name: "Error",
          type: "bar",
          stack: "verdict",
          data: errData,
          itemStyle: { color: "#ef4444", borderRadius: [3, 3, 0, 0] },
          barMaxWidth: 18,
        },
      ],
    };
  }, [qualityData, isDark]);

  const analysisRows = analysesData?.rows ?? [];
  const agentRows = agentsData?.rows ?? [];

  return (
    <PageShell>
      <PageHeader
        title="Audit Log"
        icon={<PageHeaderIcon icon={<ScrollText size={20} strokeWidth={1.85} />} />}
        subtitle="Every AI request — model, duration, status, prompt+response hashes — for compliance and replay"
        actions={
          <GlassSelect
            value={hours}
            onChange={(v) => setHours(Number(v))}
            width="140px"
            options={[
              { value: 1, label: "Last 1h" },
              { value: 6, label: "Last 6h" },
              { value: 24, label: "Last 24h" },
              { value: 72, label: "Last 72h" },
              { value: 168, label: "Last 7d" },
              { value: 720, label: "Last 30d" },
            ]}
          />
        }
      />

      {statsData && !loading && (
        <div className="mb-6 grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Analyses" value={statsData.analyses_total} delay={0} />
          <StatTile label="Agent runs" value={statsData.agents_total} delay={0.04} />
          <StatTile label="Successful" value={okCount} color="#10b981" delay={0.08} />
          <StatTile label="Errors" value={errCount} color={errCount ? "#ef4444" : "text.primary"} delay={0.12} />
        </div>
      )}

      {loading ? (
        <SkeletonKpiCard />
      ) : (
        <Tabs defaultValue="analyses">
          <TabsList variant="line" className="mb-4 w-full justify-start border-b border-border-subtle">
            <TabsTrigger value="analyses" className="text-sm font-semibold">
              <MessageSquareText size={14} strokeWidth={2} />
              Analyses ({analysisRows.length})
            </TabsTrigger>
            <TabsTrigger value="agents" className="text-sm font-semibold">
              <Bot size={14} strokeWidth={2} />
              Agent runs ({agentRows.length})
            </TabsTrigger>
            <TabsTrigger value="quality" className="text-sm font-semibold">
              <ShieldCheck size={14} strokeWidth={2} />
              Quality
            </TabsTrigger>
          </TabsList>

          {/* ── Analyses ─────────────────────────────────────────────── */}
          <TabsContent value="analyses">
            <GlassCard hover={false} className="overflow-hidden p-0">
              <div className="overflow-x-auto">
                <div className="min-w-[900px]">
                  <div className="grid grid-cols-[170px_110px_120px_90px_minmax(0,1fr)_80px] gap-3 border-b border-border-subtle px-4 py-3">
                    <Eyebrow>When</Eyebrow>
                    <Eyebrow>Status</Eyebrow>
                    <Eyebrow>Equipment</Eyebrow>
                    <Eyebrow>Model</Eyebrow>
                    <Eyebrow>Question</Eyebrow>
                    <Eyebrow>Duration</Eyebrow>
                  </div>
                  {analysisRows.map((r) => (
                    <div
                      key={r.id}
                      className="grid grid-cols-[170px_110px_120px_90px_minmax(0,1fr)_80px] gap-3 border-b border-border-subtle px-4 py-[10px] hover:bg-[rgba(31,63,254,0.04)]"
                    >
                      <p className="font-mono text-[11px] text-ink-muted">
                        {r.created_at?.replace("T", " ").slice(0, 19) || "—"}
                      </p>
                      <StatusChip status={r.status} />
                      <p className="line-clamp-1 text-xs text-ink">{r.equipment_id || "—"}</p>
                      <Badge className="w-fit rounded-[6px] border border-border-subtle bg-chip px-2 text-[9px] text-ink-muted">
                        {r.model || "—"}
                      </Badge>
                      <p className="line-clamp-2 text-xs text-ink">{r.question}</p>
                      <p className="text-right text-xs text-ink-muted tabular-nums">
                        {r.total_ms ? `${(r.total_ms / 1000).toFixed(1)}s` : "—"}
                      </p>
                    </div>
                  ))}
                  {analysisRows.length === 0 && (
                    <p className="px-4 py-6 text-center text-sm text-ink-muted">No analyses in this window.</p>
                  )}
                </div>
              </div>
            </GlassCard>
          </TabsContent>

          {/* ── Agent runs ───────────────────────────────────────────── */}
          <TabsContent value="agents">
            <GlassCard hover={false} className="overflow-hidden p-0">
              <div className="overflow-x-auto">
                <div className="min-w-[900px]">
                  <div className="grid grid-cols-[170px_110px_120px_80px_90px_minmax(0,1fr)_80px] gap-3 border-b border-border-subtle px-4 py-3">
                    <Eyebrow>When</Eyebrow>
                    <Eyebrow>Status</Eyebrow>
                    <Eyebrow>Mode</Eyebrow>
                    <Eyebrow>Steps</Eyebrow>
                    <Eyebrow>Model</Eyebrow>
                    <Eyebrow>Goal</Eyebrow>
                    <Eyebrow>Duration</Eyebrow>
                  </div>
                  {agentRows.map((r) => (
                    <div
                      key={r.id}
                      className="grid grid-cols-[170px_110px_120px_80px_90px_minmax(0,1fr)_80px] gap-3 border-b border-border-subtle px-4 py-[10px] hover:bg-[rgba(31,63,254,0.04)]"
                    >
                      <p className="font-mono text-[11px] text-ink-muted">
                        {r.created_at?.replace("T", " ").slice(0, 19) || "—"}
                      </p>
                      <StatusChip status={r.status} />
                      <Badge
                        className="w-fit rounded-[6px] border px-2 text-[9px]"
                        style={{ background: "rgba(124,58,237,0.12)", color: "#a78bfa", borderColor: "rgba(124,58,237,0.25)" }}
                      >
                        {r.mode}
                      </Badge>
                      <p className="text-xs text-ink tabular-nums">{r.steps_taken ?? "—"}</p>
                      <Badge className="w-fit rounded-[6px] border border-border-subtle bg-chip px-2 text-[9px] text-ink-muted">
                        {r.model || "—"}
                      </Badge>
                      <p className="line-clamp-2 text-xs text-ink">{r.goal}</p>
                      <p className="text-right text-xs text-ink-muted tabular-nums">
                        {r.total_ms ? `${(r.total_ms / 1000).toFixed(1)}s` : "—"}
                      </p>
                    </div>
                  ))}
                  {agentRows.length === 0 && (
                    <p className="px-4 py-6 text-center text-sm text-ink-muted">No agent runs in this window.</p>
                  )}
                </div>
              </div>
            </GlassCard>
          </TabsContent>

          {/* ── Quality ──────────────────────────────────────────────── */}
          <TabsContent value="quality">
            {/* Quality KPIs */}
            <div className="mb-6 grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile
                label="Success rate"
                value={qualityData ? `${(qualityData.success_rate * 100).toFixed(1)}%` : "—"}
                color="#10b981"
                delay={0}
              />
              <StatTile label="OK" value={qualityData?.by_status?.ok ?? 0} color="#10b981" delay={0.04} />
              <StatTile
                label="Error"
                value={qualityData?.by_status?.error ?? 0}
                color={qualityData?.by_status?.error ? "#ef4444" : "text.primary"}
                delay={0.08}
              />
              <StatTile
                label="Cancelled"
                value={qualityData?.by_status?.cancelled ?? 0}
                color="text.muted"
                delay={0.12}
              />
            </div>

            {qualityOption && qualityData ? (
              <GlassCard hover={false} className="overflow-hidden p-0">
                <div className="flex items-center gap-2 px-5 pt-4 pb-3">
                  <ShieldCheck size={14} strokeWidth={2} color="#10b981" />
                  <Eyebrow>Verdict trend</Eyebrow>
                  <Badge className="ml-auto rounded-[6px] border border-border-subtle bg-chip px-2 text-[9px] text-ink-muted">
                    {qualityData.bucket_hours}h buckets · {qualityData.series?.length ?? 0} points
                  </Badge>
                </div>
                <ReactECharts option={qualityOption} style={{ height: "280px", width: "100%" }} opts={{ renderer: "canvas" }} />
                <div className="px-5 pb-3">
                  <p className="text-[10px] text-ink-muted">
                    Green = analyses that passed self-critique without issues. Red = errors / aborted runs. Hallucination
                    score is derived from the self-critique verdict written to <code>analysis_audit.status</code>.
                  </p>
                </div>
              </GlassCard>
            ) : (
              <GlassCard hover={false} className="flex items-center justify-center p-6">
                <p className="text-sm text-ink-muted">No analyses in this window yet.</p>
              </GlassCard>
            )}

            {/* Latency split */}
            {qualityData?.latency_by_status && Object.keys(qualityData.latency_by_status).length > 0 && (
              <GlassCard hover={false} className="mt-4 p-4">
                <Eyebrow className="mb-3">Average latency by verdict</Eyebrow>
                <div className="flex flex-wrap gap-6">
                  {Object.entries(qualityData.latency_by_status).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-2">
                      <div
                        className="size-2 rounded-full"
                        style={{ background: k === "ok" ? "#10b981" : k === "error" ? "#ef4444" : "#64748b" }}
                      />
                      <p className="text-xs text-ink-muted">{k}:</p>
                      <p className="text-xs font-bold text-ink tabular-nums">
                        {v != null ? `${(v / 1000).toFixed(2)}s` : "—"}
                      </p>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}
          </TabsContent>
        </Tabs>
      )}
    </PageShell>
  );
}
