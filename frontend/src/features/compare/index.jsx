import { useState, useEffect } from "react";
import { Box, Flex, Text, Select, Grid } from "@chakra-ui/react";
import { Trophy, Columns2 } from "lucide-react";
import { motion } from "framer-motion";
import PageShell from "../../shared/ui/PageShell";
import PageHeader from "../../shared/ui/PageHeader";
import { surfaceSelectProps } from "../../shared/ui/PeriodSelect";
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from "recharts";
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

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <Box bg="#0d1526" border="1px solid #1e2d4a" borderRadius="10px" px={3} py={2} fontSize="xs" boxShadow="0 8px 32px rgba(0,0,0,0.5)">
      <Text fontWeight={600} color="whiteAlpha.500" mb={1}>{String(label).slice(11)}</Text>
      {payload.map((p) => (
        <Flex key={p.name} gap={2} align="center">
          <Box w={2} h={2} borderRadius="full" bg={p.color} />
          <Text color="whiteAlpha.600">{p.name}:</Text>
          <Text fontWeight={700} color={p.name.includes("kW/TR") ? bandColor(p.value) : "white"}>
            {p.value?.toFixed ? p.value.toFixed(3) : p.value}
          </Text>
        </Flex>
      ))}
    </Box>
  );
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

  // Merge timeseries for overlay chart
  const chartData = (() => {
    if (!data) return [];
    const map = {};
    (data.a.timeseries||[]).forEach(p => {
      const k = p.slot_time;
      if (!map[k]) map[k] = { slot_time:k };
      map[k][`${data.a.name}_kW/TR`] = p.kw_per_tr;
    });
    (data.b.timeseries||[]).forEach(p => {
      const k = p.slot_time;
      if (!map[k]) map[k] = { slot_time:k };
      map[k][`${data.b.name}_kW/TR`] = p.kw_per_tr;
    });
    return Object.values(map).sort((x,y)=>x.slot_time.localeCompare(y.slot_time));
  })();

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
          <Flex gap={3} flexWrap="wrap" align="center" w={{ base: "100%", xl: "auto" }} maxW="100%">
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
            <Flex align="center" gap={3}>
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
      {loading ? <SkeletonEquipCard /> : chartData.length > 0 && (
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
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{top:4,right:16,left:0,bottom:4}}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="slot_time" tickFormatter={v=>String(v).slice(11,16)}
                  tick={{fontSize:10,fill:"#334155"}} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis domain={[0.3,1.2]} tick={{fontSize:10,fill:"#334155"}} axisLine={false} tickLine={false} width={36} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={BAND_GOOD} stroke="#10b981" strokeDasharray="4 3" strokeOpacity={0.35} />
                <ReferenceLine y={BAND_POOR} stroke="#ef4444" strokeDasharray="4 3" strokeOpacity={0.35} />
                {data && <Line type="monotoneX" dataKey={`${data.a.name}_kW/TR`} stroke={COLORS.a} strokeWidth={2} dot={false} isAnimationActive animationDuration={600} />}
                {data && <Line type="monotoneX" dataKey={`${data.b.name}_kW/TR`} stroke={COLORS.b} strokeWidth={2} dot={false} isAnimationActive animationDuration={600} />}
              </LineChart>
            </ResponsiveContainer>
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
