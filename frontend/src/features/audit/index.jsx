import { useState, useEffect, useMemo } from "react";
import { Box, Flex, Text, Select, Grid, Badge, Tabs, TabList, TabPanels, Tab, TabPanel, useColorMode } from "@chakra-ui/react";
import { ScrollText, MessageSquareText, Bot, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import ReactECharts from "echarts-for-react";
import PageShell from "../../shared/ui/PageShell";
import PageHeader from "../../shared/ui/PageHeader";
import { surfaceSelectProps } from "../../shared/ui/PeriodSelect";
import GlassCard from "../../shared/ui/GlassCard";
import PageHeaderIcon from "../../shared/ui/PageHeaderIcon";
import Eyebrow from "../../shared/ui/Eyebrow";
import { SkeletonKpiCard } from "../../shared/ui/SkeletonCard";

const MotionBox = motion.create(Box);

const STATUS_COLOR = {
  ok:        { c: "#10b981", bg: "rgba(16,185,129,0.12)", b: "rgba(16,185,129,0.32)" },
  streaming: { c: "#0ea5e9", bg: "rgba(14,165,233,0.12)", b: "rgba(14,165,233,0.32)" },
  running:   { c: "#0ea5e9", bg: "rgba(14,165,233,0.12)", b: "rgba(14,165,233,0.32)" },
  error:     { c: "#ef4444", bg: "rgba(239,68,68,0.12)", b: "rgba(239,68,68,0.32)" },
};

function StatusChip({ status }) {
  const s = STATUS_COLOR[status] || STATUS_COLOR.ok;
  return (
    <Box px={2} py="2px" borderRadius="6px" bg={s.bg} border="1px solid" borderColor={s.b}
      color={s.c} fontSize="10px" fontWeight={700} textTransform="uppercase" letterSpacing="0.06em"
      w="fit-content">
      {status}
    </Box>
  );
}

function StatTile({ label, value, color = "text.primary", delay = 0 }) {
  return (
    <MotionBox initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay }}>
      <GlassCard p={4}>
        <Eyebrow mb={2}>{label}</Eyebrow>
        <Text fontSize="2xl" fontWeight={700} color={color} sx={{ fontVariantNumeric: "tabular-nums" }}>
          {value}
        </Text>
      </GlassCard>
    </MotionBox>
  );
}

