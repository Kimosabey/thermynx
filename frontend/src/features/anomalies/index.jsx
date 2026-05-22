import { useState, useEffect } from "react";
import { Box, Flex, Text, Grid, Badge, Button, Spinner, Collapse, useToast } from "@chakra-ui/react";
import { CheckCircleIcon } from "@chakra-ui/icons";
import { TriangleAlert, Sparkles, ChevronDown, ChevronUp, ClipboardList } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import PageShell from "../../shared/ui/PageShell";
import PageHeader from "../../shared/ui/PageHeader";
import PageHeaderIcon from "../../shared/ui/PageHeaderIcon";
import Eyebrow from "../../shared/ui/Eyebrow";
import ZScorePill from "../../shared/ui/ZScorePill";
import PeriodSelect, { HOURS_OPTIONS_ANOMALY } from "../../shared/ui/PeriodSelect";
import GlassCard from "../../shared/ui/GlassCard";
import { SkeletonEquipCard } from "../../shared/ui/SkeletonCard";

const MotionBox = motion.create(Box);
const MotionGrid = motion.create(Grid);
const stagger   = { animate: { transition: { staggerChildren: 0.05 } } };
const fadeUp    = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

const SEVERITY_META = {
  critical: { color: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.25)", label: "CRITICAL" },
  warning:  { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.25)", label: "WARNING" },
};

const CONF_COLOR = { high: "#10b981", medium: "#f59e0b", low: "#64748b" };

