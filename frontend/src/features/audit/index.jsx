import { useState, useEffect } from "react";
import { Box, Flex, Text, Select, Grid, Badge, Tabs, TabList, TabPanels, Tab, TabPanel } from "@chakra-ui/react";
import { ScrollText, MessageSquareText, Bot } from "lucide-react";
import { motion } from "framer-motion";
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
  const [hours, setHours]     = useState(24);
  const [stats, setStats]     = useState(null);
  const [analyses, setAnalyses] = useState(null);
  const [agents, setAgents]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/v1/audit/stats?hours=${hours}`).then(r => r.json()),
      fetch(`/api/v1/audit/analyses?hours=${hours}&limit=100`).then(r => r.json()),
      fetch(`/api/v1/audit/agents?hours=${hours}&limit=100`).then(r => r.json()),
    ])
      .then(([s, a, ag]) => { setStats(s); setAnalyses(a); setAgents(ag); setLoading(false); })
      .catch(() => setLoading(false));
  }, [hours]);

  const okCount   = stats?.analyses_by_status?.ok ?? 0;
  const errCount  = stats?.analyses_by_status?.error ?? 0;

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
          </TabPanels>
        </Tabs>
      )}
    </PageShell>
  );
}
