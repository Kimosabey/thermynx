import { useState, useEffect } from "react";
import { Box, Flex, Text, Grid, Badge, Button } from "@chakra-ui/react";
import { CheckCircleIcon } from "@chakra-ui/icons";
import { motion } from "framer-motion";
import PageShell from "../../shared/ui/PageShell";
import PageHeader from "../../shared/ui/PageHeader";
import PeriodSelect, { HOURS_OPTIONS_ANOMALY } from "../../shared/ui/PeriodSelect";
import GlassCard from "../../shared/ui/GlassCard";
import { SkeletonEquipCard } from "../../shared/ui/SkeletonCard";

const MotionBox = motion(Box);
const MotionGrid = motion(Grid);
const stagger   = { animate: { transition: { staggerChildren: 0.05 } } };
const fadeUp    = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

const SEVERITY_META = {
  critical: { color: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.25)", label: "CRITICAL" },
  warning:  { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.25)", label: "WARNING" },
};

function ZScorePill({ z }) {
  const abs = Math.abs(z);
  const color = abs >= 4.5 ? "#ef4444" : abs >= 3.5 ? "#f97316" : "#f59e0b";
  return (
    <Box
      display="inline-flex" alignItems="center" gap={1}
      bg={`${color}18`} border="1px solid" borderColor={`${color}40`}
      borderRadius="full" px={2} py="2px"
    >
      <Text fontSize="10px" fontWeight={700} color={color} fontVariantNumeric="tabular-nums">
        {z > 0 ? "+" : ""}{z.toFixed(1)}σ
      </Text>
    </Box>
  );
}

function AnomalyCard({ anomaly }) {
  const meta = SEVERITY_META[anomaly.severity] ?? SEVERITY_META.warning;
  const time = anomaly.timestamp
    ? new Date(anomaly.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })
    : "—";

  return (
    <MotionBox variants={fadeUp}>
      <GlassCard p={4}>
        <Flex justify="space-between" align="flex-start" mb={3}>
          <Box>
            <Text fontWeight={700} fontSize="sm" color="text.primary">
              {(anomaly.equipment_name || anomaly.equipment_id).replace(/_/g, " ")}
            </Text>
            <Text fontSize="xs" color="text.muted" mt={0.5}>
              {anomaly.metric.replace(/_/g, " ")} · {time}
            </Text>
          </Box>
          <Flex gap={2} align="center">
            <ZScorePill z={anomaly.z_score} />
            <Badge
              fontSize="9px" px={2} py="2px" borderRadius="full"
              bg={meta.bg} color={meta.color} border="1px solid" borderColor={meta.border}
              fontWeight={700}
            >
              {meta.label}
            </Badge>
          </Flex>
        </Flex>

        <Flex gap={4} mb={3}>
          <Box>
            <Text fontSize="9px" color="text.muted" textTransform="uppercase" letterSpacing="0.1em" fontWeight={700} mb={1}>Value</Text>
            <Text fontSize="lg" fontWeight={700} color={meta.color} fontVariantNumeric="tabular-nums">
              {anomaly.value?.toFixed(3) ?? "—"}
            </Text>
          </Box>
          <Box>
            <Text fontSize="9px" color="text.muted" textTransform="uppercase" letterSpacing="0.1em" fontWeight={700} mb={1}>Baseline</Text>
            <Text fontSize="lg" fontWeight={700} color="text.primary" fontVariantNumeric="tabular-nums">
              {anomaly.baseline_mean?.toFixed(3) ?? "—"}
            </Text>
          </Box>
          <Box>
            <Text fontSize="9px" color="text.muted" textTransform="uppercase" letterSpacing="0.1em" fontWeight={700} mb={1}>Std Dev</Text>
            <Text fontSize="lg" fontWeight={700} color="text.muted" fontVariantNumeric="tabular-nums">
              ±{anomaly.baseline_std?.toFixed(3) ?? "—"}
            </Text>
          </Box>
        </Flex>

        {anomaly.description && (
          <Box
            bg="rgba(255,255,255,0.03)" border="1px solid" borderColor="border.subtle"
            borderRadius="8px" px={3} py={2}
          >
            <Text fontSize="xs" color="text.muted" lineHeight={1.6}>{anomaly.description}</Text>
          </Box>
        )}
      </GlassCard>
    </MotionBox>
  );
}

