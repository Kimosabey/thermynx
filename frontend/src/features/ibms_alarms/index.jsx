import { useEffect, useState, useCallback } from "react";
import { Box, Flex, Text, Badge, Spinner, Button, useToast } from "@chakra-ui/react";
import { BellRing, Check, ClipboardPlus } from "lucide-react";
import PageShell from "../../shared/ui/PageShell";
import PageHeader from "../../shared/ui/PageHeader";
import PageHeaderIcon from "../../shared/ui/PageHeaderIcon";
import GlassCard from "../../shared/ui/GlassCard";

export default function IbmsAlarmsPage() {
  const [alarms, setAlarms] = useState(null);
  const [busy, setBusy] = useState(null);
  const toast = useToast();

  const load = useCallback(() => {
    fetch("/api/v1/alarms/ibms?limit=100")
      .then(r => r.json())
      .then(d => setAlarms(d.alarms || []))
      .catch(() => setAlarms([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function act(id, kind) {
    setBusy(`${id}:${kind}`);
    try {
      const body = kind === "ack"
        ? { acknowledged_by: "operator" }
        : { created_by: "operator", priority: "high" };
      const r = await fetch(`/api/v1/alarms/ibms/${id}/${kind === "ack" ? "ack" : "raise-wo"}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "failed");
      toast({ title: kind === "ack" ? "Acknowledged" : `Work order ${d.work_order_id?.slice(0, 8)} raised`,
        status: "success", duration: 1800, position: "bottom-right" });
      load();
    } catch (e) {
      toast({ title: "Action failed", description: String(e.message || e), status: "error", duration: 2200 });
    } finally { setBusy(null); }
  }

  return (
    <PageShell>
      <PageHeader
        title="IBMS Alarms"
        icon={<PageHeaderIcon icon={<BellRing size={20} strokeWidth={1.85} />} />}
        subtitle="Building-management alarm log — acknowledge or raise a work order"
      />
      <GlassCard p={2}>
        <Flex px={3} py="8px" display={{ base: "none", md: "flex" }} gap={3}>
          <Text flex="1.4" fontSize="10px" fontWeight={700} color="text.faint" textTransform="uppercase">Asset</Text>
          <Text flex="2.4" fontSize="10px" fontWeight={700} color="text.faint" textTransform="uppercase">Message</Text>
          <Text flex="1" fontSize="10px" fontWeight={700} color="text.faint" textTransform="uppercase">State</Text>
          <Text flex="1.4" fontSize="10px" fontWeight={700} color="text.faint" textTransform="uppercase" textAlign="right">Actions</Text>
        </Flex>
        {alarms === null && <Flex align="center" gap={2} px={3} py={4} color="text.muted"><Spinner size="xs" /><Text fontSize="sm">Loading alarms…</Text></Flex>}
        {alarms?.length === 0 && <Text px={3} py={4} fontSize="sm" color="text.muted">No alarms.</Text>}
        {(alarms || []).map(a => (
          <Flex key={a.id} px={3} py="10px" borderRadius="10px" _hover={{ bg: "rgba(31,63,254,0.04)" }} align="center" gap={3} flexWrap={{ base: "wrap", md: "nowrap" }}>
            <Flex flex={{ base: "1 0 100%", md: "1.4" }} direction="column" minW={0}>
              <Text fontSize="13px" fontWeight={700} color="text.primary" noOfLines={1}>{a.asset_name || "—"}</Text>
              <Text fontSize="10px" color="text.faint">{a.asset_type} · #{a.id}</Text>
            </Flex>
            <Text flex={{ base: "1 0 auto", md: "2.4" }} fontSize="13px" color="text.secondary" noOfLines={1} title={a.message}>{a.message}</Text>
            <Flex flex={{ base: "0 0 auto", md: "1" }} gap={1}>
              <Badge fontSize="9px" borderRadius="6px" px={2} py="2px"
                bg={a.active ? "rgba(220,38,38,0.12)" : "bg.chip"} color={a.active ? "status.bad" : "text.muted"}
                border="1px solid" borderColor="border.subtle">{a.active ? "active" : "restored"}</Badge>
              {a.action?.operator_acked && <Badge fontSize="9px" borderRadius="6px" px={2} py="2px" bg="accent.glow" color="text.brand">acked</Badge>}
            </Flex>
            <Flex flex={{ base: "1 0 auto", md: "1.4" }} gap={2} justify="flex-end">
              <Button size="xs" variant="ghost" leftIcon={<Check size={12} />} isLoading={busy === `${a.id}:ack`}
                onClick={() => act(a.id, "ack")} isDisabled={a.action?.operator_acked}>Ack</Button>
              <Button size="xs" variant="outline" leftIcon={<ClipboardPlus size={12} />} isLoading={busy === `${a.id}:wo`}
                onClick={() => act(a.id, "wo")} isDisabled={!!a.action?.wo_id}>
                {a.action?.wo_id ? "WO raised" : "Raise WO"}</Button>
            </Flex>
          </Flex>
        ))}
      </GlassCard>
    </PageShell>
  );
}
