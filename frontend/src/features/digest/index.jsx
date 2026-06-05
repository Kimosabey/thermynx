import { useState } from "react";
import {
  Box, Flex, Text, Grid, Button, Badge, Divider, Spinner,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import { Sun, RefreshCw, TriangleAlert, Zap, IndianRupee, Lightbulb } from "lucide-react";
import PageShell from "../../shared/ui/PageShell";
import PageHeader from "../../shared/ui/PageHeader";
import PageHeaderIcon from "../../shared/ui/PageHeaderIcon";
import Eyebrow from "../../shared/ui/Eyebrow";
import GlassCard from "../../shared/ui/GlassCard";
import EmptyState from "../../shared/ui/EmptyState";
import ErrorAlert from "../../shared/ui/ErrorAlert";
import useApi from "../../shared/hooks/useApi";
import { apiFetch } from "../../shared/api/client";

const MotionBox = motion.create(Box);

const fmtNum = (v, digits = 2) =>
  v == null ? "—" : Number(v).toLocaleString(undefined, { maximumFractionDigits: digits });

const fmtWhen = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium", timeStyle: "short",
    });
  } catch {
    return String(iso).slice(0, 19);
  }
};

const titleCase = (s) =>
  (s || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function KpiTile({ label, value, accent, sub }) {
  return (
    <GlassCard>
      <Eyebrow mb={2}>{label}</Eyebrow>
      <Text fontSize="2xl" fontWeight={800} color={accent} sx={{ fontVariantNumeric: "tabular-nums" }}>
        {value}
      </Text>
      {sub && <Text fontSize="xs" color="text.muted" mt={1}>{sub}</Text>}
    </GlassCard>
  );
}

export default function DigestPage() {
  const { data, isLoading, error, refetch } = useApi("/api/v1/digest/latest");
  const { data: hist, refetch: refetchHist } = useApi("/api/v1/digest?limit=14");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState(null);

  const digest = data?.digest || null;
  const history = (hist?.digests || []).filter((d) => d.id !== digest?.id);

  async function generateNow() {
    setGenerating(true);
    setGenError(null);
    try {
      const res = await apiFetch("/api/v1/digest/run?hours=24", { method: "POST" });
      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try { detail = (await res.json()).detail || detail; } catch { /* ignore */ }
        throw new Error(detail);
      }
      await Promise.all([refetch(), refetchHist()]);
    } catch (e) {
      setGenError(e.message || "Failed to generate digest");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Morning Digest"
        subtitle="Auto-generated daily plant-health summary · pushed to Slack each morning (06:00 UTC)"
        icon={<PageHeaderIcon icon={<Sun size={20} strokeWidth={1.85} />} />}
        actions={
          <Button
            size="sm"
            leftIcon={generating ? <Spinner size="xs" /> : <RefreshCw size={15} strokeWidth={2} />}
            onClick={generateNow}
            isDisabled={generating}
            colorScheme="blue"
          >
            {generating ? "Generating…" : "Generate now"}
          </Button>
        }
      />

      <ErrorAlert error={genError} onDismiss={() => setGenError(null)} />
      {!digest && <ErrorAlert error={error} onRetry={refetch} />}

      {isLoading && !digest ? (
        <Flex h="40vh" align="center" justify="center">
          <Spinner size="lg" color="accent.primary" thickness="3px" speed="0.7s" />
        </Flex>
      ) : !digest ? (
        <EmptyState
          icon={<Sun size={28} strokeWidth={1.6} />}
          title="No digest yet"
          description="The morning digest runs daily at 06:00 UTC. Generate one now to preview it."
          action={{ label: generating ? "Generating…" : "Generate now", onClick: generateNow }}
        />
      ) : (
        <>
          {/* Headline card */}
          <MotionBox initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} mb={6}>
            <GlassCard>
              <Flex justify="space-between" align="flex-start" gap={3} wrap="wrap">
                <Eyebrow>{fmtWhen(digest.created_at)} · last {digest.hours}h</Eyebrow>
                {digest.status === "degraded" && (
                  <Badge colorScheme="orange" variant="subtle" fontSize="10px">
                    narrative fallback (LLM offline)
                  </Badge>
                )}
              </Flex>
              <Text fontSize="xl" fontWeight={700} mt={2} lineHeight="1.4">
                {digest.headline}
              </Text>
            </GlassCard>
          </MotionBox>

          {/* KPI grid */}
          <Grid templateColumns={{ base: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" }} gap={4} mb={6}>
            <KpiTile label="Plant energy" value={`${fmtNum(digest.total_kwh)} kWh`} accent="accent.cyan" />
            <KpiTile
              label="Plant cost"
              value={digest.total_cost_inr == null ? "—" : `₹ ${fmtNum(digest.total_cost_inr)}`}
              accent="green.400"
            />
            <KpiTile
              label="Anomalies"
              value={digest.anomaly_count}
              accent={digest.critical_count > 0 ? "red.400" : "text.primary"}
              sub={`${digest.critical_count} critical`}
            />
            <KpiTile
              label="Least-efficient chiller"
              value={digest.worst_equipment ? titleCase(digest.worst_equipment) : "—"}
              accent="purple.400"
              sub={digest.worst_kw_per_tr == null ? undefined : `${fmtNum(digest.worst_kw_per_tr, 3)} kW/TR`}
            />
          </Grid>

          {/* Recommendation */}
          {digest.recommendation && (
            <MotionBox initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} mb={8}>
              <GlassCard>
                <Flex align="center" gap={2} mb={2}>
                  <Lightbulb size={16} strokeWidth={2} />
                  <Eyebrow mb={0}>Recommended action</Eyebrow>
                </Flex>
                <Text fontSize="md">{digest.recommendation}</Text>
              </GlassCard>
            </MotionBox>
          )}

          {/* History */}
          {history.length > 0 && (
            <GlassCard p={0} overflow="hidden">
              <Box px={5} py={4} borderBottom="1px solid" borderColor="border.subtle">
                <Text fontWeight={700} fontSize="sm">Earlier digests</Text>
              </Box>
              {history.map((d, i) => (
                <Box key={d.id}>
                  {i > 0 && <Divider borderColor="border.subtle" />}
                  <Flex px={5} py={3} gap={3} align="center" justify="space-between">
                    <Box minW={0}>
                      <Text fontSize="xs" color="text.muted">{fmtWhen(d.created_at)}</Text>
                      <Text fontSize="sm" noOfLines={1}>{d.headline}</Text>
                    </Box>
                    <Flex gap={4} flexShrink={0} fontSize="xs" color="text.muted" align="center">
                      <Flex align="center" gap={1}><Zap size={13} />{fmtNum(d.total_kwh, 0)} kWh</Flex>
                      <Flex align="center" gap={1}><IndianRupee size={13} />{fmtNum(d.total_cost_inr, 0)}</Flex>
                      <Flex align="center" gap={1} color={d.critical_count > 0 ? "red.400" : "text.muted"}>
                        <TriangleAlert size={13} />{d.anomaly_count}
                      </Flex>
                    </Flex>
                  </Flex>
                </Box>
              ))}
            </GlassCard>
          )}
        </>
      )}
    </PageShell>
  );
}