function EmptyState() {
  return (
    <GlassCard p={12} display="flex" alignItems="center" justifyContent="center" flexDir="column" gap={3}>
      <CheckCircleIcon color="green.400" boxSize={10} />
      <Text fontWeight={600} color="green.400" fontSize="sm">No anomalies detected</Text>
      <Text color="text.muted" fontSize="xs" textAlign="center" maxW="320px">
        All equipment is operating within normal statistical range
      </Text>
    </GlassCard>
  );
}

export default function AnomaliesPage() {
  const [anomalies, setAnomalies] = useState([]);
  const [hours,     setHours]     = useState(1);
  const [loading,   setLoading]   = useState(true);
  const [lastScan,  setLastScan]  = useState(null);

  function load() {
    setLoading(true);
    fetch(`/api/v1/anomalies/live?hours=${hours}`)
      .then((r) => r.json())
      .then((d) => {
        setAnomalies(d.anomalies ?? []);
        setLastScan(new Date());
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => { load(); }, [hours]);

  const critical = anomalies.filter((a) => a.severity === "critical");
  const warning  = anomalies.filter((a) => a.severity === "warning");

  return (
    <PageShell>
      <PageHeader
        title="Anomaly Detector"
        subtitle={
          <>
            Statistical z-score detection · auto-scan every 5 min
            {lastScan && ` · last scanned ${lastScan.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`}
          </>
        }
        actions={
          <>
            <PeriodSelect value={hours} onChange={setHours} options={HOURS_OPTIONS_ANOMALY} width="130px" />
            <MotionBox whileTap={{ scale: 0.95 }}>
              <Button size="sm" variant="glass" onClick={load} borderRadius="10px" fontSize="xs">
                Scan now
              </Button>
            </MotionBox>
          </>
        }
      />

      {/* Summary chips */}
      <Flex gap={3} mb={6} flexWrap="wrap">
        {[
          { label: "Critical", count: critical.length, color: "#ef4444", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.2)" },
          { label: "Warning",  count: warning.length,  color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.2)" },
          { label: "Total",    count: anomalies.length, color: "#64748b", bg: "rgba(100,116,139,0.08)", border: "rgba(100,116,139,0.15)" },
        ].map((s) => (
          <Flex
            key={s.label} align="center" gap={2}
            bg={s.bg} border="1px solid" borderColor={s.border}
            borderRadius="10px" px={3} py={2}
          >
            <Text fontSize="xs" color={s.color} fontWeight={700} fontVariantNumeric="tabular-nums">
              {s.count}
            </Text>
            <Text fontSize="xs" color="text.muted">{s.label}</Text>
          </Flex>
        ))}
      </Flex>

      {loading ? (
        <Grid templateColumns={{ base: "1fr", lg: "1fr 1fr" }} gap={4}>
          {Array.from({ length: 4 }).map((_, i) => (
            <MotionBox key={i} variants={fadeUp} initial="initial" animate="animate">
              <SkeletonEquipCard />
            </MotionBox>
          ))}
        </Grid>
      ) : anomalies.length === 0 ? (
        <EmptyState />
      ) : (
        <MotionGrid variants={stagger} initial="initial" animate="animate" templateColumns={{ base: "1fr", lg: "1fr 1fr" }} gap={4}>
          {anomalies.map((a, i) => (
            <AnomalyCard key={`${a.equipment_id}-${a.metric}-${a.timestamp}-${i}`} anomaly={a} />
          ))}
        </MotionGrid>
      )}
    </PageShell>
  );
}
