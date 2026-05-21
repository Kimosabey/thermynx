import { useState, useEffect, useMemo } from "react";
import { Box, Flex, Text, Select, Grid, useColorMode } from "@chakra-ui/react";
import { Trophy, Columns2 } from "lucide-react";
import { motion } from "framer-motion";
import ReactECharts from "echarts-for-react";
import PageShell from "../../shared/ui/PageShell";
import PageHeader from "../../shared/ui/PageHeader";
import { surfaceSelectProps } from "../../shared/ui/PeriodSelect";
import GlassCard from "../../shared/ui/GlassCard";
import PageHeaderIcon from "../../shared/ui/PageHeaderIcon";
import Eyebrow from "../../shared/ui/Eyebrow";
import StatusPulse from "../../shared/ui/StatusPulse";
import { SkeletonEquipCard } from "../../shared/ui/SkeletonCard";

const MotionBox = motion.create(Box);
const fadeUp    = { initial:{opacity:0,y:12}, animate:{opacity:1,y:0,transition:{duration:0.28}} };

const COLORS = { a:"#00c4f4", b:"#7c3aed" };
const BAND_GOOD = 0.65, BAND_POOR = 0.85;

function bandColor(v) {
  if (v==null) return "#64748b";
  return v < BAND_GOOD ? "#10b981" : v < BAND_POOR ? "#f59e0b" : "#ef4444";
}

function StatRow({ label, valA, valB, isEff }) {
  const a = valA != null ? Number(valA).toFixed(3) : "—";
  const b = valB != null ? Number(valB).toFixed(3) : "—";
  const better = valA != null && valB != null
    ? (isEff ? (valA < valB ? "a" : "b") : (valA > valB ? "a" : "b"))
    : null;
  return (
    <Grid templateColumns={{ base: "minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)" }} gap={2} py={2} borderBottom="1px solid" borderColor="border.subtle" minW={0}>
      <Text fontSize="xs" color="text.muted" textTransform="uppercase" letterSpacing="0.08em" fontWeight={700}>{label}</Text>
      <Text fontSize="sm" fontWeight={700} color={better==="a" ? "green.400" : (isEff ? bandColor(valA) : "text.primary")} sx={{ fontVariantNumeric: "tabular-nums" }} textAlign="center">{a}</Text>
      <Text fontSize="sm" fontWeight={700} color={better==="b" ? "green.400" : (isEff ? bandColor(valB) : "text.primary")} sx={{ fontVariantNumeric: "tabular-nums" }} textAlign="center">{b}</Text>
    </Grid>
  );
}

