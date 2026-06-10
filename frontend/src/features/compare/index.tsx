import { useMemo, useState } from "react";
import { Trophy, Columns2 } from "lucide-react";
import { motion } from "framer-motion";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import PageShell from "@/shared/ui/PageShell";
import PageHeader from "@/shared/ui/PageHeader";
import PageHeaderIcon from "@/shared/ui/PageHeaderIcon";
import GlassSelect from "@/shared/ui/GlassSelect";
import GlassCard from "@/shared/ui/GlassCard";
import Eyebrow from "@/shared/ui/Eyebrow";
import StatusPulse from "@/shared/ui/StatusPulse";
import { SkeletonEquipCard } from "@/shared/ui/SkeletonCard";
import { useColorMode } from "@/app/theme/ColorModeProvider";
import useApi from "@/shared/hooks/useApi";

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.28 } },
};

const COLORS = { a: "#00c4f4", b: "#7c3aed" } as const;
const BAND_GOOD = 0.65;
const BAND_POOR = 0.85;

function bandColor(v: number | null | undefined): string {
  if (v == null) return "#64748b";
  return v < BAND_GOOD ? "#10b981" : v < BAND_POOR ? "#f59e0b" : "#ef4444";
}

// ── API shapes (derived from legacy field usage) ──
interface Equipment {
  id: string;
  name: string;
}

interface TimeseriesPoint {
  slot_time: string;
  kw_per_tr: number | null;
}

interface CompareSummary {
  avg_kw_per_tr?: number | null;
  avg_kw?: number | null;
  avg_tr?: number | null;
  avg_chiller_load?: number | null;
  avg_chw_delta_t?: number | null;
  running_pct?: number | null;
}

interface CompareEfficiency {
  kw_per_tr_avg?: number | null;
  band?: number | null;
  delta_pct?: number | null;
}

interface CompareSide {
  name: string;
  timeseries?: TimeseriesPoint[];
  summary?: CompareSummary;
  efficiency?: CompareEfficiency | null;
}

interface CompareData {
  a: CompareSide;
  b: CompareSide;
}

type ChartRow = { slot_time: string } & Record<string, number | null | string>;

function StatRow({
  label,
  valA,
  valB,
  isEff,
}: {
  label: string;
  valA: number | null | undefined;
  valB: number | null | undefined;
  isEff: boolean;
}) {
  const a = valA != null ? Number(valA).toFixed(3) : "—";
  const b = valB != null ? Number(valB).toFixed(3) : "—";
  const better =
    valA != null && valB != null
      ? isEff
        ? valA < valB
          ? "a"
          : "b"
        : valA > valB
          ? "a"
          : "b"
      : null;

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2 border-b border-border-subtle py-2">
      <p className="text-xs font-bold tracking-[0.08em] text-ink-muted uppercase">{label}</p>
      <p
        className="text-center text-sm font-bold tabular-nums"
        style={{ color: better === "a" ? "#4ade80" : isEff ? bandColor(valA) : "var(--ink)" }}
      >
        {a}
      </p>
      <p
        className="text-center text-sm font-bold tabular-nums"
        style={{ color: better === "b" ? "#4ade80" : isEff ? bandColor(valB) : "var(--ink)" }}
      >
        {b}
      </p>
    </div>
  );
}

