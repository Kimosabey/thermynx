import { useState, useEffect } from "react";
import { Box, Flex, Text, Select, Grid, Badge, useColorMode } from "@chakra-ui/react";
import { TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import ReactECharts from "echarts-for-react";
import PageShell from "../../shared/ui/PageShell";
import PageHeader from "../../shared/ui/PageHeader";
import { surfaceSelectProps } from "../../shared/ui/PeriodSelect";
import GlassCard from "../../shared/ui/GlassCard";
import PageHeaderIcon from "../../shared/ui/PageHeaderIcon";
import Eyebrow from "../../shared/ui/Eyebrow";
import { SkeletonKpiCard } from "../../shared/ui/SkeletonCard";

const MotionBox  = motion.create(Box);
const MotionGrid = motion.create(Grid);
const fadeUp     = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0, transition: { duration: 0.3 } } };
const stagger    = { animate: { transition: { staggerChildren: 0.07 } } };

function ForecastChart({ data, metric }) {
  const { colorMode } = useColorMode();
  const isDark = colorMode === "dark";
  const tipBg  = isDark ? "#0d1526" : "#ffffff";
  const tipBd  = isDark ? "#1e2d4a" : "#E0E7FF";
  const tipFg  = isDark ? "#fff"    : "#0D0D0D";
  const tipMt  = isDark ? "rgba(255,255,255,0.55)" : "#64748b";
  const gridCol = isDark ? "rgba(255,255,255,0.05)" : "rgba(31,63,254,0.06)";

  if (!data?.points?.length) {
    return (
      <GlassCard h="240px" display="flex" alignItems="center" justifyContent="center">
        <Text color="text.muted" fontSize="sm">No forecast data</Text>
      </GlassCard>
    );
  }

  const pts     = data.points;
  const xData   = pts.map((p) => p.hour_label.slice(11));
  const lower   = pts.map((p) => +(p.lower ?? 0));
  const bandDelta = pts.map((p, i) => Math.max(0, (p.upper ?? 0) - lower[i]));
  const pred    = pts.map((p) => p.predicted ?? null);
  const isEff   = metric === "kw_per_tr";

  const option = {
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
      formatter(params) {
        const time = params[0]?.axisValue;
        let html = `<div style="font-weight:600;color:${tipMt};margin-bottom:4px">${time}</div>`;
        for (const p of params) {
          if (["Lower CI", "CI Band"].includes(p.seriesName) || p.value == null) continue;
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
            type: "linear", x: 0, y: 0, x2: 0, y2: 1,
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
        ...(isEff ? {
          markLine: {
            silent: true,
            symbol: "none",
            label: { show: false },
            data: [
              { yAxis: 0.65, lineStyle: { color: "#10b981", type: "dashed", opacity: 0.45, width: 1.5 } },
              { yAxis: 0.85, lineStyle: { color: "#ef4444", type: "dashed", opacity: 0.45, width: 1.5 } },
            ],
          },
        } : {}),
      },
    ],
  };

  return (
    <GlassCard p={0} overflow="hidden">
      <Flex px={5} pt={4} pb={3} align="center" justify="space-between" flexWrap="wrap" gap={2}>
        <Text fontWeight={700} fontSize="sm" color="text.primary">
          {data.name} — {metric.replace(/_/g, " ")} forecast (next {data.horizon_hours}h)
        </Text>
        <Flex gap={2}>
          <Badge fontSize="9px" bg="rgba(124,58,237,0.12)" color="#a78bfa" border="1px solid rgba(124,58,237,0.25)" borderRadius="6px" px={2}>
            Statistical · hour-of-day profile
          </Badge>
          <Badge fontSize="9px" bg="bg.elevated" color="text.muted" border="1px solid" borderColor="border.subtle" borderRadius="6px" px={2}>
            {data.points.length} points
          </Badge>
        </Flex>
      </Flex>
      <ReactECharts
        option={option}
        style={{ height: "220px", width: "100%" }}
        opts={{ renderer: "canvas" }}
      />
      <Box px={5} pb={3}>
        <Text fontSize="10px" color="text.muted">{data.note}</Text>
      </Box>
    </GlassCard>
  );
}

