import { useState } from "react";
import {
  Box, Flex, Text, Grid, Button, Badge, Spinner, useToast, Progress,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import { Activity, TrendingUp, CheckCircle2, ClipboardList } from "lucide-react";
import PageShell from "../../shared/ui/PageShell";
import PageHeader from "../../shared/ui/PageHeader";
import PageHeaderIcon from "../../shared/ui/PageHeaderIcon";
import Eyebrow from "../../shared/ui/Eyebrow";
import GlassCard from "../../shared/ui/GlassCard";
import EmptyState from "../../shared/ui/EmptyState";
import ErrorAlert from "../../shared/ui/ErrorAlert";
import { SkeletonEquipCard } from "../../shared/ui/SkeletonCard";
import useApi from "../../shared/hooks/useApi";
import { useModelToast } from "../../shared/ai/useModels";
import { apiFetch } from "../../shared/api/client";

const MotionBox = motion.create(Box);
const fmt = (v, d = 3) => (v == null ? "—" : Number(v).toLocaleString(undefined, { maximumFractionDigits: d }));

const SEV = {
  critical: { color: "red",    label: "Critical" },
  warning:  { color: "orange", label: "Warning" },
  watch:    { color: "yellow", label: "Watch" },
  none:     { color: "gray",   label: "Stable" },
};

function SignalRow({ s }) {
  const sev = SEV[s.severity] || SEV.none;
  return (
    <Box py={3} borderTop="1px solid" borderColor="border.subtle">
      <Flex justify="space-between" align="center" gap={3} wrap="wrap" mb={1}>
        <Flex align="center" gap={2}>
          <TrendingUp size={14} strokeWidth={2} />
          <Text fontWeight={600} fontSize="sm">{s.metric}</Text>
          <Badge colorScheme={sev.color} variant="subtle" fontSize="10px">{sev.label}</Badge>
        </Flex>
        {s.projected_days_to_threshold != null && (
          <Text fontSize="xs" color={sev.color + ".400"}>
            ~{fmt(s.projected_days_to_threshold, 0)} days to poor line
          </Text>
        )}
      </Flex>
      <Text fontSize="sm" color="text.secondary">{s.summary}</Text>
      {s.early_avg != null && s.late_avg != null && (
        <Text fontSize="xs" color="text.muted" mt={1}>
          earlier {fmt(s.early_avg)} → now {fmt(s.late_avg)} (threshold {fmt(s.threshold)}) · {s.samples} samples
        </Text>
      )}
    </Box>
  );
}

export default function PredictivePage() {
  const toast = useToast();
  const notifyModel = useModelToast();
  const { data, isLoading, error, refetch } = useApi("/api/v1/predictive/degradation?days=14", {
    onSuccess: (d) => { if ((d?.assets || []).some((a) => a.narrative)) notifyModel("text", { prefix: "Predictive" }); },
  });
  const [running, setRunning] = useState(false);

  const assets = data?.assets || [];
  const degradingCount = data?.degrading_count || 0;

  async function proposeWorkOrders() {
    setRunning(true);
    try {
      const res = await apiFetch("/api/v1/predictive/run?days=14", { method: "POST" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `HTTP ${res.status}`);
      const out = await res.json();
      toast({
        title: `${out.created_count} PM work order${out.created_count === 1 ? "" : "s"} proposed`,
        description: out.created_count ? "Review them in Work Orders." : "Nothing new — existing PMs cover current trends.",
        status: out.created_count ? "success" : "info",
        duration: 5000,
      });
    } catch (e) {
      toast({ title: "Propose failed", description: e.message, status: "error", duration: 5000 });
    } finally {
      setRunning(false);
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Predictive Maintenance"
        subtitle="Trend-based degradation — proposes PM work orders before the metric crosses the poor line"
        icon={<PageHeaderIcon icon={<Activity size={20} strokeWidth={1.85} />} />}
        actions={
          <Button size="sm" colorScheme="blue" leftIcon={running ? <Spinner size="xs" /> : <ClipboardList size={15} />} onClick={proposeWorkOrders} isDisabled={running || !degradingCount}>
            {running ? "Proposing…" : "Propose PM work orders"}
          </Button>
        }
      />

      <ErrorAlert error={error} onRetry={refetch} />

      {isLoading ? (
        <Grid templateColumns={{ base: "1fr", lg: "repeat(2, 1fr)" }} gap={4}>
          {Array.from({ length: 2 }).map((_, i) => <SkeletonEquipCard key={i} />)}
        </Grid>
      ) : assets.length === 0 ? (
        <EmptyState icon={<Activity size={28} strokeWidth={1.6} />} title="No chiller data" description="Need a multi-day window of running telemetry to assess trends." />
      ) : (
        <>
          <MotionBox initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} mb={5}>
            <GlassCard>
              <Flex align="center" gap={2}>
                {degradingCount ? <TrendingUp size={16} /> : <CheckCircle2 size={16} />}
                <Text fontSize="sm">
                  {degradingCount
                    ? `${degradingCount} asset${degradingCount === 1 ? "" : "s"} showing a degrading trend over the last ${data.days} days.`
                    : `No degrading trends in the last ${data.days} days — all chillers stable.`}
                </Text>
              </Flex>
            </GlassCard>
          </MotionBox>

          <Grid templateColumns={{ base: "1fr", lg: "repeat(2, 1fr)" }} gap={4}>
            {assets.map((a) => (
              <GlassCard key={a.equipment_id}>
                <Flex justify="space-between" align="center" mb={2}>
                  <Text fontWeight={700}>{a.name}</Text>
                  <Badge colorScheme={a.degrading ? "orange" : "green"} variant="subtle">
                    {a.degrading ? "degrading" : "stable"}
                  </Badge>
                </Flex>
                {a.narrative && <Text fontSize="sm" color="text.secondary" mb={2}>{a.narrative}</Text>}
                {(a.signals || []).map((s) => <SignalRow key={s.metric} s={s} />)}
              </GlassCard>
            ))}
          </Grid>
        </>
      )}
    </PageShell>
  );
}
