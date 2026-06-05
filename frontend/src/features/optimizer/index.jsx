import { useState } from "react";
import {
  Box, Flex, Text, Grid, Button, Input, Badge, Table, Thead, Tbody, Tr, Th, Td, Spinner, useToast,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import { Gauge, Sparkles, CheckCircle2, ClipboardList } from "lucide-react";
import PageShell from "../../shared/ui/PageShell";
import PageHeader from "../../shared/ui/PageHeader";
import PageHeaderIcon from "../../shared/ui/PageHeaderIcon";
import Eyebrow from "../../shared/ui/Eyebrow";
import GlassCard from "../../shared/ui/GlassCard";
import ErrorAlert from "../../shared/ui/ErrorAlert";
import useApi from "../../shared/hooks/useApi";
import { apiFetch } from "../../shared/api/client";

const MotionBox = motion.create(Box);
const fmt = (v, d = 1) => (v == null ? "—" : Number(v).toLocaleString(undefined, { maximumFractionDigits: d }));

function Kpi({ label, value, accent, sub }) {
  return (
    <GlassCard>
      <Eyebrow mb={2}>{label}</Eyebrow>
      <Text fontSize="2xl" fontWeight={800} color={accent} sx={{ fontVariantNumeric: "tabular-nums" }}>{value}</Text>
      {sub && <Text fontSize="xs" color="text.muted" mt={1}>{sub}</Text>}
    </GlassCard>
  );
}

export default function EnergyOptimizerPage() {
  const [whatIf, setWhatIf] = useState("");      // target TR override (string)
  const [appliedTr, setAppliedTr] = useState(null);
  const toast = useToast();
  const [creating, setCreating] = useState(false);

  const url = `/api/v1/optimizer/staging?hours=72${appliedTr ? `&target_tr=${appliedTr}` : ""}`;
  const { data, isLoading, error, refetch } = useApi(url);

  const rec = data?.recommended;
  const saves = data?.savings_kw != null && data.savings_kw > 0;
  const wo = data?.proposed_work_order;

  async function createWorkOrder() {
    if (!wo) return;
    setCreating(true);
    try {
      const res = await apiFetch("/api/v1/work-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...wo, created_by: "operator" }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `HTTP ${res.status}`);
      toast({ title: "Work order created", description: wo.title, status: "success", duration: 4000 });
    } catch (e) {
      toast({ title: "Failed to create work order", description: e.message, status: "error", duration: 5000 });
    } finally {
      setCreating(false);
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Energy Optimizer"
        subtitle="Lowest-energy chiller staging for the cooling demand · deterministic math, human-approved actions"
        icon={<PageHeaderIcon icon={<Gauge size={20} strokeWidth={1.85} />} />}
        actions={
          <Flex gap={2} align="center">
            <Input
              size="sm" w="150px" placeholder="What-if TR"
              value={whatIf} onChange={(e) => setWhatIf(e.target.value.replace(/[^0-9.]/g, ""))}
              onKeyDown={(e) => { if (e.key === "Enter") setAppliedTr(whatIf || null); }}
            />
            <Button size="sm" onClick={() => setAppliedTr(whatIf || null)}>Simulate</Button>
            {appliedTr && <Button size="sm" variant="ghost" onClick={() => { setWhatIf(""); setAppliedTr(null); }}>reset</Button>}
          </Flex>
        }
      />

      <ErrorAlert error={error} onRetry={refetch} />

      {isLoading ? (
        <Flex h="40vh" align="center" justify="center"><Spinner size="lg" color="accent.primary" thickness="3px" /></Flex>
      ) : !data ? null : (
        <>
          <Grid templateColumns={{ base: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" }} gap={4} mb={6}>
            <Kpi label="Target demand" value={`${fmt(data.target_tr)} TR`} accent="accent.cyan" sub={data.target_source === "user" ? "what-if" : "observed now"} />
            <Kpi label="Current staging" value={data.current_chillers?.length ? `${data.current_chillers.length} on` : "none"} accent="text.primary" sub={data.current_est_kw != null ? `est ${fmt(data.current_est_kw)} kW` : "—"} />
            <Kpi label="Recommended" value={rec ? rec.label : "—"} accent={saves ? "green.400" : "text.primary"} sub={rec ? `est ${fmt(rec.est_kw)} kW` : ""} />
            <Kpi label="Potential saving" value={saves ? `${fmt(data.savings_kw)} kW` : "0"} accent={saves ? "green.400" : "text.muted"} sub={saves ? `${fmt(data.savings_pct)}% · ₹${fmt(data.savings_inr_per_hr)}/h` : "already optimal"} />
          </Grid>

          {/* Recommendation + narrative */}
          <MotionBox initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} mb={6}>
            <GlassCard>
              <Flex align="center" gap={2} mb={2}>
                {saves ? <Sparkles size={16} strokeWidth={2} /> : <CheckCircle2 size={16} strokeWidth={2} />}
                <Eyebrow mb={0}>{saves ? "Recommendation" : "Status"}</Eyebrow>
              </Flex>
              <Text fontSize="md" mb={data.rationale?.length ? 2 : 0}>
                {data.narrative || (data.rationale || []).join(" ") || "No recommendation available for this demand."}
              </Text>
              {saves && wo && (
                <Button mt={3} size="sm" colorScheme="blue" leftIcon={<ClipboardList size={15} />} onClick={createWorkOrder} isDisabled={creating}>
                  {creating ? "Creating…" : "Create work order (approve)"}
                </Button>
              )}
            </GlassCard>
          </MotionBox>

          {/* Options table */}
          <GlassCard p={0} overflow="hidden" mb={6}>
            <Box px={5} py={4} borderBottom="1px solid" borderColor="border.subtle">
              <Text fontWeight={700} fontSize="sm">Staging options @ {fmt(data.target_tr)} TR</Text>
            </Box>
            <Box overflowX="auto">
              <Table size="sm">
                <Thead>
                  <Tr><Th color="text.muted">Configuration</Th><Th isNumeric color="text.muted">Est. kW</Th><Th color="text.muted">Feasible</Th><Th color="text.muted"></Th></Tr>
                </Thead>
                <Tbody>
                  {(data.options || []).map((o) => {
                    const isRec = rec && o.label === rec.label;
                    return (
                      <Tr key={o.label} bg={isRec ? "accent.glow" : undefined}>
                        <Td fontWeight={isRec ? 700 : 500}>{o.label}</Td>
                        <Td isNumeric sx={{ fontVariantNumeric: "tabular-nums" }}>{o.feasible ? fmt(o.est_kw) : "—"}</Td>
                        <Td>{o.feasible ? <Badge colorScheme="green" variant="subtle">yes</Badge> : <Badge colorScheme="gray" variant="subtle">{o.note || "no"}</Badge>}</Td>
                        <Td>{isRec && <Badge colorScheme="blue">recommended</Badge>}</Td>
                      </Tr>
                    );
                  })}
                </Tbody>
              </Table>
            </Box>
          </GlassCard>

          {/* Profiles */}
          <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }} gap={4}>
            {(data.profiles || []).map((p) => (
              <GlassCard key={p.equipment_id}>
                <Flex justify="space-between" align="center" mb={2}>
                  <Text fontWeight={700} fontSize="sm">{p.name}</Text>
                  <Badge colorScheme={p.currently_running ? "green" : "gray"} variant="subtle">{p.currently_running ? "running" : "off"}</Badge>
                </Flex>
                <Grid templateColumns="repeat(2, 1fr)" gap={2} fontSize="xs" color="text.muted">
                  <Text>Capacity: <b>{fmt(p.capacity_tr)} TR</b></Text>
                  <Text>Avg kW/TR: <b>{fmt(p.overall_kw_per_tr, 3)}</b></Text>
                  <Text>Now: <b>{fmt(p.latest_tr)} TR</b></Text>
                  <Text>Samples: <b>{p.samples}</b></Text>
                </Grid>
              </GlassCard>
            ))}
          </Grid>
        </>
      )}
    </PageShell>
  );
}
