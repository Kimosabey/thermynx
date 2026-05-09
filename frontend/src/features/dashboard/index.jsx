import { useEffect, useState } from "react";
import { Box, Flex, Grid, Heading, Text, Badge } from "@chakra-ui/react";
import { motion } from "framer-motion";
import GlassCard from "../../shared/ui/GlassCard";
import KpiCard from "../../shared/ui/KpiCard";
import StatusPulse from "../../shared/ui/StatusPulse";
import { SkeletonKpiCard, SkeletonEquipCard } from "../../shared/ui/SkeletonCard";

const MotionBox  = motion(Box);
const MotionGrid = motion(Grid);

const stagger = {
  animate: { transition: { staggerChildren: 0.06 } },
};
const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } },
};

function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
  );
}

function EquipCard({ name, data, type }) {
  const running = data?.running_pct;
  const isOn = running != null && running > 0;
  const kwPerTr = data?.avg_kw_per_tr;
  const band = kwPerTr == null ? null : kwPerTr < 0.65 ? "good" : kwPerTr < 0.85 ? "warn" : "bad";
  const bandColor = { good: "green.400", warn: "yellow.400", bad: "red.400" }[band] ?? "text.muted";

  return (
    <MotionBox variants={fadeUp}>
      <GlassCard p={4}>
        <Flex justify="space-between" align="center" mb={4}>
          <Flex align="center" gap={2}>
            <StatusPulse active={isOn} />
            <Text fontWeight={600} fontSize="sm" color="text.primary">{name}</Text>
          </Flex>
          <Badge
            fontSize="9px"
            fontWeight={700}
            px={2} py="2px"
            borderRadius="6px"
            bg={isOn ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.05)"}
            color={isOn ? "green.400" : "text.muted"}
            border="1px solid"
            borderColor={isOn ? "rgba(16,185,129,0.3)" : "border.subtle"}
          >
            {isOn ? "RUNNING" : "STANDBY"}
          </Badge>
        </Flex>

        <Grid templateColumns="1fr 1fr" gap={3}>
          <Box>
            <Text fontSize="9px" color="text.muted" textTransform="uppercase" letterSpacing="0.1em" fontWeight={700} mb={1}>Avg kW</Text>
            <Text fontSize="lg" fontWeight={700} color="text.primary" fontVariantNumeric="tabular-nums">
              {data?.avg_kw != null ? Number(data.avg_kw).toFixed(1) : "—"}
            </Text>
          </Box>
          <Box>
            <Text fontSize="9px" color="text.muted" textTransform="uppercase" letterSpacing="0.1em" fontWeight={700} mb={1}>Run %</Text>
            <Text fontSize="lg" fontWeight={700} color="text.primary" fontVariantNumeric="tabular-nums">
              {running != null ? `${running}%` : "—"}
            </Text>
          </Box>
          {type === "chiller" && (
            <>
              <Box>
                <Text fontSize="9px" color="text.muted" textTransform="uppercase" letterSpacing="0.1em" fontWeight={700} mb={1}>kW/TR</Text>
                <Text fontSize="lg" fontWeight={700} color={bandColor} fontVariantNumeric="tabular-nums">
                  {kwPerTr != null ? kwPerTr.toFixed(3) : "—"}
                </Text>
              </Box>
              <Box>
                <Text fontSize="9px" color="text.muted" textTransform="uppercase" letterSpacing="0.1em" fontWeight={700} mb={1}>Load</Text>
                <Text fontSize="lg" fontWeight={700} color="text.primary" fontVariantNumeric="tabular-nums">
                  {data?.avg_chiller_load != null ? `${Number(data.avg_chiller_load).toFixed(1)}%` : "—"}
                </Text>
              </Box>
            </>
          )}
        </Grid>
      </GlassCard>
    </MotionBox>
  );
}

