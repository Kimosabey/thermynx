import { useState, useEffect } from "react";
import { Box, Flex, Text, Select, Grid, Badge } from "@chakra-ui/react";
import { TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import PageShell from "../../shared/ui/PageShell";
import PageHeader from "../../shared/ui/PageHeader";
import { surfaceSelectProps } from "../../shared/ui/PeriodSelect";
import {
  ResponsiveContainer, ComposedChart, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from "recharts";
import GlassCard from "../../shared/ui/GlassCard";
import PageHeaderIcon from "../../shared/ui/PageHeaderIcon";
import Eyebrow from "../../shared/ui/Eyebrow";
import { SkeletonKpiCard } from "../../shared/ui/SkeletonCard";

const MotionBox  = motion.create(Box);
const MotionGrid = motion.create(Grid);
const fadeUp     = { initial:{opacity:0,y:12}, animate:{opacity:1,y:0,transition:{duration:0.3}} };
const stagger    = { animate:{transition:{staggerChildren:0.07}} };

const CONFIDENCE_COLOR = { high:"#10b981", medium:"#f59e0b", low:"#ef4444" };

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <Box bg="#0d1526" border="1px solid #1e2d4a" borderRadius="10px" px={3} py={2} fontSize="xs" boxShadow="0 8px 32px rgba(0,0,0,0.5)">
      <Text fontWeight={600} color="whiteAlpha.500" mb={1}>{label}</Text>
      {payload.map((p) => (
        <Flex key={p.name} gap={2} align="center">
          <Box w={2} h={2} borderRadius="full" bg={p.color ?? p.fill} />
          <Text color="whiteAlpha.600">{p.name}:</Text>
          <Text fontWeight={700} color="white">{p.value?.toFixed(3)}</Text>
        </Flex>
      ))}
    </Box>
  );
}

