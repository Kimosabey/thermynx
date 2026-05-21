import ReactECharts from "echarts-for-react";
import { Box, Text, Flex, Badge, VisuallyHidden } from "@chakra-ui/react";
import { motion, useReducedMotion } from "framer-motion";
import GlassCard from "../../shared/ui/GlassCard";

const MotionBox = motion.create(Box);
const BAND_GOOD = 0.65;
const BAND_POOR = 0.85;

function bandColor(v) {
  if (v == null) return "#64748b";
  return v < BAND_GOOD ? "#10b981" : v < BAND_POOR ? "#f59e0b" : "#ef4444";
}

function fmtTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export default function TimeseriesChart({ data, equipmentName, loading }) {
  const reduced = useReducedMotion();

  if (loading) {
    return (
      <GlassCard h="220px" display="flex" alignItems="center" justifyContent="center">
        <Text color="text.muted" fontSize="sm" role="status">Loading chart…</Text>
      </GlassCard>
    );
  }
  if (!data?.points?.length) {
    return (
      <GlassCard h="220px" display="flex" alignItems="center" justifyContent="center">
        <Text color="text.muted" fontSize="sm">Select equipment to view chart</Text>
      </GlassCard>
    );
  }

  const isChiller = data.type === "chiller";
  const step = Math.max(1, Math.floor(data.points.length / 200));
  const pts = data.points.filter((_, i) => i % step === 0);

  const effPts = data.points.filter((p) => p.kw_per_tr != null);
  const avg    = effPts.length ? effPts.reduce((s, p) => s + p.kw_per_tr, 0) / effPts.length : null;
  const kwPts  = data.points.filter((p) => p.kw != null);
  const minKw  = kwPts.length ? Math.min(...kwPts.map((p) => p.kw)) : null;
  const maxKw  = kwPts.length ? Math.max(...kwPts.map((p) => p.kw)) : null;

  const a11y = [
    `${equipmentName ?? "Equipment"} timeseries over ${data.hours} hours, ${data.count} data points at ${data.resolution} resolution.`,
    isChiller && avg != null ? `Average kW/TR: ${avg.toFixed(3)}.` : null,
    minKw != null && maxKw != null ? `kW range: ${minKw.toFixed(0)} to ${maxKw.toFixed(0)}.` : null,
  ].filter(Boolean).join(" ");

  const xData    = pts.map((p) => p.slot_time);
  const kwTrData = pts.map((p) => p.kw_per_tr ?? null);
  const kwData   = pts.map((p) => p.kw ?? null);

  const option = {
    animation: !reduced,
    animationDuration: 700,
    grid: { top: 8, right: 48, bottom: 28, left: isChiller ? 44 : 8 },
    xAxis: {
      type: "category",
      data: xData,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        fontSize: 10, color: "#334155",
        formatter: fmtTime,
        showMinLabel: true, showMaxLabel: true,
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
        min: 0.3, max: 1.1,
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
      formatter(params) {
        const time = fmtTime(params[0]?.axisValue);
        let html = `<div style="font-weight:600;color:#64748b;margin-bottom:4px">${time}</div>`;
        for (const p of params) {
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
            type: "linear", x: 0, y: 0, x2: 0, y2: 1,
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
    ].filter(Boolean),
  };

  return (
    <MotionBox
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <GlassCard p={0} overflow="hidden">
        <Flex px={5} pt={4} pb={3} align="center" justify="space-between" flexWrap="wrap" gap={2}>
          <Text as="h2" fontWeight={700} fontSize="sm" color="text.primary">{equipmentName}</Text>
          <Flex gap={2} flexWrap="wrap">
            {avg != null && (
              <Badge
                fontSize="10px" borderRadius="6px" px={2} py="2px"
                bg={avg < BAND_GOOD ? "rgba(16,185,129,0.12)" : avg < BAND_POOR ? "rgba(245,158,11,0.12)" : "rgba(239,68,68,0.12)"}
                color={bandColor(avg)}
                border="1px solid"
                borderColor={avg < BAND_GOOD ? "rgba(16,185,129,0.25)" : avg < BAND_POOR ? "rgba(245,158,11,0.25)" : "rgba(239,68,68,0.25)"}
              >
                Avg kW/TR: {avg.toFixed(3)}
              </Badge>
            )}
            <Badge fontSize="10px" borderRadius="6px" px={2} bg="bg.chip" color="text.muted" border="1px solid" borderColor="border.subtle">
              {data.resolution} · {data.hours}h · {data.count} pts
            </Badge>
          </Flex>
        </Flex>

        <Box as="figure" role="img" aria-label={a11y} m={0}>
          <VisuallyHidden as="figcaption">{a11y}</VisuallyHidden>
          <ReactECharts
            option={option}
            style={{ height: "200px", width: "100%" }}
            opts={{ renderer: "canvas" }}
          />
        </Box>
      </GlassCard>
    </MotionBox>
  );
}