export default function Dashboard() {
  const [health, setHealth]     = useState(null);
  const [summary, setSummary]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [error, setError]       = useState(null);

  async function loadData() {
    setSpinning(true);
    setError(null);
    try {
      const [hRes, eRes] = await Promise.all([
        fetch("/api/v1/health"),
        fetch("/api/v1/equipment/summary?hours=24"),
      ]);
      setHealth(await hRes.json());
      const eq = await eRes.json();
      setSummary(eq.summary);
    } catch {
      setError("Cannot reach backend. Is the server running?");
    } finally {
      setLoading(false);
      setSpinning(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const s = summary || {};
  const dbOk     = health?.db?.connected;
  const ollamaOk = health?.ollama?.connected;

  return (
    <Box p={{ base: 4, md: 8 }} maxW="1400px">

      {/* Header */}
      <Flex justify="space-between" align="flex-start" mb={8} flexWrap="wrap" gap={4}>
        <Box>
          <Heading
            size="lg" fontWeight={800} color="text.primary"
            letterSpacing="-0.02em"
          >
            Operations Dashboard
          </Heading>
          <Text color="text.muted" mt={1} fontSize="sm">
            Unicharm HVAC Plant · Last 24 hours
          </Text>
        </Box>

        <Flex align="center" gap={3} flexWrap="wrap">
          {/* System status chips */}
          <Flex
            align="center" gap={2}
            bg="bg.surface"
            border="1px solid"
            borderColor="border.subtle"
            borderRadius="10px"
            px={3} py={2}
          >
            <StatusPulse active={dbOk} size="7px" />
            <Text fontSize="xs" color={dbOk ? "green.400" : "red.400"} fontWeight={500}>DB</Text>
          </Flex>

          <Flex
            align="center" gap={2}
            bg="bg.surface"
            border="1px solid"
            borderColor="border.subtle"
            borderRadius="10px"
            px={3} py={2}
          >
            <StatusPulse active={ollamaOk} size="7px" />
            <Text fontSize="xs" color={ollamaOk ? "green.400" : "red.400"} fontWeight={500}>
              {health?.ollama?.default_model ?? "Ollama"}
            </Text>
          </Flex>

          <MotionBox whileTap={{ scale: 0.92 }}>
            <Box
              as="button"
              onClick={loadData}
              w="34px" h="34px"
              borderRadius="10px"
              bg="bg.surface"
              border="1px solid"
              borderColor="border.subtle"
              display="flex" alignItems="center" justifyContent="center"
              color="text.muted"
              _hover={{ borderColor: "accent.cyan", color: "accent.cyan" }}
              transition="all 0.15s"
            >
              <MotionBox animate={{ rotate: spinning ? 360 : 0 }} transition={{ duration: 0.6 }}>
                <RefreshIcon />
              </MotionBox>
            </Box>
          </MotionBox>
        </Flex>
      </Flex>

      {error && (
        <GlassCard mb={6} p={4}>
          <Text color="red.400" fontSize="sm">{error}</Text>
        </GlassCard>
      )}

      {/* KPI Strip */}
      <MotionGrid
        variants={stagger}
        initial="initial"
        animate="animate"
        templateColumns={{ base: "1fr 1fr", sm: "repeat(3, 1fr)", lg: "repeat(6, 1fr)" }}
        gap={4} mb={6}
      >
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <MotionBox key={i} variants={fadeUp}><SkeletonKpiCard /></MotionBox>
          ))
        ) : (
          <>
            <MotionBox variants={fadeUp}>
              <KpiCard
                label="Chiller 1 kW/TR"
                value={s.chiller_1?.avg_kw_per_tr}
                decimals={3}
                accent={
                  s.chiller_1?.avg_kw_per_tr == null ? "text.muted"
                    : s.chiller_1.avg_kw_per_tr < 0.65 ? "green.400"
                    : s.chiller_1.avg_kw_per_tr < 0.85 ? "yellow.400" : "red.400"
                }
                helpText="Efficiency"
              />
            </MotionBox>
            <MotionBox variants={fadeUp}>
              <KpiCard
                label="Chiller 2 kW/TR"
                value={s.chiller_2?.avg_kw_per_tr}
                decimals={3}
                accent={
                  s.chiller_2?.avg_kw_per_tr == null ? "text.muted"
                    : s.chiller_2.avg_kw_per_tr < 0.65 ? "green.400"
                    : s.chiller_2.avg_kw_per_tr < 0.85 ? "yellow.400" : "red.400"
                }
                helpText="Efficiency"
              />
            </MotionBox>
            <MotionBox variants={fadeUp}>
              <KpiCard label="CH1 Load" value={s.chiller_1?.avg_chiller_load} unit="%" decimals={1} />
            </MotionBox>
            <MotionBox variants={fadeUp}>
              <KpiCard label="CH2 Load" value={s.chiller_2?.avg_chiller_load} unit="%" decimals={1} />
            </MotionBox>
            <MotionBox variants={fadeUp}>
              <KpiCard label="Ambient" value={s.chiller_1?.latest_ambient_temp} unit="°C" decimals={1} />
            </MotionBox>
            <MotionBox variants={fadeUp}>
              <KpiCard label="CHW Supply" value={s.chiller_1?.latest_evap_leaving} unit="°C" decimals={1} />
            </MotionBox>
          </>
        )}
      </MotionGrid>

      {/* Equipment Grid */}
      <Text
        fontSize="10px" fontWeight={700} color="text.muted"
        textTransform="uppercase" letterSpacing="0.1em" mb={4}
      >
        Equipment Overview
      </Text>

      <MotionGrid
        variants={stagger}
        initial="initial"
        animate="animate"
        templateColumns={{ base: "1fr", sm: "1fr 1fr", lg: "repeat(3, 1fr)" }}
        gap={4}
      >
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <MotionBox key={i} variants={fadeUp}><SkeletonEquipCard /></MotionBox>
          ))
        ) : (
          <>
            <EquipCard name="Chiller 1"          data={s.chiller_1}        type="chiller" />
            <EquipCard name="Chiller 2"          data={s.chiller_2}        type="chiller" />
            <EquipCard name="Cooling Tower 1"    data={s.cooling_tower_1}  type="ct" />
            <EquipCard name="Cooling Tower 2"    data={s.cooling_tower_2}  type="ct" />
            <EquipCard name="Condenser Pump 1-2" data={s.condenser_pump_1} type="pump" />
            <EquipCard name="Condenser Pump 3"   data={s.condenser_pump_3} type="pump" />
          </>
        )}
      </MotionGrid>
    </Box>
  );
}