export default function ForecastPage() {
  const [equipment, setEquipment] = useState([]);
  const [selectedEq, setSelectedEq] = useState("chiller_1");
  const [metric, setMetric]   = useState("kw_per_tr");
  const [horizon, setHorizon] = useState(24);
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/equipment").then(r => r.json()).then(setEquipment).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedEq) return;
    setLoading(true);
    fetch(`/api/v1/forecast/${selectedEq}?metric=${metric}&horizon=${horizon}&history_days=7`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [selectedEq, metric, horizon]);

  const eqObj = equipment.find(e => e.id === selectedEq);
  const METRICS_BY_TYPE = {
    chiller: [
      "kw_per_tr", "kw", "tr", "chiller_load",
      "evap_entering_temp", "evap_leaving_temp", "chw_delta_t",
      "cond_entering_temp", "cond_leaving_temp", "ambient_temp",
      "kwh", "trh",
    ],
    cooling_tower: ["kw", "kwh", "cumulative_kwh", "run_hours"],
    pump:          ["kw", "kwh", "cumulative_kwh", "run_hours"],
  };
  const availMetrics = METRICS_BY_TYPE[eqObj?.type || "chiller"] || ["kw"];

  const HORIZON_OPTIONS = [
    { v: 1,   label: "Next 1h" },
    { v: 3,   label: "Next 3h" },
    { v: 6,   label: "Next 6h" },
    { v: 12,  label: "Next 12h" },
    { v: 24,  label: "Next 24h" },
    { v: 36,  label: "Next 36h" },
    { v: 48,  label: "Next 48h" },
    { v: 72,  label: "Next 72h" },
    { v: 96,  label: "Next 96h" },
    { v: 120, label: "Next 5d" },
    { v: 168, label: "Next 7d" },
  ];

  const pts     = data?.points || [];
  const avgPred = pts.length ? pts.reduce((s, p) => s + p.predicted, 0) / pts.length : null;
  const minPred = pts.length ? Math.min(...pts.map(p => p.predicted)) : null;
  const maxPred = pts.length ? Math.max(...pts.map(p => p.predicted)) : null;
  const highConf = pts.filter(p => p.confidence === "high").length;

  return (
    <PageShell>
      <PageHeader
        title="Energy Forecaster"
        icon={<PageHeaderIcon icon={<TrendingUp size={20} strokeWidth={1.85} />} />}
        subtitle="Hour-of-day mean ± 1σ over 7d history · foundation model swap-in planned (Phase 8)"
        actions={
          <Flex gap={3} flexWrap="wrap">
            <Select
              size="sm" value={selectedEq}
              onChange={(e) => { setSelectedEq(e.target.value); setMetric("kw_per_tr"); }}
              aria-label="Equipment" {...surfaceSelectProps} w="160px"
            >
              {equipment.filter(e => e.type === "chiller").map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              {equipment.filter(e => e.type !== "chiller").map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </Select>
            <Select size="sm" value={metric} onChange={(e) => setMetric(e.target.value)} aria-label="Metric" {...surfaceSelectProps} w="120px">
              {availMetrics.map(m => <option key={m} value={m}>{m.replace(/_/g, " ")}</option>)}
            </Select>
            <Select size="sm" value={horizon} onChange={(e) => setHorizon(Number(e.target.value))} aria-label="Forecast horizon" {...surfaceSelectProps} w="140px">
              {HORIZON_OPTIONS.map(h => <option key={h.v} value={h.v}>{h.label}</option>)}
            </Select>
          </Flex>
        }
      />

      {data && !loading && (
        <MotionGrid
          variants={stagger} initial="initial" animate="animate"
          templateColumns={{ base: "minmax(0,1fr)", sm: "repeat(2,minmax(0,1fr))", lg: "repeat(4,minmax(0,1fr))" }}
          gap={4} mb={6} w="100%" minW={0}
        >
          {[
            { l: "Avg Predicted", v: avgPred?.toFixed(3), u: metric === "kw_per_tr" ? "kW/TR" : metric === "kw" ? "kW" : "%" },
            { l: "Min Predicted", v: minPred?.toFixed(3) },
            { l: "Max Predicted", v: maxPred?.toFixed(3) },
            { l: "High Confidence", v: `${highConf}/${pts.length}`, u: "hrs" },
          ].map((s, i) => (
            <MotionBox key={i} variants={fadeUp}>
              <GlassCard p={4}>
                <Eyebrow mb={2}>{s.l}</Eyebrow>
                <Flex align="baseline" gap={1}>
                  <Text fontSize="xl" fontWeight={700} color="accent.cyan" sx={{ fontVariantNumeric: "tabular-nums" }}>{s.v ?? "—"}</Text>
                  {s.u && <Text fontSize="xs" color="text.muted">{s.u}</Text>}
                </Flex>
              </GlassCard>
            </MotionBox>
          ))}
        </MotionGrid>
      )}

      {loading
        ? <SkeletonKpiCard />
        : (
          <MotionBox initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <ForecastChart data={data} metric={metric} />
          </MotionBox>
        )
      }

      {!loading && (
        <GlassCard mt={4} p={4}>
          <Eyebrow mb={3}>How this works</Eyebrow>
          <Flex gap={6} flexWrap="wrap">
            <Text fontSize="xs" color="text.muted">
              <Text as="span" color="text.primary" fontWeight={600}>Purple line</Text> — predicted value (mean of that hour-of-day over 7-day history)
            </Text>
            <Text fontSize="xs" color="text.muted">
              <Text as="span" color="text.primary" fontWeight={600}>Shaded band</Text> — ±1 std deviation (68% confidence interval)
            </Text>
            {metric === "kw_per_tr" && (
              <Text fontSize="xs" color="text.muted">
                <Text as="span" color="green.400" fontWeight={600}>Green</Text> = 0.65 (good),{" "}
                <Text as="span" color="red.400" fontWeight={600}>Red</Text> = 0.85 (poor)
              </Text>
            )}
          </Flex>
        </GlassCard>
      )}
    </PageShell>
  );
}