function AnomalyCard({ anomaly }) {
  const meta = SEVERITY_META[anomaly.severity] ?? SEVERITY_META.warning;
  const time = anomaly.timestamp
    ? new Date(anomaly.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })
    : "—";
  const [open, setOpen]         = useState(false);
  const [explain, setExplain]   = useState(null);
  const [exLoad, setExLoad]     = useState(false);
  const [exErr, setExErr]       = useState(null);
  const [woLoading, setWoLoading] = useState(false);
  const toast                   = useToast();
  const navigate                = useNavigate();

  async function createWorkOrder() {
    setWoLoading(true);
    const title = `Investigate ${anomaly.equipment_name || anomaly.equipment_id} ${anomaly.metric}`;
    const lines = [
      `Anomaly detected on ${anomaly.equipment_name || anomaly.equipment_id}.`,
      `Metric: ${anomaly.metric} = ${anomaly.value} (z-score ${anomaly.z_score?.toFixed(2)}).`,
      anomaly.timestamp ? `Observed at ${anomaly.timestamp}.` : null,
      anomaly.description || null,
    ].filter(Boolean);
    const diagnosis = explain?.summary
      ? explain.summary + (explain.likely_causes?.length ? "\n\nLikely causes:\n" + explain.likely_causes.map(c => `• [${c.confidence}] ${c.cause}`).join("\n") : "")
      : null;
    const actions = explain?.recommended_checks?.length
      ? explain.recommended_checks.map(s => `• ${s}`).join("\n")
      : null;
    try {
      const r = await fetch("/api/v1/work-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          equipment_id: anomaly.equipment_id,
          priority:     anomaly.severity === "critical" ? "high" : "normal",
          description:  lines.join("\n"),
          source:       "anomaly",
          source_ref:   anomaly.id || null,
          diagnosis,
          recommended_actions: actions,
          created_by:   "operator",
        }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || `HTTP ${r.status}`);
      const wo = await r.json();
      toast({
        title: "Work order created",
        description: wo.title,
        status: "success", duration: 3500, isClosable: true, position: "bottom-right",
      });
    } catch (e) {
      toast({ title: "Create failed", description: e.message, status: "error", duration: 4000 });
    } finally {
      setWoLoading(false);
    }
  }

  async function loadExplanation() {
    setOpen(true);
    if (explain || exLoad) return;
    setExLoad(true); setExErr(null);
    try {
      const r = await fetch("/api/v1/causal/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          equipment_id:  anomaly.equipment_id,
          metric:        anomaly.metric,
          value:         anomaly.value,
          z_score:       anomaly.z_score,
          timestamp:     anomaly.timestamp,
          hours_context: 6,
        }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data?.detail || `HTTP ${r.status}`);
      }
      setExplain(await r.json());
    } catch (e) {
      setExErr(e.message);
    } finally {
      setExLoad(false);
    }
  }

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
            <ZScorePill value={anomaly.z_score} />
            <Badge
              fontSize="9px" px={2} py="2px" borderRadius="full"
              bg={meta.bg} color={meta.color} border="1px solid" borderColor={meta.border}
              fontWeight={700}
            >
              {meta.label}
            </Badge>
          </Flex>
        </Flex>

        <Flex gap={{ base: 3, sm: 4, md: 6 }} mb={3}>
          <Box>
            <Eyebrow mb={1}>Value</Eyebrow>
            <Text fontSize="lg" fontWeight={700} color={meta.color} sx={{ fontVariantNumeric: "tabular-nums" }}>
              {anomaly.value?.toFixed(3) ?? "—"}
            </Text>
          </Box>
          <Box>
            <Eyebrow mb={1}>Baseline</Eyebrow>
            <Text fontSize="lg" fontWeight={700} color="text.primary" sx={{ fontVariantNumeric: "tabular-nums" }}>
              {anomaly.baseline_mean?.toFixed(3) ?? "—"}
            </Text>
          </Box>
          <Box>
            <Eyebrow mb={1}>Std Dev</Eyebrow>
            <Text fontSize="lg" fontWeight={700} color="text.muted" sx={{ fontVariantNumeric: "tabular-nums" }}>
              ±{anomaly.baseline_std?.toFixed(3) ?? "—"}
            </Text>
          </Box>
        </Flex>

        {anomaly.description && (
          <Box
            bg="bg.chip" border="1px solid" borderColor="border.subtle"
            borderRadius="8px" px={3} py={2}
            mb={3}
          >
            <Text fontSize="xs" color="text.muted" lineHeight={1.6}>{anomaly.description}</Text>
          </Box>
        )}

        {/* Causal explanation + Create WO actions */}
        <Flex justify="flex-end" gap={2}>
          <Button
            size="xs"
            variant="ghost"
            leftIcon={<ClipboardList size={12} strokeWidth={2.2} />}
            isLoading={woLoading}
            onClick={createWorkOrder}
            color="accent.primary"
          >
            Create WO
          </Button>
          <Button
            size="xs"
            variant="ghost"
            leftIcon={<Sparkles size={12} strokeWidth={2.2} />}
            rightIcon={open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            onClick={() => (open ? setOpen(false) : loadExplanation())}
            color="accent.primary"
          >
            {open ? "Hide why" : "Explain why"}
          </Button>
        </Flex>

        <Collapse in={open} animateOpacity>
          <Box mt={3} pt={3} borderTop="1px solid" borderColor="border.subtle">
            {exLoad && (
              <Flex align="center" gap={2}>
                <Spinner size="xs" />
                <Text fontSize="xs" color="text.muted">Asking model for likely causes…</Text>
              </Flex>
            )}
            {exErr && <Text fontSize="xs" color="status.bad">{exErr}</Text>}
            {explain && (
              <Box>
                {explain.summary && (
                  <Text fontSize="xs" color="text.primary" mb={3}>{explain.summary}</Text>
                )}
                {(explain.likely_causes || []).length > 0 && (
                  <Box mb={3}>
                    <Eyebrow mb={2}>Likely causes</Eyebrow>
                    {explain.likely_causes.map((c, i) => (
                      <Flex key={i} align="flex-start" gap={2} py={1}>
                        <Badge
                          fontSize="9px" px={2} borderRadius="6px"
                          bg="bg.chip" border="1px solid" borderColor="border.subtle"
                          color={CONF_COLOR[c.confidence] || CONF_COLOR.low}
                        >
                          {c.confidence}
                        </Badge>
                        <Box flex="1">
                          <Text fontSize="xs" color="text.primary" fontWeight={600}>{c.cause}</Text>
                          {c.evidence && <Text fontSize="11px" color="text.muted" mt="2px">{c.evidence}</Text>}
                        </Box>
                      </Flex>
                    ))}
                  </Box>
                )}
                {(explain.recommended_checks || []).length > 0 && (
                  <Box>
                    <Eyebrow mb={2}>Recommended checks</Eyebrow>
                    {explain.recommended_checks.map((s, i) => (
                      <Flex key={i} align="flex-start" gap={2} py="2px">
                        <Box w="4px" h="4px" mt="7px" bg="accent.primary" borderRadius="full" flexShrink={0} />
                        <Text fontSize="xs" color="text.primary">{s}</Text>
                      </Flex>
                    ))}
                  </Box>
                )}
                {explain.status === "skipped" && (
                  <Text fontSize="xs" color="status.warn">⚠ Skipped: {explain.reason}</Text>
                )}
              </Box>
            )}
          </Box>
        </Collapse>
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
        icon={<PageHeaderIcon icon={<TriangleAlert size={20} strokeWidth={1.85} />} />}
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
            <Text fontSize="xs" color={s.color} fontWeight={700} sx={{ fontVariantNumeric: "tabular-nums" }}>
              {s.count}
            </Text>
            <Text fontSize="xs" color="text.muted">{s.label}</Text>
          </Flex>
        ))}
      </Flex>

      {loading ? (
        <Grid templateColumns={{ base: "1fr", lg: "1fr 1fr" }} gap={{ base: 3, md: 4 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <MotionBox key={i} variants={fadeUp} initial="initial" animate="animate">
              <SkeletonEquipCard />
            </MotionBox>
          ))}
        </Grid>
      ) : anomalies.length === 0 ? (
        <EmptyState />
      ) : (
        <MotionGrid variants={stagger} initial="initial" animate="animate" templateColumns={{ base: "1fr", lg: "1fr 1fr" }} gap={{ base: 3, md: 4 }}>
          {anomalies.map((a, i) => (
            <AnomalyCard key={`${a.equipment_id}-${a.metric}-${a.timestamp}-${i}`} anomaly={a} />
          ))}
        </MotionGrid>
      )}
    </PageShell>
  );
}
