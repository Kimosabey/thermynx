import { useEffect, useState } from "react";
import { Box, Flex, Text, Select, Spinner, SimpleGrid } from "@chakra-ui/react";
import { Zap, IndianRupee, Gauge } from "lucide-react";
import PageShell from "../../shared/ui/PageShell";
import PageHeader from "../../shared/ui/PageHeader";
import PageHeaderIcon from "../../shared/ui/PageHeaderIcon";
import GlassCard from "../../shared/ui/GlassCard";
import Eyebrow from "../../shared/ui/Eyebrow";

const fmt = (n) => (n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 });

function Stat({ icon, label, value, sub }) {
  return (
    <GlassCard p={4}>
      <Flex align="center" gap={2} color="text.muted" mb={1}>{icon}<Text fontSize="11px" textTransform="uppercase" letterSpacing="0.08em">{label}</Text></Flex>
      <Text fontSize="26px" fontWeight={800} color="text.primary" lineHeight="1.1">{value}</Text>
      {sub && <Text fontSize="11px" color="text.faint" mt={1}>{sub}</Text>}
    </GlassCard>
  );
}

export default function EnergyPage() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const [meters, setMeters] = useState(0);

  useEffect(() => {
    let alive = true;
    setData(null);
    Promise.all([
      fetch(`/api/v1/energy/cost?period=daily&days=${days}`).then(r => r.json()),
      fetch(`/api/v1/energy/meters`).then(r => r.json()),
    ]).then(([c, m]) => { if (alive) { setData(c); setMeters(m.total || 0); } })
      .catch(() => { if (alive) setData({ by_device: [], by_type: [], total_kwh: 0, total_cost_inr: 0 }); });
    return () => { alive = false; };
  }, [days]);

  const maxType = Math.max(1, ...(data?.by_type || []).map(t => t.kwh));

  return (
    <PageShell>
      <PageHeader
        title="Energy Management"
        icon={<PageHeaderIcon icon={<Zap size={20} strokeWidth={1.85} />} />}
        subtitle="Plant energy consumption & cost from the IBMS energy meters"
        actions={
          <Select size="sm" w="130px" value={days} onChange={e => setDays(Number(e.target.value))}
            bg="bg.surface" borderColor="border.subtle" borderRadius="10px">
            <option value={1}>Last 1 day</option>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </Select>
        }
      />

      {data === null ? (
        <Flex align="center" gap={2} color="text.muted" py={6}><Spinner size="sm" /><Text>Loading energy data…</Text></Flex>
      ) : (
        <>
          <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={3} mb={5}>
            <Stat icon={<Zap size={14} />} label="Total energy" value={`${fmt(data.total_kwh)} kWh`} sub={`last ${data.days} days`} />
            <Stat icon={<IndianRupee size={14} />} label="Total cost" value={`₹${fmt(data.total_cost_inr)}`} sub={`@ ₹${data.tariff_inr_per_kwh}/kWh · ${data.tariff_source}`} />
            <Stat icon={<Gauge size={14} />} label="Energy meters" value={meters} sub="IBMS EMS subsystems" />
          </SimpleGrid>

          <Box mb={5}>
            <Eyebrow mb={2}>By equipment type</Eyebrow>
            <GlassCard p={4}>
              {(data.by_type || []).map(t => (
                <Box key={t.device_type} mb={3}>
                  <Flex justify="space-between" mb={1}>
                    <Text fontSize="13px" fontWeight={600} color="text.secondary">{t.device_type}</Text>
                    <Text fontSize="13px" color="text.muted">{fmt(t.kwh)} kWh · ₹{fmt(t.cost_inr)}</Text>
                  </Flex>
                  <Box h="8px" bg="bg.chip" borderRadius="full" overflow="hidden">
                    <Box h="100%" w={`${Math.round((t.kwh / maxType) * 100)}%`} bg="brand.500" borderRadius="full" />
                  </Box>
                </Box>
              ))}
            </GlassCard>
          </Box>

          <Eyebrow mb={2}>By device</Eyebrow>
          <GlassCard p={2}>
            <Flex px={3} py="8px" display={{ base: "none", md: "flex" }}>
              <Text flex="2" fontSize="10px" fontWeight={700} color="text.faint" textTransform="uppercase">Device</Text>
              <Text flex="1.2" fontSize="10px" fontWeight={700} color="text.faint" textTransform="uppercase">Type</Text>
              <Text flex="1" fontSize="10px" fontWeight={700} color="text.faint" textTransform="uppercase" textAlign="right">kWh</Text>
              <Text flex="1" fontSize="10px" fontWeight={700} color="text.faint" textTransform="uppercase" textAlign="right">Cost</Text>
            </Flex>
            {(data.by_device || []).map(d => (
              <Flex key={d.device_id} px={3} py="9px" borderRadius="10px" _hover={{ bg: "rgba(31,63,254,0.04)" }} align="center">
                <Text flex="2" fontSize="13px" fontWeight={600} color="text.primary" noOfLines={1}>{d.name || d.device_id}</Text>
                <Text flex="1.2" fontSize="12px" color="text.secondary">{d.device_type}</Text>
                <Text flex="1" fontSize="13px" color="text.secondary" textAlign="right" fontVariantNumeric="tabular-nums">{fmt(d.kwh)}</Text>
                <Text flex="1" fontSize="13px" color="text.muted" textAlign="right" fontVariantNumeric="tabular-nums">₹{fmt(d.cost_inr)}</Text>
              </Flex>
            ))}
          </GlassCard>
        </>
      )}
    </PageShell>
  );
}
