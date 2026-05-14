import { useState, useEffect } from "react";
import { Box, Flex, Text, Grid, Badge } from "@chakra-ui/react";
import { Zap } from "lucide-react";
import { motion } from "framer-motion";
import PageShell from "../../shared/ui/PageShell";
import PageHeader from "../../shared/ui/PageHeader";
import PeriodSelect from "../../shared/ui/PeriodSelect";
import GlassCard from "../../shared/ui/GlassCard";
import PageHeaderIcon from "../../shared/ui/PageHeaderIcon";
import Eyebrow from "../../shared/ui/Eyebrow";
import StatusPulse from "../../shared/ui/StatusPulse";
import { SkeletonKpiCard } from "../../shared/ui/SkeletonCard";

const MotionBox  = motion.create(Box);
const MotionGrid = motion.create(Grid);
const stagger    = { animate: { transition: { staggerChildren: 0.08 } } };
const fadeUp     = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const BAND_META = {
  excellent: { color: "#10b981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.25)", label: "Excellent" },
  good:      { color: "#00c4f4", bg: "rgba(0,196,244,0.12)",  border: "rgba(0,196,244,0.25)",  label: "Good" },
  fair:      { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.25)", label: "Fair" },
  poor:      { color: "#f97316", bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.25)", label: "Poor" },
  critical:  { color: "#ef4444", bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.25)",  label: "Critical" },
  unknown:   { color: "#64748b", bg: "rgba(100,116,139,0.1)", border: "rgba(100,116,139,0.2)", label: "No data" },
};