export default function ComparePage() {
  const { colorMode } = useColorMode();
  const isDark = colorMode === "dark";
  const tipBg = isDark ? "#0d1526" : "#ffffff";
  const tipBd = isDark ? "#1e2d4a" : "#E0E7FF";
  const tipFg = isDark ? "#fff" : "#0D0D0D";
  const tipMt = isDark ? "rgba(255,255,255,0.55)" : "#64748b";
  const gridCol = isDark ? "rgba(255,255,255,0.05)" : "rgba(31,63,254,0.06)";

  const [eqA, setEqA] = useState<string>("chiller_1");
  const [eqB, setEqB] = useState<string>("chiller_2");
  const [hours, setHours] = useState<number>(24);

  const { data: equipmentData } = useApi<Equipment[]>("/api/v1/equipment");
  const equipment = equipmentData ?? [];

  // Legacy re-fetched the compare payload on every eqA/eqB/hours change, but
  // guarded against missing or identical ids. We mirror that with `enabled`:
  // when the guard fails the request is skipped and prior data is retained.
  const compareEnabled = !!eqA && !!eqB && eqA !== eqB;
  const { data, isLoading } = useApi<CompareData>(
    `/api/v1/compare?a=${eqA}&b=${eqB}&hours=${hours}`,
    { enabled: compareEnabled },
  );
  const loading = compareEnabled && isLoading;

  const chartData = useMemo<ChartRow[]>(() => {
    if (!data) return [];
    const map: Record<string, ChartRow> = {};
    (data.a.timeseries || []).forEach((p) => {
      if (!map[p.slot_time]) map[p.slot_time] = { slot_time: p.slot_time };
      map[p.slot_time][`${data.a.name}_kW/TR`] = p.kw_per_tr;
    });
    (data.b.timeseries || []).forEach((p) => {
      if (!map[p.slot_time]) map[p.slot_time] = { slot_time: p.slot_time };
      map[p.slot_time][`${data.b.name}_kW/TR`] = p.kw_per_tr;
    });
    return Object.values(map).sort((x, y) => x.slot_time.localeCompare(y.slot_time));
  }, [data]);

  const compareOption = useMemo<EChartsOption | null>(() => {
    if (!data || !chartData.length) return null;
    const xData = chartData.map((p) => p.slot_time);
    const seriesA = chartData.map((p) => (p[`${data.a.name}_kW/TR`] as number | null) ?? null);
    const seriesB = chartData.map((p) => (p[`${data.b.name}_kW/TR`] as number | null) ?? null);
    return {
      animation: true,
      animationDuration: 600,
      grid: { top: 8, right: 16, bottom: 28, left: 40 },
      xAxis: {
        type: "category",
        data: xData,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          fontSize: 10,
          color: "#334155",
          formatter: (v: string) => String(v).slice(11, 16),
          hideOverlap: true,
          showMinLabel: true,
          showMaxLabel: true,
        },
        splitLine: { show: false },
        boundaryGap: false,
      },
      yAxis: {
        type: "value",
        min: 0.3,
        max: 1.2,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { fontSize: 10, color: "#334155" },
        splitLine: { lineStyle: { color: gridCol, type: "dashed" } },
      },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "line", lineStyle: { color: "#94a3b8", opacity: 0.3 } },
        backgroundColor: tipBg,
        borderColor: tipBd,
        borderRadius: 10,
        padding: [8, 12],
        textStyle: { fontSize: 11, color: tipFg },
        formatter(params: unknown) {
          const arr = params as Array<{
            axisValue: string;
            value: number | null;
            color: string;
            seriesName: string;
          }>;
          const time = String(arr[0]?.axisValue).slice(11, 16);
          let html = `<div style="font-weight:600;color:${tipMt};margin-bottom:4px">${time}</div>`;
          for (const p of arr) {
            if (p.value == null) continue;
            html += `<div style="display:flex;align-items:center;gap:6px">
              <span style="width:8px;height:8px;border-radius:50%;background:${p.color};display:inline-block"></span>
              <span style="color:${tipMt}">${p.seriesName}:</span>
              <span style="font-weight:700;color:${bandColor(p.value)}">${Number(p.value).toFixed(3)}</span>
            </div>`;
          }
          return html;
        },
      },
      series: [
        {
          name: data.a.name,
          type: "line",
          data: seriesA,
          symbol: "none",
          lineStyle: { color: COLORS.a, width: 2 },
          markLine: {
            silent: true,
            symbol: "none",
            label: { show: false },
            data: [
              { yAxis: BAND_GOOD, lineStyle: { color: "#10b981", type: "dashed", opacity: 0.4, width: 1.5 } },
              { yAxis: BAND_POOR, lineStyle: { color: "#ef4444", type: "dashed", opacity: 0.4, width: 1.5 } },
            ],
          },
        },
        {
          name: data.b.name,
          type: "line",
          data: seriesB,
          symbol: "none",
          lineStyle: { color: COLORS.b, width: 2 },
        },
      ],
    } as EChartsOption;
  }, [data, chartData, tipBg, tipBd, tipFg, tipMt, gridCol]);

  const sa: CompareSummary = data?.a?.summary || {};
  const sb: CompareSummary = data?.b?.summary || {};
  const ea = data?.a?.efficiency;
  const eb = data?.b?.efficiency;
  const better =
    ea && eb && data
      ? (ea.kw_per_tr_avg ?? 0) < (eb.kw_per_tr_avg ?? 0)
        ? data.a.name
        : data.b.name
      : null;

  return (
    <PageShell>
      <PageHeader
        title="Comparison View"
        subtitle="Side-by-side equipment analysis — overlay chart + delta statistics"
        icon={<PageHeaderIcon icon={<Columns2 size={20} strokeWidth={1.85} />} />}
        actions={
          <div className="flex w-full max-w-full flex-wrap items-center gap-2 sm:gap-3 xl:w-auto">
            <GlassSelect
              value={eqA}
              onChange={(v) => setEqA(String(v))}
              placeholder="Equipment A"
              width="155px"
              className="w-full sm:w-[155px]"
              options={equipment.map((e) => ({ value: e.id, label: e.name }))}
            />
            <span className="text-sm font-bold text-ink-muted" aria-hidden="true">
              vs
            </span>
            <GlassSelect
              value={eqB}
              onChange={(v) => setEqB(String(v))}
              placeholder="Equipment B"
              width="155px"
              className="w-full sm:w-[155px]"
              options={equipment.map((e) => ({ value: e.id, label: e.name }))}
            />
            <GlassSelect
              value={hours}
              onChange={(v) => setHours(Number(v))}
              width="130px"
              options={[
                { value: 6, label: "6 hours" },
                { value: 12, label: "12 hours" },
                { value: 24, label: "24 hours" },
                { value: 48, label: "48 hours" },
                { value: 168, label: "7 days" },
              ]}
            />
          </div>
        }
      />

      {better && (
        <motion.div variants={fadeUp} initial="initial" animate="animate" className="mb-5">
          <GlassCard glow className="p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="text-good">
                <Trophy size={18} strokeWidth={2} />
              </span>
              <p className="text-sm text-ink">
                <span className="font-bold text-[#4ade80]">{better}</span>{" "}
                is performing better (kW/TR: {ea?.kw_per_tr_avg?.toFixed(3)} vs{" "}
                {eb?.kw_per_tr_avg?.toFixed(3)} — delta{" "}
                {Math.abs((ea?.kw_per_tr_avg || 0) - (eb?.kw_per_tr_avg || 0)).toFixed(3)} kW/TR)
              </p>
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* Overlay chart */}
      {loading ? (
        <SkeletonEquipCard />
      ) : (
        compareOption && (
          <motion.div variants={fadeUp} initial="initial" animate="animate" className="mb-5">
            <GlassCard hover={false} className="overflow-hidden p-0 md:p-0">
              <div className="flex flex-wrap items-center gap-3 px-5 pt-4 pb-3">
                <p className="text-sm font-bold text-ink">kW/TR — {hours}h overlay</p>
                <div className="ml-auto flex gap-3">
                  {[
                    { name: data?.a?.name, c: COLORS.a },
                    { name: data?.b?.name, c: COLORS.b },
                  ].map(({ name, c }) => (
                    <div key={name} className="flex items-center gap-2">
                      <span className="h-[2px] w-3 rounded-full" style={{ background: c }} />
                      <span className="text-xs text-ink-muted">{name}</span>
                    </div>
                  ))}
                </div>
              </div>
              <ReactECharts
                option={compareOption}
                style={{ height: "220px", width: "100%" }}
                opts={{ renderer: "canvas" }}
              />
            </GlassCard>
          </motion.div>
        )
      )}

      {/* Side-by-side stats */}
      {data && !loading && (
        <motion.div variants={fadeUp} initial="initial" animate="animate">
          <GlassCard>
            <div className="w-full max-w-full overflow-x-auto">
              <div className="min-w-[520px] md:min-w-0">
                {/* Header row */}
                <div className="mb-1 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2 border-b border-border-subtle pb-3">
                  <Eyebrow>Metric</Eyebrow>
                  <div className="flex items-center justify-center gap-2">
                    <span className="size-2 rounded-full" style={{ background: COLORS.a }} />
                    <span className="text-xs font-bold" style={{ color: COLORS.a }}>
                      {data.a.name}
                    </span>
                    <StatusPulse active={(sa.running_pct || 0) > 0} size="7px" />
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <span className="size-2 rounded-full" style={{ background: COLORS.b }} />
                    <span className="text-xs font-bold" style={{ color: COLORS.b }}>
                      {data.b.name}
                    </span>
                    <StatusPulse active={(sb.running_pct || 0) > 0} size="7px" />
                  </div>
                </div>
                <StatRow label="kW/TR avg" valA={sa.avg_kw_per_tr} valB={sb.avg_kw_per_tr} isEff={true} />
                <StatRow label="kW avg" valA={sa.avg_kw} valB={sb.avg_kw} isEff={false} />
                <StatRow label="TR avg" valA={sa.avg_tr} valB={sb.avg_tr} isEff={false} />
                <StatRow label="Load %" valA={sa.avg_chiller_load} valB={sb.avg_chiller_load} isEff={false} />
                <StatRow label="CHW ΔT" valA={sa.avg_chw_delta_t} valB={sb.avg_chw_delta_t} isEff={false} />
                <StatRow label="Run %" valA={sa.running_pct} valB={sb.running_pct} isEff={false} />
                {ea && eb && (
                  <>
                    <StatRow label="Eff band" valA={ea.band} valB={eb.band} isEff={false} />
                    <StatRow label="Δ vs design" valA={ea.delta_pct} valB={eb.delta_pct} isEff={true} />
                  </>
                )}
              </div>
            </div>
          </GlassCard>
        </motion.div>
      )}
    </PageShell>
  );
}
