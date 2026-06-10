import { useState } from "react";
import { TrendingUp } from "lucide-react";
import { motion, type Variants } from "framer-motion";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";

import PageShell from "@/shared/ui/PageShell";
import PageHeader from "@/shared/ui/PageHeader";
import PageHeaderIcon from "@/shared/ui/PageHeaderIcon";
import GlassCard from "@/shared/ui/GlassCard";
import GlassSelect from "@/shared/ui/GlassSelect";
import Eyebrow from "@/shared/ui/Eyebrow";
import { SkeletonKpiCard } from "@/shared/ui/SkeletonCard";
import { Badge } from "@/components/ui/badge";
import { useColorMode } from "@/app/theme/ColorModeProvider";
import useApi from "@/shared/hooks/useApi";

// ─────────────────────────────────────────────────────────────────────────────
// Types (derived from legacy field usage)
// ─────────────────────────────────────────────────────────────────────────────
interface Equipment {
  id: string;
  name: string;
  type: string;
}

interface ForecastPoint {
  hour_label: string;
  predicted: number;
  lower?: number;
  upper?: number;
  confidence?: string;
}

interface ForecastResponse {
  name: string;
  horizon_hours: number;
  backend?: string;
  fallback_reason?: string;
  note?: string;
  points: ForecastPoint[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Motion variants
// ─────────────────────────────────────────────────────────────────────────────
const fadeUp: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};
const stagger: Variants = {
  animate: { transition: { staggerChildren: 0.07 } },
};

// ─────────────────────────────────────────────────────────────────────────────
// Forecast chart
// ─────────────────────────────────────────────────────────────────────────────
function ForecastChart({ data, metric }: { data: ForecastResponse | null; metric: string }) {
  const { colorMode } = useColorMode();
  const isDark = colorMode === "dark";
  const tipBg = isDark ? "#0d1526" : "#ffffff";
  const tipBd = isDark ? "#1e2d4a" : "#E0E7FF";
  const tipFg = isDark ? "#fff" : "#0D0D0D";
  const tipMt = isDark ? "rgba(255,255,255,0.55)" : "#64748b";
  const gridCol = isDark ? "rgba(255,255,255,0.05)" : "rgba(31,63,254,0.06)";

  if (!data?.points?.length) {
    return (
      <GlassCard className="flex h-[240px] items-center justify-center">
        <p className="text-sm text-ink-muted">No forecast data</p>
      </GlassCard>
    );
  }

  const pts = data.points;
  const xData = pts.map((p) => p.hour_label.slice(11));
  const lower = pts.map((p) => +(p.lower ?? 0));
  const bandDelta = pts.map((p, i) => Math.max(0, (p.upper ?? 0) - lower[i]));
  const pred = pts.map((p) => p.predicted ?? null);
  const isEff = metric === "kw_per_tr";

  const option: EChartsOption = {
    animation: true,
    animationDuration: 800,
    grid: { top: 8, right: 16, bottom: 28, left: 44 },
    xAxis: {
      type: "category",
      data: xData,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { fontSize: 10, color: "#334155", interval: 3, hideOverlap: true },
      splitLine: { show: false },
      boundaryGap: false,
    },
    yAxis: {
      type: "value",
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { fontSize: 10, color: "#334155" },
      splitLine: { lineStyle: { color: gridCol, type: "dashed" } },
    },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "line", lineStyle: { color: "#7c3aed", opacity: 0.25 } },
      backgroundColor: tipBg,
      borderColor: tipBd,
      borderRadius: 10,
      padding: [8, 12],
      textStyle: { fontSize: 11, color: tipFg },
      formatter(params: unknown) {
        const arr = params as Array<{
          axisValue?: string;
          seriesName?: string;
          value?: number | null;
          color?: string;
        }>;
        const time = arr[0]?.axisValue;
        let html = `<div style="font-weight:600;color:${tipMt};margin-bottom:4px">${time}</div>`;
        for (const p of arr) {
          if (["Lower CI", "CI Band"].includes(p.seriesName ?? "") || p.value == null) continue;
          html += `<div style="display:flex;align-items:center;gap:6px">
            <span style="width:8px;height:8px;border-radius:50%;background:${p.color};display:inline-block"></span>
            <span style="color:${tipMt}">${p.seriesName}:</span>
            <span style="font-weight:700;color:${tipFg}">${Number(p.value).toFixed(3)}</span>
          </div>`;
        }
        return html;
      },
    },
    series: [
      {
        name: "Lower CI",
        type: "line",
        data: lower,
        lineStyle: { opacity: 0, width: 0 },
        areaStyle: { color: "transparent" },
        stack: "ci",
        symbol: "none",
        z: 1,
        silent: true,
      },
      {
        name: "CI Band",
        type: "line",
        data: bandDelta,
        lineStyle: { opacity: 0, width: 0 },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(124,58,237,0.22)" },
              { offset: 1, color: "rgba(124,58,237,0.04)" },
            ],
          },
        },
        stack: "ci",
        symbol: "none",
        z: 1,
        silent: true,
      },
      {
        name: "Predicted",
        type: "line",
        data: pred,
        smooth: true,
        symbol: "none",
        lineStyle: { color: "#7c3aed", width: 2.5 },
        z: 2,
        ...(isEff
          ? {
              markLine: {
                silent: true,
                symbol: "none",
                label: { show: false },
                data: [
                  { yAxis: 0.65, lineStyle: { color: "#10b981", type: "dashed", opacity: 0.45, width: 1.5 } },
                  { yAxis: 0.85, lineStyle: { color: "#ef4444", type: "dashed", opacity: 0.45, width: 1.5 } },
                ],
              },
            }
          : {}),
      },
    ],
  };

  return (
    <GlassCard className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4 pb-3">
        <p className="text-sm font-bold text-ink">
          {data.name} — {metric.replace(/_/g, " ")} forecast (next {data.horizon_hours}h)
        </p>
        <div className="flex gap-2">
          {data.backend === "ml" ? (
            <Badge
              className="rounded-[6px] border border-[rgba(6,182,212,0.3)] bg-[rgba(6,182,212,0.12)] px-2 text-[9px] text-[#06B6D4]"
              title="Holt-Winters triple-exponential (trend + 24h seasonality)"
            >
              ML · Holt-Winters
            </Badge>
          ) : (
            <Badge
              className="rounded-[6px] border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.12)] px-2 text-[9px] text-[#f59e0b]"
              title={data.fallback_reason || "hour-of-day statistical profile"}
            >
              {data.fallback_reason ? "Heuristic · fallback ⚠" : "Heuristic · hour-of-day"}
            </Badge>
          )}
          <Badge className="rounded-[6px] border border-border-subtle bg-elevated px-2 text-[9px] text-ink-muted">
            {data.points.length} points
          </Badge>
        </div>
      </div>
      <ReactECharts option={option} style={{ height: "220px", width: "100%" }} opts={{ renderer: "canvas" }} />
      <div className="px-5 pb-3">
        <p className="text-[10px] text-ink-muted">{data.note}</p>
      </div>
    </GlassCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Static config
// ─────────────────────────────────────────────────────────────────────────────
const METRICS_BY_TYPE: Record<string, string[]> = {
  chiller: [
    "kw_per_tr",
    "kw",
    "tr",
    "chiller_load",
    "evap_entering_temp",
    "evap_leaving_temp",
    "chw_delta_t",
    "cond_entering_temp",
    "cond_leaving_temp",
    "ambient_temp",
    "kwh",
    "trh",
  ],
  cooling_tower: ["kw", "kwh", "cumulative_kwh", "run_hours"],
  pump: ["kw", "kwh", "cumulative_kwh", "run_hours"],
};

const HORIZON_OPTIONS: { v: number; label: string }[] = [
  { v: 1, label: "Next 1h" },
  { v: 3, label: "Next 3h" },
  { v: 6, label: "Next 6h" },
  { v: 12, label: "Next 12h" },
  { v: 24, label: "Next 24h" },
  { v: 36, label: "Next 36h" },
  { v: 48, label: "Next 48h" },
  { v: 72, label: "Next 72h" },
  { v: 96, label: "Next 96h" },
  { v: 120, label: "Next 5d" },
  { v: 168, label: "Next 7d" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default function ForecastPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [selectedEq, setSelectedEq] = useState<string>("chiller_1");
  const [metric, setMetric] = useState<string>("kw_per_tr");
  const [horizon, setHorizon] = useState<number>(24);

  useApi<Equipment[]>("/api/v1/equipment", {
    onSuccess: (d) => setEquipment(Array.isArray(d) ? d : []),
  });

  const { data, isLoading: loading } = useApi<ForecastResponse>(
    selectedEq
      ? `/api/v1/forecast/${selectedEq}?metric=${metric}&horizon=${horizon}&history_days=7`
      : null,
    { enabled: !!selectedEq },
  );

  const eqObj = equipment.find((e) => e.id === selectedEq);
  const availMetrics = METRICS_BY_TYPE[eqObj?.type || "chiller"] || ["kw"];

  const pts = data?.points || [];
  const avgPred = pts.length ? pts.reduce((s, p) => s + p.predicted, 0) / pts.length : null;
  const minPred = pts.length ? Math.min(...pts.map((p) => p.predicted)) : null;
  const maxPred = pts.length ? Math.max(...pts.map((p) => p.predicted)) : null;
  const highConf = pts.filter((p) => p.confidence === "high").length;

  const kpis: { l: string; v: string | undefined; u?: string }[] = [
    {
      l: "Avg Predicted",
      v: avgPred?.toFixed(3),
      u: metric === "kw_per_tr" ? "kW/TR" : metric === "kw" ? "kW" : "%",
    },
    { l: "Min Predicted", v: minPred?.toFixed(3) },
    { l: "Max Predicted", v: maxPred?.toFixed(3) },
    { l: "High Confidence", v: `${highConf}/${pts.length}`, u: "hrs" },
  ];

  return (
    <PageShell>
      <PageHeader
        title="Energy Forecaster"
        icon={<PageHeaderIcon icon={<TrendingUp size={20} strokeWidth={1.85} />} />}
        subtitle="Hour-of-day mean ± 1σ over 7 days of recent history"
        actions={
          <div className="flex flex-wrap gap-3">
            <GlassSelect
              value={selectedEq}
              width="160px"
              onChange={(v) => {
                setSelectedEq(String(v));
                setMetric("kw_per_tr");
              }}
              options={[
                ...equipment.filter((e) => e.type === "chiller"),
                ...equipment.filter((e) => e.type !== "chiller"),
              ].map((e) => ({ value: e.id, label: e.name }))}
            />
            <GlassSelect
              value={metric}
              onChange={(v) => setMetric(String(v))}
              width="140px"
              options={availMetrics.map((m) => ({ value: m, label: m.replace(/_/g, " ") }))}
            />
            <GlassSelect
              value={horizon}
              onChange={(v) => setHorizon(Number(v))}
              width="140px"
              options={HORIZON_OPTIONS.map((h) => ({ value: h.v, label: h.label }))}
            />
          </div>
        }
      />

      {data && !loading && (
        <motion.div
          variants={stagger}
          initial="initial"
          animate="animate"
          className="mb-6 grid w-full min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {kpis.map((s, i) => (
            <motion.div key={i} variants={fadeUp}>
              <GlassCard className="p-4">
                <Eyebrow className="mb-2">{s.l}</Eyebrow>
                <div className="flex items-baseline gap-1">
                  <p className="text-xl font-bold text-cyan tabular-nums">{s.v ?? "—"}</p>
                  {s.u && <p className="text-xs text-ink-muted">{s.u}</p>}
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </motion.div>
      )}

      {loading ? (
        <SkeletonKpiCard />
      ) : (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <ForecastChart data={data} metric={metric} />
        </motion.div>
      )}

      {!loading && (
        <GlassCard className="mt-4 p-4">
          <Eyebrow className="mb-3">How this works</Eyebrow>
          <div className="flex flex-wrap gap-6">
            <p className="text-xs text-ink-muted">
              <span className="font-semibold text-ink">Purple line</span> — predicted value (mean of that
              hour-of-day over 7-day history)
            </p>
            <p className="text-xs text-ink-muted">
              <span className="font-semibold text-ink">Shaded band</span> — ±1 std deviation (68% confidence
              interval)
            </p>
            {metric === "kw_per_tr" && (
              <p className="text-xs text-ink-muted">
                <span className="font-semibold text-[#34d399]">Green</span> = 0.65 (good),{" "}
                <span className="font-semibold text-[#f87171]">Red</span> = 0.85 (poor)
              </p>
            )}
          </div>
        </GlassCard>
      )}
    </PageShell>
  );
}
