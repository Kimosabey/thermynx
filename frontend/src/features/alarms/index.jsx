import { useState, useEffect } from "react";
import { Box, Flex, Text, Select, Badge, Grid } from "@chakra-ui/react";
import { BellRing, TriangleAlert, Activity, Info } from "lucide-react";
import { motion } from "framer-motion";
import PageShell from "../../shared/ui/PageShell";
import PageHeader from "../../shared/ui/PageHeader";
import { surfaceSelectProps } from "../../shared/ui/PeriodSelect";
import GlassCard from "../../shared/ui/GlassCard";
import PageHeaderIcon from "../../shared/ui/PageHeaderIcon";
import Eyebrow from "../../shared/ui/Eyebrow";
import { SkeletonKpiCard } from "../../shared/ui/SkeletonCard";

const MotionBox = motion.create(Box);

const SEV = {
  critical: { color: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.32)", Icon: TriangleAlert },
  warning:  { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.32)", Icon: Activity },
  info:     { color: "#0ea5e9", bg: "rgba(14,165,233,0.12)", border: "rgba(14,165,233,0.32)", Icon: Info },
};

function SeverityChip({ severity }) {
  const s = SEV[severity] || SEV.info;
  const Icon = s.Icon;
  return (
    <Flex align="center" gap="6px" px={2} py="3px" borderRadius="6px"
      bg={s.bg} border="1px solid" borderColor={s.border} color={s.color}
      fontSize="10px" fontWeight={700} textTransform="uppercase" letterSpacing="0.06em"
    >
      <Icon size={11} strokeWidth={2.2} />
      {severity}
    </Flex>
  );
}

export default function AlarmsPage() {
  const [hours, setHours]       = useState(1);
  const [severity, setSeverity] = useState("");
  const [data, setData]         = useState(null);
  const [stats, setStats]       = useState(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    setLoading(true);
    const sevQ = severity ? `&severity=${severity}` : "";
    Promise.all([
      fetch(`/api/v1/alarms?hours=${hours}${sevQ}&limit=100`).then(r => r.json()),
      fetch(`/api/v1/alarms/stats?hours=${hours}`).then(r => r.json()),
    ])
      .then(([list, s]) => { setData(list); setStats(s); setLoading(false); })
      .catch(() => setLoading(false));
  }, [hours, severity]);

  const alarms = data?.alarms || [];

  return (
    <PageShell>
      <PageHeader
        title="Alarms"
        icon={<PageHeaderIcon icon={<BellRing size={20} strokeWidth={1.85} />} />}
        subtitle="Unified anomaly + maintenance alerts with severity tiers"
        actions={
          <Flex gap={3} flexWrap="wrap">
            <Select size="sm" value={severity} onChange={(e) => setSeverity(e.target.value)} {...surfaceSelectProps} w="140px" aria-label="Severity">
              <option value="">All severities</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </Select>
            <Select size="sm" value={hours} onChange={(e) => setHours(Number(e.target.value))} {...surfaceSelectProps} w="120px" aria-label="Time window">
              <option value={1}>Last 1h</option>
              <option value={6}>Last 6h</option>
              <option value={24}>Last 24h</option>
              <option value={72}>Last 72h</option>
              <option value={168}>Last 7d</option>
            </Select>
          </Flex>
        }
      />

      {/* Severity KPIs */}
      {stats && !loading && (
        <Grid templateColumns={{ base: "minmax(0,1fr)", sm: "repeat(2,minmax(0,1fr))", lg: "repeat(4,minmax(0,1fr))" }} gap={4} mb={6}>
          {[
            { l: "Total",    v: stats.total,                     c: "text.primary" },
            { l: "Critical", v: stats.by_severity?.critical ?? 0, c: SEV.critical.color },
            { l: "Warning",  v: stats.by_severity?.warning ?? 0,  c: SEV.warning.color },
            { l: "Info",     v: stats.by_severity?.info ?? 0,     c: SEV.info.color },
          ].map((s, i) => (
            <MotionBox key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: i * 0.04 }}>
              <GlassCard p={4}>
                <Eyebrow mb={2}>{s.l}</Eyebrow>
                <Text fontSize="2xl" fontWeight={700} color={s.c} sx={{ fontVariantNumeric: "tabular-nums" }}>
                  {s.v}
                </Text>
              </GlassCard>
            </MotionBox>
          ))}
        </Grid>
      )}

      {loading
        ? <SkeletonKpiCard />
        : alarms.length === 0
          ? (
            <GlassCard p={6} display="flex" alignItems="center" justifyContent="center">
              <Text color="text.muted" fontSize="sm">No alarms in this window.</Text>
            </GlassCard>
          )
          : (
            <GlassCard p={0} overflow="hidden">
              <Box overflowX="auto">
                <Box minW="720px">
                  <Grid templateColumns="100px 160px 110px minmax(0,1fr) 90px" gap={3} px={4} py={3} borderBottom="1px solid" borderColor="border.subtle">
                    <Eyebrow>Severity</Eyebrow>
                    <Eyebrow>Equipment</Eyebrow>
                    <Eyebrow>Kind</Eyebrow>
                    <Eyebrow>Message</Eyebrow>
                    <Eyebrow>Value</Eyebrow>
                  </Grid>
                  {alarms.map((a, i) => (
                    <MotionBox
                      key={a.id}
                      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18, delay: Math.min(i, 12) * 0.015 }}
                    >
                      <Grid templateColumns="100px 160px 110px minmax(0,1fr) 90px" gap={3} px={4} py="10px"
                        borderBottom="1px solid" borderColor="border.subtle"
                        _hover={{ bg: "rgba(31,63,254,0.04)" }}>
                        <SeverityChip severity={a.severity} />
                        <Text fontSize="xs" fontWeight={600} color="text.primary" noOfLines={1}>{a.equipment_name}</Text>
                        <Badge fontSize="9px" bg="bg.chip" color="text.muted" border="1px solid" borderColor="border.subtle" borderRadius="6px" px={2} w="fit-content">
                          {a.kind}
                        </Badge>
                        <Text fontSize="xs" color="text.muted" noOfLines={2}>{a.message}</Text>
                        <Text fontSize="xs" fontWeight={700} color="text.primary" sx={{ fontVariantNumeric: "tabular-nums" }} textAlign="right">
                          {a.value != null ? Number(a.value).toFixed(2) : "—"}
                        </Text>
                      </Grid>
                    </MotionBox>
                  ))}
                </Box>
              </Box>
            </GlassCard>
          )
      }
    </PageShell>
  );
}
