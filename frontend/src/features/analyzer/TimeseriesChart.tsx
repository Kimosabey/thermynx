import ReactECharts from "echarts-for-react";
import { motion, useReducedMotion } from "framer-motion";
import type { EChartsOption } from "echarts";

import GlassCard from "@/shared/ui/GlassCard";

// ── API shapes ──────────────────────────────────────────────────────────────

/** One sampled point of an equipment timeseries. */
export interface TimeseriesPoint {
  slot_time: string;
  kw_per_tr?: number | null;
  kw?: number | null;
}

/** /api/v1/equipment/{id}/timeseries payload. */
export interface TimeseriesData {
  type?: string;
  hours?: number;
  count?: number;
  resolution?: string;
  points?: TimeseriesPoint[];
}

const BAND_GOOD = 0.65;
const BAND_POOR = 0.85;

function bandColor(v: number | null | undefined): string {
  if (v == null) return "#64748b";
  return v < BAND_GOOD ? "#10b981" : v < BAND_POOR ? "#f59e0b" : "#ef4444";
}

function fmtTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export interface TimeseriesChartProps {
  data?: TimeseriesData | null;
  equipmentName?: string;
  loading?: boolean;
}

export default function TimeseriesChart({ data, equipmentName, loading }: TimeseriesChartProps) {
  const reduced = useReducedMotion();

  if (loading) {
    return (
      <GlassCard className="flex h-[220px] items-center justify-center">
        <p className="text-sm text-ink-muted" role="status">
          Loading chart…
        </p>
      </GlassCard>
    );
  }
  if (!data?.points?.length) {
    return (
      <GlassCard className="flex h-[220px] items-center justify-center">
        <p className="text-sm text-ink-muted">Select equipment to view chart</p>
      </GlassCard>
    );
  }

  const isChiller = data.type === "chiller";
  const step = Math.max(1, Math.floor(data.points.length / 200));
  const pts = data.points.filter((_, i) => i % step === 0);

  const effPts = data.points.filter((p) => p.kw_per_tr != null);
  const avg = effPts.length
    ? effPts.reduce((s, p) => s + (p.kw_per_tr as number), 0) / effPts.length
    : null;
  const kwPts = data.points.filter((p) => p.kw != null);
  const minKw = kwPts.length ? Math.min(...kwPts.map((p) => p.kw as number)) : null;
  const maxKw = kwPts.length ? Math.max(...kwPts.map((p) => p.kw as number)) : null;

  const a11y = [
    `${equipmentName ?? "Equipment"} timeseries over ${data.hours} hours, ${data.count} data points at ${data.resolution} resolution.`,
    isChiller && avg != null ? `Average kW/TR: ${avg.toFixed(3)}.` : null,
    minKw != null && maxKw != null ? `kW range: ${minKw.toFixed(0)} to ${maxKw.toFixed(0)}.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const xData = pts.map((p) => p.slot_time);
  const kwTrData = pts.map((p) => p.kw_per_tr ?? null);
  const kwData = pts.map((p) => p.kw ?? null);

  const option: EChartsOption = {
    animation: !reduced,
    animationDuration: 700,
    grid: { top: 8, right: 48, bottom: 28, left: isChiller ? 44 : 8 },
    xAxis: {
      type: "category",
      data: xData,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        fontSize: 10,
        color: "#334155",
        formatter: fmtTime,
        showMinLabel: true,
        showMaxLabel: true,
        hideOverlap: true,
      },
      splitLine: { show: false },
      boundaryGap: false,
    },
    yAxis: [
      {
        type: "value",
        show: isChiller,
        position: "left",
        min: 0.3,
        max: 1.1,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { fontSize: 10, color: "#334155" },
        splitLine: { lineStyle: { color: "rgba(31,63,254,0.06)", type: "dashed" } },
      },
      {
        type: "value",
        position: "right",
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { fontSize: 10, color: "#334155" },
        splitLine: { show: false },
      },
    ],
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "line", lineStyle: { color: "#1F3FFE", opacity: 0.25 } },
      backgroundColor: "#ffffff",
      borderColor: "#E0E7FF",
      borderRadius: 10,
      padding: [8, 12],
      textStyle: { fontSize: 11 },
      formatter(params: unknown) {
        const arr = params as Array<{
          axisValue?: string;
          value?: number | null;
          seriesName?: string;
          color?: string;
        }>;
        const time = fmtTime(arr[0]?.axisValue);
        let html = `<div style="font-weight:600;color:#64748b;margin-bottom:4px">${time}</div>`;
        for (const p of arr) {
          if (p.value == null) continue;
          const col = p.seriesName === "kW/TR" ? bandColor(p.value) : "#0d0d0d";
          html += `<div style="display:flex;align-items:center;gap:6px">
            <span style="width:8px;height:8px;border-radius:50%;background:${p.color};display:inline-block"></span>
            <span style="color:#64748b">${p.seriesName}:</span>
            <span style="font-weight:700;color:${col}">${Number(p.value).toFixed(3)}</span>
          </div>`;
        }
        return html;
      },
    },
    series: [
      isChiller && {
        name: "kW/TR",
        type: "line",
        yAxisIndex: 0,
        data: kwTrData,
        smooth: 0.3,
        symbol: "none",
        lineStyle: { color: "#1F3FFE", width: 2 },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0.05, color: "rgba(31,63,254,0.18)" },
              { offset: 0.95, color: "rgba(31,63,254,0.0)" },
            ],
          },
        },
        markLine: {
          silent: true,
          symbol: "none",
          label: { show: false },
          data: [
            { yAxis: BAND_GOOD, lineStyle: { color: "#10b981", type: "dashed", opacity: 0.5, width: 1.5 } },
            { yAxis: BAND_POOR, lineStyle: { color: "#ef4444", type: "dashed", opacity: 0.5, width: 1.5 } },
          ],
        },
      },
      {
        name: "kW",
        type: "bar",
        yAxisIndex: 1,
        data: kwData,
        barMaxWidth: 5,
        itemStyle: { color: "rgba(31,63,254,0.22)", borderRadius: [2, 2, 0, 0] },
      },
    ].filter(Boolean) as EChartsOption["series"],
  };

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <GlassCard hover={false} className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4 pb-3">
          <h2 className="text-sm font-bold text-ink">{equipmentName}</h2>
          <div className="flex flex-wrap gap-2">
            {avg != null && (
              <span
                className="inline-flex items-center rounded-[6px] border px-2 py-[2px] text-[10px]"
                style={{
                  background:
                    avg < BAND_GOOD
                      ? "rgba(16,185,129,0.12)"
                      : avg < BAND_POOR
                        ? "rgba(245,158,11,0.12)"
                        : "rgba(239,68,68,0.12)",
                  color: bandColor(avg),
                  borderColor:
                    avg < BAND_GOOD
                      ? "rgba(16,185,129,0.25)"
                      : avg < BAND_POOR
                        ? "rgba(245,158,11,0.25)"
                        : "rgba(239,68,68,0.25)",
                }}
              >
                Avg kW/TR: {avg.toFixed(3)}
              </span>
            )}
            <span className="inline-flex items-center rounded-[6px] border border-border-subtle bg-chip px-2 text-[10px] text-ink-muted">
              {data.resolution} · {data.hours}h · {data.count} pts
            </span>
          </div>
        </div>

        <figure role="img" aria-label={a11y} className="m-0">
          <figcaption className="sr-only">{a11y}</figcaption>
          <ReactECharts
            option={option}
            style={{ height: "200px", width: "100%" }}
            opts={{ renderer: "canvas" }}
          />
        </figure>
      </GlassCard>
    </motion.div>
  );
}
