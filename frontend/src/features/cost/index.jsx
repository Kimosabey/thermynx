import { useState, useEffect } from "react";
import { Box, Flex, Text, Grid, Table, Thead, Tbody, Tr, Th, Td } from "@chakra-ui/react";
import { motion } from "framer-motion";
import PageShell from "../../shared/ui/PageShell";
import PageHeader from "../../shared/ui/PageHeader";
import PeriodSelect from "../../shared/ui/PeriodSelect";
import GlassCard from "../../shared/ui/GlassCard";

const MotionBox = motion(Box);

export default function CostPage() {
  const [hours, setHours] = useState(24);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/v1/cost?hours=${hours}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [hours]);

  const eq = data?.equipment || [];

  return (
    <PageShell>
      <PageHeader
        title="Cost Analytics"
        subtitle="Electrical energy from bucketed kW × flat ₹/kWh · ₹/TR-h on chillers"
        actions={<PeriodSelect value={hours} onChange={setHours} />}
      />

      <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap={4} mb={8}>
        {[
          { label: "Plant kWh", value: data?.total_kwh != null ? data.total_kwh.toFixed(2) : "—", accent: "accent.cyan" },
          { label: "Plant cost", value: data?.total_cost_inr != null ? `₹ ${data.total_cost_inr.toLocaleString()}` : "—", accent: "green.400" },
          { label: "Tariff", value: data?.tariff_inr_per_kwh != null ? `₹ ${data.tariff_inr_per_kwh}/kWh` : "—", accent: "purple.400" },
        ].map((k) => (
          <MotionBox key={k.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <GlassCard>
              <Text fontSize="10px" color="text.muted" textTransform="uppercase" letterSpacing="0.1em" fontWeight={700} mb={2}>{k.label}</Text>
              <Text fontSize="2xl" fontWeight={800} color={k.accent} fontVariantNumeric="tabular-nums">{loading ? "…" : k.value}</Text>
            </GlassCard>
          </MotionBox>
        ))}
      </Grid>

      <GlassCard p={0} overflow="hidden">
        <Box px={5} py={4} borderBottom="1px solid" borderColor="border.subtle">
          <Text fontWeight={700} fontSize="sm">Equipment rollup</Text>
          <Text fontSize="xs" color="text.muted">15-minute buckets · energy gated on is_running</Text>
        </Box>
        <Box overflowX="auto">
          <Table size="sm">
            <Thead>
              <Tr>
                <Th color="text.muted">Equipment</Th>
                <Th color="text.muted">Type</Th>
                <Th isNumeric color="text.muted">kWh</Th>
                <Th isNumeric color="text.muted">INR</Th>
                <Th isNumeric color="text.muted">Run h</Th>
                <Th isNumeric color="text.muted">₹/TR-h</Th>
              </Tr>
            </Thead>
            <Tbody>
              {eq.map((row) => (
                <Tr key={row.equipment_id}>
                  <Td fontWeight={600}>{row.name}</Td>
                  <Td>{row.type}</Td>
                  <Td isNumeric fontVariantNumeric="tabular-nums">{row.kwh?.toFixed(3)}</Td>
                  <Td isNumeric fontVariantNumeric="tabular-nums">₹ {row.cost_inr?.toFixed(2)}</Td>
                  <Td isNumeric>{row.run_hours?.toFixed(2) ?? "—"}</Td>
                  <Td isNumeric>{row.inr_per_tr_hr?.toFixed(4) ?? "—"}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      </GlassCard>
    </PageShell>
  );
}
