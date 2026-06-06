import { useEffect, useState, useMemo } from "react";
import { Box, Flex, Text, Badge, Spinner, Select, Wrap, WrapItem } from "@chakra-ui/react";
import { Boxes, MapPin, Activity } from "lucide-react";
import PageShell from "../../shared/ui/PageShell";
import PageHeader from "../../shared/ui/PageHeader";
import PageHeaderIcon from "../../shared/ui/PageHeaderIcon";
import GlassCard from "../../shared/ui/GlassCard";
import Eyebrow from "../../shared/ui/Eyebrow";

const STATUS_COLOR = { active: "status.good", inactive: "text.muted" };

export default function AssetsPage() {
  const [assets, setAssets] = useState(null);
  const [types, setTypes] = useState([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch("/api/v1/assets").then(r => r.json()),
      fetch("/api/v1/assets/types").then(r => r.json()),
    ])
      .then(([a, t]) => { if (alive) { setAssets(a.assets || []); setTypes(t.types || []); } })
      .catch(() => { if (alive) setAssets([]); });
    return () => { alive = false; };
  }, []);

  const shown = useMemo(
    () => (assets || []).filter(a => !filter || a.ss_type === filter),
    [assets, filter],
  );
  const total = assets?.length ?? 0;
  const monitored = (assets || []).filter(a => a.monitored).length;

  return (
    <PageShell>
      <PageHeader
        title="Asset Registry"
        icon={<PageHeaderIcon icon={<Boxes size={20} strokeWidth={1.85} />} />}
        subtitle={`Plant equipment & meters from the IBMS registry — ${total} assets, ${monitored} with live telemetry`}
      />

      {/* Type summary chips (click to filter) */}
      <Box mb={5}>
        <Eyebrow mb={2}>By type</Eyebrow>
        <Wrap spacing={2}>
          <WrapItem>
            <Box as="button" onClick={() => setFilter("")}
              px={3} py="6px" borderRadius="10px" fontSize="12px" fontWeight={600}
              bg={filter === "" ? "accent.glow" : "bg.chip"}
              color={filter === "" ? "text.brand" : "text.secondary"}
              border="1px solid" borderColor={filter === "" ? "border.brand" : "border.subtle"}>
              All ({total})
            </Box>
          </WrapItem>
          {types.map(t => (
            <WrapItem key={t.ss_type}>
              <Box as="button" onClick={() => setFilter(t.ss_type)}
                px={3} py="6px" borderRadius="10px" fontSize="12px" fontWeight={600}
                bg={filter === t.ss_type ? "accent.glow" : "bg.chip"}
                color={filter === t.ss_type ? "text.brand" : "text.secondary"}
                border="1px solid" borderColor={filter === t.ss_type ? "border.brand" : "border.subtle"}>
                {t.type_label} ({t.count})
              </Box>
            </WrapItem>
          ))}
        </Wrap>
      </Box>

      <GlassCard p={2}>
        {/* header row */}
        <Flex align="center" gap={3} px={3} py="8px" display={{ base: "none", md: "flex" }}>
          <Text flex="2" fontSize="10px" fontWeight={700} color="text.faint" textTransform="uppercase" letterSpacing="0.08em">Asset</Text>
          <Text flex="1.4" fontSize="10px" fontWeight={700} color="text.faint" textTransform="uppercase" letterSpacing="0.08em">Type</Text>
          <Text flex="1" fontSize="10px" fontWeight={700} color="text.faint" textTransform="uppercase" letterSpacing="0.08em">Status</Text>
          <Text flex="1.4" fontSize="10px" fontWeight={700} color="text.faint" textTransform="uppercase" letterSpacing="0.08em">Zone</Text>
          <Text flex="1.6" fontSize="10px" fontWeight={700} color="text.faint" textTransform="uppercase" letterSpacing="0.08em">Address</Text>
        </Flex>

        {assets === null && (
          <Flex align="center" gap={2} px={3} py={4} color="text.muted"><Spinner size="xs" /><Text fontSize="sm">Loading asset registry…</Text></Flex>
        )}
        {assets !== null && shown.length === 0 && (
          <Text px={3} py={4} fontSize="sm" color="text.muted">No assets match this filter.</Text>
        )}

        {shown.map(a => (
          <Flex key={a.id} align="center" gap={3} px={3} py="10px" borderRadius="10px"
            _hover={{ bg: "rgba(31,63,254,0.04)" }} transition="background 0.15s"
            flexWrap={{ base: "wrap", md: "nowrap" }}>
            <Flex flex={{ base: "1 0 100%", md: "2" }} align="center" gap={2} minW={0}>
              <Box w="26px" h="26px" borderRadius="7px" flexShrink={0} display="flex" alignItems="center" justifyContent="center"
                bg="accent.glow" border="1px solid" borderColor="border.brand" color="accent.primary">
                <Activity size={13} strokeWidth={2} />
              </Box>
              <Text fontSize="sm" fontWeight={700} color="text.primary" noOfLines={1}>{a.name}</Text>
              {a.monitored && (
                <Badge fontSize="8px" bg="accent.glow" color="text.brand" border="1px solid" borderColor="border.brand" borderRadius="5px" px="5px">LIVE</Badge>
              )}
            </Flex>
            <Text flex={{ base: "1 0 auto", md: "1.4" }} fontSize="13px" color="text.secondary" noOfLines={1}>{a.type_label}</Text>
            <Box flex={{ base: "0 0 auto", md: "1" }}>
              <Badge fontSize="9px" bg="bg.chip" color={STATUS_COLOR[a.status] || "text.muted"} border="1px solid" borderColor="border.subtle" borderRadius="6px" px={2} py="2px">{a.status}</Badge>
            </Box>
            <Flex flex={{ base: "1 0 auto", md: "1.4" }} align="center" gap={1} color="text.muted" minW={0}>
              {a.zone_name ? (<><MapPin size={11} /><Text fontSize="12px" noOfLines={1}>{a.zone_name}</Text></>) : <Text fontSize="12px" color="text.faint">—</Text>}
            </Flex>
            <Text flex={{ base: "1 0 auto", md: "1.6" }} fontSize="11px" fontFamily="mono" color="text.faint" noOfLines={1} title={a.address || ""}>{a.address || "—"}</Text>
          </Flex>
        ))}
      </GlassCard>
    </PageShell>
  );
}