function BandBar({ kw_per_tr }) {
  if (kw_per_tr == null) return null;
  const zones = [
    { max: 0.55, color: "#10b981", label: "Excellent" },
    { max: 0.65, color: "#00c4f4", label: "Good" },
    { max: 0.75, color: "#f59e0b", label: "Fair" },
    { max: 0.85, color: "#f97316", label: "Poor" },
    { max: 1.10, color: "#ef4444", label: "Critical" },
  ];
  const total = 1.10;
  const markerPct = Math.min((kw_per_tr / total) * 100, 100);

  return (
    <Box>
      <Flex borderRadius="full" overflow="hidden" h="6px" mb={2}>
        {zones.map((z, i) => (
          <Box key={i} flex={((z.max - (zones[i-1]?.max ?? 0)) / total)} bg={z.color} opacity={0.7} />
        ))}
      </Flex>
      <Box position="relative" h="12px">
        <MotionBox
          position="absolute"
          top={0}
          left={`${markerPct}%`}
          transform="translateX(-50%)"
          initial={{ left: "0%" }}
          animate={{ left: `${markerPct}%` }}
          transition={{ duration: 1, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <Box w="2px" h="12px" bg="white" borderRadius="full" boxShadow="0 0 4px rgba(255,255,255,0.5)" />
        </MotionBox>
      </Box>
      <Flex justify="space-between" mt={1}>
        <Text fontSize="9px" color="text.muted">0.55</Text>
        <Text fontSize="9px" color="text.muted">0.65</Text>
        <Text fontSize="9px" color="text.muted">0.75</Text>
        <Text fontSize="9px" color="text.muted">0.85</Text>
      </Flex>
    </Box>
  );
}

function EfficiencyCard({ result }) {
  const meta  = BAND_META[result.band] ?? BAND_META.unknown;
  const isOn  = result.running_pct != null && result.running_pct > 0;

  return (
    <MotionBox variants={fadeUp}>
      <GlassCard>
        {/* Header */}
        <Flex justify="space-between" align="center" mb={4}>
          <Flex align="center" gap={2}>
            <StatusPulse active={isOn} />
            <Text fontWeight={700} fontSize="sm" color="text.primary">{result.name}</Text>
          </Flex>
          <Badge
            fontSize="10px" px={3} py="3px" borderRadius="full"
            bg={meta.bg} color={meta.color} border="1px solid" borderColor={meta.border}
            fontWeight={700}
          >
            {meta.label}
          </Badge>
        </Flex>

        {/* Main metric */}
        <Flex align="baseline" gap={2} mb={4}>
          <Text
            fontSize="3xl"
            fontWeight={800}
            color={meta.color}
            sx={{ fontVariantNumeric: "tabular-nums" }}
            letterSpacing="-0.03em"
          >
            {result.kw_per_tr_avg != null ? result.kw_per_tr_avg.toFixed(3) : "—"}
          </Text>
          <Text fontSize="sm" color="text.muted">kW/TR</Text>
          {result.delta_pct != null && (
            <Badge
              ml="auto" fontSize="10px"
              bg={result.delta_pct <= 0 ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.1)"}
              color={result.delta_pct <= 0 ? "green.400" : "red.400"}
              border="1px solid"
              borderColor={result.delta_pct <= 0 ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.2)"}
              borderRadius="full" px={2}
            >
              {result.delta_pct > 0 ? "+" : ""}{result.delta_pct.toFixed(1)}% vs design
            </Badge>
          )}
        </Flex>

        {/* Band bar */}
        <Box mb={4}>
          <BandBar kw_per_tr={result.kw_per_tr_avg} />
        </Box>

        {/* Stats row */}
        <Grid templateColumns={{ base: "repeat(2, minmax(0, 1fr))", md: "repeat(3, minmax(0, 1fr))" }} gap={3} mb={4}>
          {[
            { label: "Best",    value: result.kw_per_tr_best?.toFixed(3),  unit: "kW/TR" },
            { label: "Worst",   value: result.kw_per_tr_worst?.toFixed(3), unit: "kW/TR" },
            { label: "Avg Load",value: result.avg_load != null ? `${result.avg_load.toFixed(1)}%` : "—", unit: "" },
            { label: "CHW ΔT",  value: result.avg_delta_t != null ? `${result.avg_delta_t.toFixed(2)}°C` : "—", unit: "" },
            { label: "Run %",   value: result.running_pct != null ? `${result.running_pct}%` : "—", unit: "" },
            { label: "Samples", value: result.record_count, unit: "" },
          ].map((s, i) => (
            <Box key={i}>
              <Eyebrow mb={1}>{s.label}</Eyebrow>
              <Text fontSize="sm" fontWeight={600} color="text.primary" sx={{ fontVariantNumeric: "tabular-nums" }}>
                {s.value ?? "—"}
              </Text>
            </Box>
          ))}
        </Grid>

        {/* Loss drivers */}
        {result.loss_drivers?.length > 0 && (
          <Box
            bg="rgba(239,68,68,0.06)" border="1px solid rgba(239,68,68,0.15)"
            borderRadius="10px" p={3}
          >
            <Eyebrow mb={2} color="red.400">Loss Drivers</Eyebrow>
            {result.loss_drivers.map((d, i) => (
              <Flex key={i} gap={2} mb={i < result.loss_drivers.length - 1 ? 2 : 0}>
                <Text color="red.400" mt="1px" flexShrink={0}>›</Text>
                <Text fontSize="xs" color="text.primary" lineHeight={1.6}>{d}</Text>
              </Flex>
            ))}
          </Box>
        )}

        {/* Observations */}
        {result.observations?.length > 0 && !result.loss_drivers?.length && (
          <Box
            bg="rgba(16,185,129,0.06)" border="1px solid rgba(16,185,129,0.15)"
            borderRadius="10px" p={3}
          >
            {result.observations.map((obs, i) => (
              <Text key={i} fontSize="xs" color="text.primary" lineHeight={1.6}>{obs}</Text>
            ))}
          </Box>
        )}
      </GlassCard>
    </MotionBox>
  );
}

export default function EfficiencyPage() {
  const [results,  setResults]  = useState([]);
  const [hours,    setHours]    = useState(24);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/v1/efficiency?hours=${hours}`)
      .then((r) => r.json())
      .then((d) => { setResults(d.results ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [hours]);

  return (
    <PageShell>
      <PageHeader
        title="Efficiency Benchmarker"
        icon={<PageHeaderIcon icon={<Zap size={20} strokeWidth={1.85} />} />}
        subtitle="kW/TR analysis vs design + industry benchmarks · loss driver attribution"
        actions={<PeriodSelect value={hours} onChange={setHours} />}
      />

      {/* Benchmark legend */}
      <GlassCard mb={6} p={4}>
        <Eyebrow mb={3}>kW/TR Benchmark Scale</Eyebrow>
        <Flex gap={3} flexWrap="wrap">
          {[
            { label: "Excellent", range: "< 0.55", color: "#10b981" },
            { label: "Good",      range: "0.55 – 0.65", color: "#00c4f4" },
            { label: "Fair",      range: "0.65 – 0.75", color: "#f59e0b" },
            { label: "Poor",      range: "0.75 – 0.85", color: "#f97316" },
            { label: "Critical",  range: "> 0.85",  color: "#ef4444" },
          ].map((b) => (
            <Flex key={b.label} align="center" gap={2}>
              <Box w={3} h={3} borderRadius="3px" bg={b.color} />
              <Text fontSize="xs" color="text.muted">
                <Text as="span" color="text.primary" fontWeight={600}>{b.label}</Text>
                {" "}{b.range}
              </Text>
            </Flex>
          ))}
        </Flex>
      </GlassCard>

      <MotionGrid variants={stagger} initial="initial" animate="animate" templateColumns={{ base: "1fr", lg: "1fr 1fr" }} gap={5}>
        {loading
          ? Array.from({ length: 2 }).map((_, i) => (
              <MotionBox key={i} variants={fadeUp}><SkeletonKpiCard /></MotionBox>
            ))
          : results.map((r) => <EfficiencyCard key={r.equipment_id} result={r} />)
        }
      </MotionGrid>
    </PageShell>
  );
}
