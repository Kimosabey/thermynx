import {
  ResponsiveContainer, ComposedChart, Area, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from "recharts";
import { Box, Text, Flex, Badge } from "@chakra-ui/react";
import { motion } from "framer-motion";
import GlassCard from "../../shared/ui/GlassCard";

const MotionBox = motion.create(Box);
const BAND_GOOD = 0.65;
const BAND_POOR = 0.85;

function bandColor(v) {
  if (v == null) return "#64748b";
  return v < BAND_GOOD ? "#10b981" : v < BAND_POOR ? "#f59e0b" : "#ef4444";
}

function fmt(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <Box bg="white" border="1px solid #E0E7FF" borderRadius="10px" px={3} py={2}
      boxShadow="0 4px 20px rgba(31,63,254,0.1)" fontSize="xs">
      <Text fontWeight={600} color="#64748B" mb={1}>{fmt(label)}</Text>
      {payload.map((p) => (
        <Flex key={p.name} gap={2} align="center">
          <Box w={2} h={2} borderRadius="full" bg={p.color ?? p.fill} />
          <Text color="#64748B">{p.name}:</Text>
          <Text fontWeight={700} color={p.name === "kW/TR" ? bandColor(p.value) : "#0D0D0D"}>
            {p.value != null ? Number(p.value).toFixed(3) : "—"}
          </Text>
        </Flex>
      ))}
    </Box>
  );
}

export default function TimeseriesChart({ data, equipmentName, loading }) {
  if (loading) {
    return (
      <GlassCard h="220px" display="flex" alignItems="center" justifyContent="center">
        <Text color="text.muted" fontSize="sm">Loading chart…</Text>
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
  const chartData = data.points.filter((_, i) => i % step === 0);
  const pts = data.points.filter((p) => p.kw_per_tr != null);
  const avg = pts.length ? pts.reduce((s, p) => s + p.kw_per_tr, 0) / pts.length : null;

  return (
    <MotionBox initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <GlassCard p={0} overflow="hidden">
        <Flex px={5} pt={4} pb={3} align="center" justify="space-between" flexWrap="wrap" gap={2}>
          <Text fontWeight={700} fontSize="sm" color="text.primary">{equipmentName}</Text>
          <Flex gap={2} flexWrap="wrap">
            {avg != null && (
              <Badge fontSize="10px" borderRadius="6px" px={2} py="2px"
                bg={avg < BAND_GOOD ? "rgba(16,185,129,0.12)" : avg < BAND_POOR ? "rgba(245,158,11,0.12)" : "rgba(239,68,68,0.12)"}
                color={bandColor(avg)} border="1px solid"
                borderColor={avg < BAND_GOOD ? "rgba(16,185,129,0.25)" : avg < BAND_POOR ? "rgba(245,158,11,0.25)" : "rgba(239,68,68,0.25)"}>
                Avg kW/TR: {avg.toFixed(3)}
              </Badge>
            )}
            <Badge fontSize="10px" borderRadius="6px" px={2} bg="rgba(255,255,255,0.05)" color="text.muted" border="1px solid" borderColor="border.subtle">
              {data.resolution} · {data.hours}h · {data.count} pts
            </Badge>
          </Flex>
        </Flex>

        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <defs>
              <linearGradient id="kwTrGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#1F3FFE" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#1F3FFE" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(31,63,254,0.06)" />
            <XAxis dataKey="slot_time" tickFormatter={fmt} tick={{ fontSize: 10, fill: "#334155" }}
              axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis yAxisId="kw" orientation="right" tick={{ fontSize: 10, fill: "#334155" }}
              axisLine={false} tickLine={false} width={38} />
            {isChiller && (
              <YAxis yAxisId="eff" orientation="left" domain={[0.3, 1.1]}
                tick={{ fontSize: 10, fill: "#334155" }} axisLine={false} tickLine={false} width={36} />
            )}
            <Tooltip content={<CustomTooltip />} />
            {isChiller && (
              <>
                <ReferenceLine yAxisId="eff" y={BAND_GOOD} stroke="#10b981" strokeDasharray="5 3" strokeOpacity={0.35} />
                <ReferenceLine yAxisId="eff" y={BAND_POOR} stroke="#ef4444" strokeDasharray="5 3" strokeOpacity={0.35} />
                <Area yAxisId="eff" type="monotoneX" dataKey="kw_per_tr" name="kW/TR"
                  stroke="#1F3FFE" strokeWidth={2} fill="url(#kwTrGrad)"
                  dot={false} isAnimationActive animationDuration={800} />
              </>
            )}
            <Bar yAxisId="kw" dataKey="kw" name="kW" fill="rgba(255,255,255,0.07)"
              maxBarSize={5} radius={[2, 2, 0, 0]} />
          </ComposedChart>
        </ResponsiveContainer>
      </GlassCard>
    </MotionBox>
  );
}