function ForecastChart({ data, metric }) {
  if (!data?.points?.length) return (
    <GlassCard h="240px" display="flex" alignItems="center" justifyContent="center">
      <Text color="text.muted" fontSize="sm">No forecast data</Text>
    </GlassCard>
  );
  const chartData = data.points.map((p) => ({ ...p, name: p.hour_label.slice(11) }));
  const isEff = metric === "kw_per_tr";
  return (
    <GlassCard p={0} overflow="hidden">
      <Flex px={5} pt={4} pb={3} align="center" justify="space-between" flexWrap="wrap" gap={2}>
        <Text fontWeight={700} fontSize="sm" color="text.primary">{data.name} — {metric.replace(/_/g," ")} forecast (next {data.horizon_hours}h)</Text>
        <Flex gap={2}>
          <Badge fontSize="9px" bg="rgba(124,58,237,0.12)" color="#a78bfa" border="1px solid rgba(124,58,237,0.25)" borderRadius="6px" px={2}>
            Statistical · hour-of-day profile
          </Badge>
          <Badge fontSize="9px" bg="bg.elevated" color="text.muted" border="1px solid" borderColor="border.subtle" borderRadius="6px" px={2}>
            {data.points.length} points
          </Badge>
        </Flex>
      </Flex>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={chartData} margin={{top:4,right:16,left:0,bottom:4}}>
          <defs>
            <linearGradient id="ciGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#7c3aed" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="name" tick={{fontSize:10,fill:"#334155"}} axisLine={false} tickLine={false} interval={3} />
          <YAxis tick={{fontSize:10,fill:"#334155"}} axisLine={false} tickLine={false} width={40} domain={["auto","auto"]} />
          <Tooltip content={<CustomTooltip />} />
          {isEff && <ReferenceLine y={0.65} stroke="#10b981" strokeDasharray="4 3" strokeOpacity={0.4} />}
          {isEff && <ReferenceLine y={0.85} stroke="#ef4444" strokeDasharray="4 3" strokeOpacity={0.4} />}
          <Area type="monotone" dataKey="upper" stroke="transparent" fill="url(#ciGrad)" name="Upper CI" />
          <Area type="monotone" dataKey="lower" stroke="transparent" fill="#060d1f" name="Lower CI" />
          <Line type="monotone" dataKey="predicted" stroke="#7c3aed" strokeWidth={2.5} dot={false} name="Predicted" isAnimationActive animationDuration={800} />
        </ComposedChart>
      </ResponsiveContainer>
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
    fetch("/api/v1/equipment").then(r=>r.json()).then(setEquipment).catch(()=>{});
  }, []);

  useEffect(() => {
    if (!selectedEq) return;
    setLoading(true);
    fetch(`/api/v1/forecast/${selectedEq}?metric=${metric}&horizon=${horizon}&history_days=7`)
      .then(r=>r.json())
      .then(d=>{ setData(d); setLoading(false); })
      .catch(()=>setLoading(false));
  }, [selectedEq, metric, horizon]);

  const eqObj = equipment.find(e=>e.id===selectedEq);
  const METRICS_BY_TYPE = { chiller:["kw_per_tr","kw","chiller_load"], cooling_tower:["kw"], pump:["kw"] };
  const availMetrics = METRICS_BY_TYPE[eqObj?.type || "chiller"] || ["kw"];

  // Summary stats from forecast
  const pts      = data?.points || [];
  const avgPred  = pts.length ? pts.reduce((s,p)=>s+p.predicted,0)/pts.length : null;
  const minPred  = pts.length ? Math.min(...pts.map(p=>p.predicted)) : null;
  const maxPred  = pts.length ? Math.max(...pts.map(p=>p.predicted)) : null;
  const highConf = pts.filter(p=>p.confidence==="high").length;

  return (
    <PageShell>
      <PageHeader
        title="Energy Forecaster"
        icon={<PageHeaderIcon icon={<TrendingUp size={20} strokeWidth={1.85} />} />}
        subtitle={`Hour-of-day statistical profile · next ${horizon}h prediction with confidence interval`}
        actions={
          <Flex gap={3} flexWrap="wrap">
            <Select
              size="sm"
              value={selectedEq}
              onChange={(e) => { setSelectedEq(e.target.value); setMetric("kw_per_tr"); }}
              {...surfaceSelectProps}
              w="160px"
            >
              {equipment.filter((e) => e.type === "chiller").map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              {equipment.filter((e) => e.type !== "chiller").map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </Select>
            <Select size="sm" value={metric} onChange={(e) => setMetric(e.target.value)} {...surfaceSelectProps} w="120px">
              {availMetrics.map((m) => <option key={m} value={m}>{m.replace(/_/g, " ")}</option>)}
            </Select>
            <Select size="sm" value={horizon} onChange={(e) => setHorizon(Number(e.target.value))} {...surfaceSelectProps} w="120px">
              <option value={12}>Next 12h</option>
              <option value={24}>Next 24h</option>
              <option value={48}>Next 48h</option>
              <option value={72}>Next 72h</option>
            </Select>
          </Flex>
        }
      />

      {/* Summary KPI chips */}
      {data && !loading && (
        <MotionGrid
          variants={stagger}
          initial="initial"
          animate="animate"
          templateColumns={{
            base: "minmax(0, 1fr)",
            sm: "repeat(2, minmax(0, 1fr))",
            lg: "repeat(4, minmax(0, 1fr))",
          }}
          gap={4}
          mb={6}
          w="100%"
          minW={0}
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
        : <MotionBox initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:0.3}}>
            <ForecastChart data={data} metric={metric} />
          </MotionBox>
      }

      {/* Legend */}
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
                <Text as="span" color="green.400" fontWeight={600}>Green line</Text> = 0.65 (good), <Text as="span" color="red.400" fontWeight={600}>Red</Text> = 0.85 (poor)
              </Text>
            )}
          </Flex>
        </GlassCard>
      )}
    </PageShell>
  );
}