export default function AuditPage() {
  const { colorMode } = useColorMode();
  const isDark = colorMode === "dark";
  const [hours, setHours]     = useState(24);
  const [stats, setStats]     = useState(null);
  const [analyses, setAnalyses] = useState(null);
  const [agents, setAgents]   = useState(null);
  const [quality, setQuality] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/v1/audit/stats?hours=${hours}`).then(r => r.json()),
      fetch(`/api/v1/audit/analyses?hours=${hours}&limit=100`).then(r => r.json()),
      fetch(`/api/v1/audit/agents?hours=${hours}&limit=100`).then(r => r.json()),
      fetch(`/api/v1/audit/quality?hours=${hours}&bucket_hours=${hours >= 168 ? 6 : 1}`).then(r => r.json()),
    ])
      .then(([s, a, ag, q]) => { setStats(s); setAnalyses(a); setAgents(ag); setQuality(q); setLoading(false); })
      .catch(() => setLoading(false));
  }, [hours]);

  const okCount   = stats?.analyses_by_status?.ok ?? 0;
  const errCount  = stats?.analyses_by_status?.error ?? 0;

  const qualityOption = useMemo(() => {
    if (!quality?.series?.length) return null;
    const xData    = quality.series.map(p => new Date(p.ts).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }));
    const okData   = quality.series.map(p => p.ok);
    const errData  = quality.series.map(p => p.error);
    return {
      animation: true,
      animationDuration: 600,
      grid: { top: 24, right: 16, bottom: 32, left: 36 },
      legend: { data: ["OK", "Error"], top: 0, textStyle: { color: isDark ? "#CCCCD4" : "#3B3B42", fontSize: 11 }, itemWidth: 12, itemHeight: 8 },
      xAxis: {
        type: "category", data: xData,
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { fontSize: 10, color: isDark ? "#9D9DAA" : "#334155", hideOverlap: true, interval: "auto" },
        splitLine: { show: false },
        boundaryGap: false,
      },
      yAxis: {
        type: "value",
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { fontSize: 10, color: isDark ? "#9D9DAA" : "#334155" },
        splitLine: { lineStyle: { color: isDark ? "rgba(255,255,255,0.05)" : "rgba(31,63,254,0.06)", type: "dashed" } },
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: isDark ? "#0d1526" : "#fff",
        borderColor:     isDark ? "#1e2d4a" : "#E0E7FF",
        borderRadius: 10, padding: [8, 12],
        textStyle: { fontSize: 11, color: isDark ? "#fff" : "#0D0D0D" },
      },
      series: [
        {
          name: "OK", type: "bar", stack: "verdict", data: okData,
          itemStyle: { color: "#10b981", borderRadius: [3, 3, 0, 0] },
          barMaxWidth: 18,
        },
        {
          name: "Error", type: "bar", stack: "verdict", data: errData,
          itemStyle: { color: "#ef4444", borderRadius: [3, 3, 0, 0] },
          barMaxWidth: 18,
        },
      ],
    };
  }, [quality, isDark]);

  return (
    <PageShell>
      <PageHeader
        title="Audit Log"
        icon={<PageHeaderIcon icon={<ScrollText size={20} strokeWidth={1.85} />} />}
        subtitle="Every AI request — model, duration, status, prompt+response hashes — for compliance and replay"
        actions={
          <Select size="sm" value={hours} onChange={e => setHours(Number(e.target.value))} {...surfaceSelectProps} w="140px" aria-label="Time window">
            <option value={1}>Last 1h</option>
            <option value={6}>Last 6h</option>
            <option value={24}>Last 24h</option>
            <option value={72}>Last 72h</option>
            <option value={168}>Last 7d</option>
            <option value={720}>Last 30d</option>
          </Select>
        }
      />

      {stats && !loading && (
        <Grid templateColumns={{ base: "minmax(0,1fr)", sm: "repeat(2,minmax(0,1fr))", lg: "repeat(4,minmax(0,1fr))" }} gap={4} mb={6}>
          <StatTile label="Analyses"  value={stats.analyses_total} delay={0} />
          <StatTile label="Agent runs" value={stats.agents_total} delay={0.04} />
          <StatTile label="Successful" value={okCount} color="#10b981" delay={0.08} />
          <StatTile label="Errors"    value={errCount} color={errCount ? "#ef4444" : "text.primary"} delay={0.12} />
        </Grid>
      )}

      {loading ? <SkeletonKpiCard /> : (
        <Tabs colorScheme="brand" variant="line">
          <TabList borderColor="border.subtle" mb={4}>
            <Tab fontSize="sm" fontWeight={600}>
              <Flex align="center" gap={2}>
                <MessageSquareText size={14} strokeWidth={2} />
                Analyses ({analyses?.rows?.length ?? 0})
              </Flex>
            </Tab>
            <Tab fontSize="sm" fontWeight={600}>
              <Flex align="center" gap={2}>
                <Bot size={14} strokeWidth={2} />
                Agent runs ({agents?.rows?.length ?? 0})
              </Flex>
            </Tab>
            <Tab fontSize="sm" fontWeight={600}>
              <Flex align="center" gap={2}>
                <ShieldCheck size={14} strokeWidth={2} />
                Quality
              </Flex>
            </Tab>
          </TabList>
          <TabPanels>
            <TabPanel px={0}>
              <GlassCard p={0} overflow="hidden">
                <Box overflowX="auto">
                  <Box minW="900px">
                    <Grid templateColumns="170px 110px 120px 90px minmax(0,1fr) 80px" gap={3} px={4} py={3} borderBottom="1px solid" borderColor="border.subtle">
                      <Eyebrow>When</Eyebrow>
                      <Eyebrow>Status</Eyebrow>
                      <Eyebrow>Equipment</Eyebrow>
                      <Eyebrow>Model</Eyebrow>
                      <Eyebrow>Question</Eyebrow>
                      <Eyebrow>Duration</Eyebrow>
                    </Grid>
                    {(analyses?.rows || []).map((r, i) => (
                      <Grid key={r.id} templateColumns="170px 110px 120px 90px minmax(0,1fr) 80px" gap={3} px={4} py="10px"
                        borderBottom="1px solid" borderColor="border.subtle" _hover={{ bg: "rgba(31,63,254,0.04)" }}>
                        <Text fontSize="11px" color="text.muted" sx={{ fontFamily: "mono" }}>
                          {r.created_at?.replace("T", " ").slice(0, 19) || "—"}
                        </Text>
                        <StatusChip status={r.status} />
                        <Text fontSize="xs" color="text.primary" noOfLines={1}>{r.equipment_id || "—"}</Text>
                        <Badge fontSize="9px" bg="bg.chip" color="text.muted" border="1px solid" borderColor="border.subtle" borderRadius="6px" px={2} w="fit-content">
                          {r.model || "—"}
                        </Badge>
                        <Text fontSize="xs" color="text.primary" noOfLines={2}>{r.question}</Text>
                        <Text fontSize="xs" color="text.muted" sx={{ fontVariantNumeric: "tabular-nums" }} textAlign="right">
                          {r.total_ms ? `${(r.total_ms / 1000).toFixed(1)}s` : "—"}
                        </Text>
                      </Grid>
                    ))}
                    {(analyses?.rows || []).length === 0 && (
                      <Text px={4} py={6} color="text.muted" fontSize="sm" textAlign="center">No analyses in this window.</Text>
                    )}
                  </Box>
                </Box>
              </GlassCard>
            </TabPanel>

            <TabPanel px={0}>
              <GlassCard p={0} overflow="hidden">
                <Box overflowX="auto">
                  <Box minW="900px">
                    <Grid templateColumns="170px 110px 120px 80px 90px minmax(0,1fr) 80px" gap={3} px={4} py={3} borderBottom="1px solid" borderColor="border.subtle">
                      <Eyebrow>When</Eyebrow>
                      <Eyebrow>Status</Eyebrow>
                      <Eyebrow>Mode</Eyebrow>
                      <Eyebrow>Steps</Eyebrow>
                      <Eyebrow>Model</Eyebrow>
                      <Eyebrow>Goal</Eyebrow>
                      <Eyebrow>Duration</Eyebrow>
                    </Grid>
                    {(agents?.rows || []).map((r) => (
                      <Grid key={r.id} templateColumns="170px 110px 120px 80px 90px minmax(0,1fr) 80px" gap={3} px={4} py="10px"
                        borderBottom="1px solid" borderColor="border.subtle" _hover={{ bg: "rgba(31,63,254,0.04)" }}>
                        <Text fontSize="11px" color="text.muted" sx={{ fontFamily: "mono" }}>
                          {r.created_at?.replace("T", " ").slice(0, 19) || "—"}
                        </Text>
                        <StatusChip status={r.status} />
                        <Badge fontSize="9px" bg="rgba(124,58,237,0.12)" color="#a78bfa" border="1px solid rgba(124,58,237,0.25)" borderRadius="6px" px={2} w="fit-content">
                          {r.mode}
                        </Badge>
                        <Text fontSize="xs" color="text.primary" sx={{ fontVariantNumeric: "tabular-nums" }}>{r.steps_taken ?? "—"}</Text>
                        <Badge fontSize="9px" bg="bg.chip" color="text.muted" border="1px solid" borderColor="border.subtle" borderRadius="6px" px={2} w="fit-content">
                          {r.model || "—"}
                        </Badge>
                        <Text fontSize="xs" color="text.primary" noOfLines={2}>{r.goal}</Text>
                        <Text fontSize="xs" color="text.muted" sx={{ fontVariantNumeric: "tabular-nums" }} textAlign="right">
                          {r.total_ms ? `${(r.total_ms / 1000).toFixed(1)}s` : "—"}
                        </Text>
                      </Grid>
                    ))}
                    {(agents?.rows || []).length === 0 && (
                      <Text px={4} py={6} color="text.muted" fontSize="sm" textAlign="center">No agent runs in this window.</Text>
                    )}
                  </Box>
                </Box>
              </GlassCard>
            </TabPanel>

            <TabPanel px={0}>
              {/* Quality KPIs */}
              <Grid templateColumns={{ base: "minmax(0,1fr)", sm: "repeat(2,minmax(0,1fr))", lg: "repeat(4,minmax(0,1fr))" }} gap={4} mb={6}>
                <StatTile label="Success rate" value={quality ? `${(quality.success_rate * 100).toFixed(1)}%` : "—"} color="#10b981" delay={0} />
                <StatTile label="OK"        value={quality?.by_status?.ok ?? 0}        color="#10b981" delay={0.04} />
                <StatTile label="Error"     value={quality?.by_status?.error ?? 0}     color={quality?.by_status?.error ? "#ef4444" : "text.primary"} delay={0.08} />
                <StatTile label="Cancelled" value={quality?.by_status?.cancelled ?? 0} color="text.muted" delay={0.12} />
              </Grid>

              {qualityOption ? (
                <GlassCard p={0} overflow="hidden">
                  <Flex px={5} pt={4} pb={3} align="center" gap={2}>
                    <ShieldCheck size={14} strokeWidth={2} color="#10b981" />
                    <Eyebrow>Verdict trend</Eyebrow>
                    <Badge ml="auto" fontSize="9px" bg="bg.chip" color="text.muted" border="1px solid" borderColor="border.subtle" borderRadius="6px" px={2}>
                      {quality.bucket_hours}h buckets · {quality.series.length} points
                    </Badge>
                  </Flex>
                  <ReactECharts option={qualityOption} style={{ height: "280px", width: "100%" }} opts={{ renderer: "canvas" }} />
                  <Box px={5} pb={3}>
                    <Text fontSize="10px" color="text.muted">
                      Green = analyses that passed self-critique without issues. Red = errors / aborted runs.
                      Hallucination score is derived from the self-critique verdict written to <code>analysis_audit.status</code>.
                    </Text>
                  </Box>
                </GlassCard>
              ) : (
                <GlassCard p={6} display="flex" alignItems="center" justifyContent="center">
                  <Text color="text.muted" fontSize="sm">No analyses in this window yet.</Text>
                </GlassCard>
              )}

              {/* Latency split */}
              {quality?.latency_by_status && Object.keys(quality.latency_by_status).length > 0 && (
                <GlassCard mt={4} p={4}>
                  <Eyebrow mb={3}>Average latency by verdict</Eyebrow>
                  <Flex gap={6} flexWrap="wrap">
                    {Object.entries(quality.latency_by_status).map(([k, v]) => (
                      <Flex key={k} align="center" gap={2}>
                        <Box w={2} h={2} borderRadius="full" bg={k === "ok" ? "#10b981" : k === "error" ? "#ef4444" : "#64748b"} />
                        <Text fontSize="xs" color="text.muted">{k}:</Text>
                        <Text fontSize="xs" fontWeight={700} color="text.primary" sx={{ fontVariantNumeric: "tabular-nums" }}>
                          {v != null ? `${(v / 1000).toFixed(2)}s` : "—"}
                        </Text>
                      </Flex>
                    ))}
                  </Flex>
                </GlassCard>
              )}
            </TabPanel>
          </TabPanels>
        </Tabs>
      )}
    </PageShell>
  );
}