export default function ComparePage() {
  const { colorMode } = useColorMode();
  const isDark = colorMode === "dark";
  const tipBg  = isDark ? "#0d1526" : "#ffffff";
  const tipBd  = isDark ? "#1e2d4a" : "#E0E7FF";
  const tipFg  = isDark ? "#fff"    : "#0D0D0D";
  const tipMt  = isDark ? "rgba(255,255,255,0.55)" : "#64748b";
  const gridCol = isDark ? "rgba(255,255,255,0.05)" : "rgba(31,63,254,0.06)";

  const [equipment, setEquipment] = useState([]);
  const [eqA, setEqA]         = useState("chiller_1");
  const [eqB, setEqB]         = useState("chiller_2");
  const [hours, setHours]     = useState(24);
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/v1/equipment").then(r=>r.json()).then(eq=>{
      setEquipment(eq);
    }).catch(()=>{});
  }, []);

  function load() {
    if (!eqA || !eqB || eqA===eqB) return;
    setLoading(true);
    fetch(`/api/v1/compare?a=${eqA}&b=${eqB}&hours=${hours}`)
      .then(r=>r.json())
      .then(d=>{ setData(d); setLoading(false); })
      .catch(()=>setLoading(false));
  }

  useEffect(() => { load(); }, [eqA, eqB, hours]);

  const chartData = useMemo(() => {
    if (!data) return [];
    const map = {};
    (data.a.timeseries || []).forEach(p => {
      if (!map[p.slot_time]) map[p.slot_time] = { slot_time: p.slot_time };
      map[p.slot_time][`${data.a.name}_kW/TR`] = p.kw_per_tr;
    });
    (data.b.timeseries || []).forEach(p => {
      if (!map[p.slot_time]) map[p.slot_time] = { slot_time: p.slot_time };
      map[p.slot_time][`${data.b.name}_kW/TR`] = p.kw_per_tr;
    });
    return Object.values(map).sort((x, y) => x.slot_time.localeCompare(y.slot_time));
  }, [data]);

  const compareOption = useMemo(() => {
    if (!data || !chartData.length) return null;
    const xData   = chartData.map(p => p.slot_time);
    const seriesA = chartData.map(p => p[`${data.a.name}_kW/TR`] ?? null);
    const seriesB = chartData.map(p => p[`${data.b.name}_kW/TR`] ?? null);
    return {
      animation: true,
      animationDuration: 600,
      grid: { top: 8, right: 16, bottom: 28, left: 40 },
      xAxis: {
        type: "category", data: xData,
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { fontSize: 10, color: "#334155", formatter: v => String(v).slice(11, 16), hideOverlap: true, showMinLabel: true, showMaxLabel: true },
        splitLine: { show: false }, boundaryGap: false,
      },
      yAxis: {
        type: "value", min: 0.3, max: 1.2,
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { fontSize: 10, color: "#334155" },
        splitLine: { lineStyle: { color: gridCol, type: "dashed" } },
      },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "line", lineStyle: { color: "#94a3b8", opacity: 0.3 } },
        backgroundColor: tipBg, borderColor: tipBd, borderRadius: 10,
        padding: [8, 12], textStyle: { fontSize: 11, color: tipFg },
        formatter(params) {
          const time = String(params[0]?.axisValue).slice(11, 16);
          let html = `<div style="font-weight:600;color:${tipMt};margin-bottom:4px">${time}</div>`;
          for (const p of params) {
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
          name: data.a.name, type: "line", data: seriesA,
          symbol: "none", lineStyle: { color: COLORS.a, width: 2 },
          markLine: {
            silent: true, symbol: "none", label: { show: false },
            data: [
              { yAxis: BAND_GOOD, lineStyle: { color: "#10b981", type: "dashed", opacity: 0.4, width: 1.5 } },
              { yAxis: BAND_POOR, lineStyle: { color: "#ef4444", type: "dashed", opacity: 0.4, width: 1.5 } },
            ],
          },
        },
        {
          name: data.b.name, type: "line", data: seriesB,
          symbol: "none", lineStyle: { color: COLORS.b, width: 2 },
        },
      ],
    };
  }, [data, chartData, isDark, tipBg, tipBd, tipFg, tipMt, gridCol]);

  const sa = data?.a?.summary || {};
  const sb = data?.b?.summary || {};
  const ea = data?.a?.efficiency;
  const eb = data?.b?.efficiency;
  const better = ea && eb
    ? (ea.kw_per_tr_avg < eb.kw_per_tr_avg ? data.a.name : data.b.name)
    : null;

  return (
    <PageShell>
      <PageHeader
        title="Comparison View"
        subtitle="Side-by-side equipment analysis — overlay chart + delta statistics"
        icon={<PageHeaderIcon icon={<Columns2 size={20} strokeWidth={1.85} />} />}
        actions={
          <Flex gap={{ base: 2, sm: 3 }} flexWrap="wrap" align="center" w={{ base: "100%", xl: "auto" }} maxW="100%">
            <Select size="sm" value={eqA} onChange={(e) => setEqA(e.target.value)}
              aria-label="Equipment A"
              {...surfaceSelectProps}
              borderColor={`${COLORS.a}50`}
              color={COLORS.a}
              fontWeight={600}
              w={{ base: "100%", sm: "155px" }}
              maxW="100%"
            >
              {equipment.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </Select>
            <Text color="text.muted" fontSize="sm" fontWeight={700} aria-hidden="true">vs</Text>
            <Select size="sm" value={eqB} onChange={(e) => setEqB(e.target.value)}
              aria-label="Equipment B"
              {...surfaceSelectProps}
              borderColor={`${COLORS.b}50`}
              color={COLORS.b}
              fontWeight={600}
              w={{ base: "100%", sm: "155px" }}
              maxW="100%"
            >
              {equipment.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </Select>
            <Select size="sm" value={hours} onChange={(e) => setHours(Number(e.target.value))} aria-label="Time window" {...surfaceSelectProps} w="120px">
              <option value={6}>6 hours</option>
              <option value={12}>12 hours</option>
              <option value={24}>24 hours</option>
              <option value={48}>48 hours</option>
              <option value={168}>7 days</option>
            </Select>
          </Flex>
        }
      />

      {better && (
        <MotionBox variants={fadeUp} initial="initial" animate="animate" mb={5}>
          <GlassCard p={4} glow>
            <Flex align="center" gap={{ base: 2, sm: 3 }}>
              <Box color="status.good"><Trophy size={18} strokeWidth={2} /></Box>
              <Text fontSize="sm" color="text.primary">
                <Text as="span" fontWeight={700} color="green.400">{better}</Text>
                {" "}is performing better (kW/TR: {ea.kw_per_tr_avg?.toFixed(3)} vs {eb.kw_per_tr_avg?.toFixed(3)} — delta {Math.abs((ea.kw_per_tr_avg||0)-(eb.kw_per_tr_avg||0)).toFixed(3)} kW/TR)
              </Text>
            </Flex>
          </GlassCard>
        </MotionBox>
      )}

      {/* Overlay chart */}
      {loading ? <SkeletonEquipCard /> : compareOption && (
        <MotionBox variants={fadeUp} initial="initial" animate="animate" mb={5}>
          <GlassCard p={0} overflow="hidden">
            <Flex px={5} pt={4} pb={3} align="center" gap={3} flexWrap="wrap">
              <Text fontWeight={700} fontSize="sm" color="text.primary">kW/TR — {hours}h overlay</Text>
              <Flex gap={3} ml="auto">
                {[{name:data?.a?.name,c:COLORS.a},{name:data?.b?.name,c:COLORS.b}].map(({name,c})=>(
                  <Flex key={name} align="center" gap={2}>
                    <Box w={3} h="2px" bg={c} borderRadius="full" />
                    <Text fontSize="xs" color="text.muted">{name}</Text>
                  </Flex>
                ))}
              </Flex>
            </Flex>
            <ReactECharts
              option={compareOption}
              style={{ height: "220px", width: "100%" }}
              opts={{ renderer: "canvas" }}
            />
          </GlassCard>
        </MotionBox>
      )}

      {/* Side-by-side stats */}
      {data && !loading && (
        <MotionBox variants={fadeUp} initial="initial" animate="animate">
          <GlassCard>
            <Box overflowX="auto" maxW="100%" w="100%">
              <Box minW={{ base: "520px", md: "auto" }}>
            {/* Header row */}
            <Grid templateColumns="minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)" gap={2} pb={3} mb={1} borderBottom="1px solid" borderColor="border.subtle">
              <Eyebrow>Metric</Eyebrow>
              <Flex align="center" gap={2} justifyContent="center">
                <Box w={2} h={2} borderRadius="full" bg={COLORS.a} />
                <Text fontSize="xs" fontWeight={700} color={COLORS.a}>{data.a.name}</Text>
                <StatusPulse active={(sa.running_pct||0)>0} size="7px" />
              </Flex>
              <Flex align="center" gap={2} justifyContent="center">
                <Box w={2} h={2} borderRadius="full" bg={COLORS.b} />
                <Text fontSize="xs" fontWeight={700} color={COLORS.b}>{data.b.name}</Text>
                <StatusPulse active={(sb.running_pct||0)>0} size="7px" />
              </Flex>
            </Grid>
            <StatRow label="kW/TR avg"    valA={sa.avg_kw_per_tr}    valB={sb.avg_kw_per_tr}    isEff={true} />
            <StatRow label="kW avg"       valA={sa.avg_kw}           valB={sb.avg_kw}           isEff={false} />
            <StatRow label="TR avg"       valA={sa.avg_tr}           valB={sb.avg_tr}            isEff={false} />
            <StatRow label="Load %"       valA={sa.avg_chiller_load} valB={sb.avg_chiller_load}  isEff={false} />
            <StatRow label="CHW ΔT"       valA={sa.avg_chw_delta_t}  valB={sb.avg_chw_delta_t}   isEff={false} />
            <StatRow label="Run %"        valA={sa.running_pct}      valB={sb.running_pct}       isEff={false} />
            {ea && eb && (
              <>
                <StatRow label="Eff band"   valA={ea.band}           valB={eb.band}             isEff={false} />
                <StatRow label="Δ vs design" valA={ea.delta_pct}     valB={eb.delta_pct}        isEff={true} />
              </>
            )}
              </Box>
            </Box>
          </GlassCard>
        </MotionBox>
      )}
    </PageShell>
  );
}
