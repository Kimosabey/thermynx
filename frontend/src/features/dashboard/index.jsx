import { useState, useCallback, useEffect, useRef } from "react";
import { Box, Flex, Grid, Text, Badge } from "@chakra-ui/react";
import { LayoutDashboard } from "lucide-react";
import { motion } from "framer-motion";
import {
  RefreshCw,
  Database,
  Cpu,
  Gauge,
  ThermometerSun,
  Droplets,
  Snowflake,
  Fan,
  Waves,
} from "lucide-react";
import PageShell from "../../shared/ui/PageShell";
import PageHeader from "../../shared/ui/PageHeader";
import GlassCard from "../../shared/ui/GlassCard";
import KpiCard from "../../shared/ui/KpiCard";
import StatusPulse from "../../shared/ui/StatusPulse";
import ErrorAlert from "../../shared/ui/ErrorAlert";
import PageHeaderIcon from "../../shared/ui/PageHeaderIcon";
import Eyebrow from "../../shared/ui/Eyebrow";
import useApi from "../../shared/hooks/useApi";
import { SkeletonKpiCard, SkeletonEquipCard } from "../../shared/ui/SkeletonCard";

const MotionBox  = motion.create(Box);
const MotionGrid = motion.create(Grid);

const stagger = {
  initial: {},
  animate: { transition: { staggerChildren: 0.06 } },
};
const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } },
};

const ICON_SM = { size: 14, strokeWidth: 2 };
const KPI_ICON = { size: 16, strokeWidth: 1.75 };

/** Default rolling window width (hours). Backend anchors end time to latest DB row when TELEMETRY_TIME_ANCHOR=latest_in_db. */
function clampSummaryHours(raw) {
  const n = Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n) || n < 1) return 24;
  return Math.min(n, 8760);
}

const SUMMARY_HOURS = clampSummaryHours(import.meta.env.VITE_EQUIPMENT_SUMMARY_HOURS);

function equipTypeIcon(type) {
  if (type === "chiller") return Snowflake;
  if (type === "ct") return Fan;
  return Waves;
}

function EquipCard({ name, data, type }) {
  const running = data?.running_pct;
  const isOn = running != null && running > 0;
  const kwPerTr = data?.avg_kw_per_tr;
  const band = kwPerTr == null ? null : kwPerTr < 0.65 ? "good" : kwPerTr < 0.85 ? "warn" : "bad";
  const bandColor = { good: "green.400", warn: "yellow.400", bad: "red.400" }[band] ?? "text.muted";
  const TypeIcon = equipTypeIcon(type);

  return (
    <MotionBox variants={fadeUp} minW={0}>
      <GlassCard p={4} minW={0}>
        <Flex justify="space-between" align="flex-start" mb={{ base: 3, md: 4 }} gap={2} flexWrap="wrap">
          <Flex align="center" gap={2} minW={0} flex="1 1 auto">
            <StatusPulse active={isOn} />
            <Box
              flexShrink={0}
              w="32px"
              h="32px"
              borderRadius="10px"
              bg="rgba(255,255,255,0.04)"
              border="1px solid"
              borderColor="border.subtle"
              display="flex"
              alignItems="center"
              justifyContent="center"
              color={isOn ? "accent.cyan" : "text.muted"}
            >
              <TypeIcon size={16} strokeWidth={1.75} />
            </Box>
            <Text fontWeight={600} fontSize="sm" color="text.primary" noOfLines={2} wordBreak="break-word">
              {name}
            </Text>
          </Flex>
          <Badge
            fontSize="9px"
            fontWeight={700}
            px={2} py="2px"
            borderRadius="6px"
            bg={isOn ? "rgba(5,150,105,0.1)" : "bg.elevated"}
            color={isOn ? "status.good" : "text.muted"}
            border="1px solid"
            borderColor={isOn ? "rgba(5,150,105,0.25)" : "border.subtle"}
          >
            {isOn ? "RUNNING" : "STANDBY"}
          </Badge>
        </Flex>

        <Grid templateColumns="repeat(2, minmax(0, 1fr))" gap={3}>
          <Box>
            <Text fontSize="9px" color="text.muted" textTransform="uppercase" letterSpacing="0.1em" fontWeight={700} mb={1}>Avg kW</Text>
            <Text fontSize="lg" fontWeight={700} color="text.primary" sx={{ fontVariantNumeric: "tabular-nums" }}>
              {data?.avg_kw != null ? Number(data.avg_kw).toFixed(1) : "—"}
            </Text>
          </Box>
          <Box>
            <Text fontSize="9px" color="text.muted" textTransform="uppercase" letterSpacing="0.1em" fontWeight={700} mb={1}>Run %</Text>
            <Text fontSize="lg" fontWeight={700} color="text.primary" sx={{ fontVariantNumeric: "tabular-nums" }}>
              {running != null ? `${running}%` : "—"}
            </Text>
          </Box>
          {type === "chiller" && (
            <>
              <Box>
                <Text fontSize="9px" color="text.muted" textTransform="uppercase" letterSpacing="0.1em" fontWeight={700} mb={1}>kW/TR</Text>
                <Text fontSize="lg" fontWeight={700} color={bandColor} sx={{ fontVariantNumeric: "tabular-nums" }}>
                  {kwPerTr != null ? kwPerTr.toFixed(3) : "—"}
                </Text>
              </Box>
              <Box>
                <Text fontSize="9px" color="text.muted" textTransform="uppercase" letterSpacing="0.1em" fontWeight={700} mb={1}>Load</Text>
                <Text fontSize="lg" fontWeight={700} color="text.primary" sx={{ fontVariantNumeric: "tabular-nums" }}>
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
  const [spinning, setSpinning] = useState(false);

  const { data: health, refetch: refetchHealth } = useApi("/api/v1/health");

  const {
    data:      summaryData,
    isLoading: loading,
    error,
    refetch:   refetchSummary,
  } = useApi(`/api/v1/equipment/summary?hours=${SUMMARY_HOURS}`);

  const refetch = useCallback(async () => {
    setSpinning(true);
    await Promise.all([refetchHealth(), refetchSummary()]);
    setSpinning(false);
  }, [refetchHealth, refetchSummary]);

  /** Back/forward cache + tab return: remount may not run (bfcache); refetch without spinner. */
  const refreshAfterHiddenMs = 800;
  const hiddenAtRef = useRef(null);

  const silentRefetch = useCallback(() => {
    void Promise.all([refetchHealth(), refetchSummary()]);
  }, [refetchHealth, refetchSummary]);

  useEffect(() => {
    const onPageShow = (e) => {
      if (e.persisted) silentRefetch();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
        return;
      }
      const t = hiddenAtRef.current;
      if (t != null && Date.now() - t >= refreshAfterHiddenMs) silentRefetch();
      hiddenAtRef.current = null;
    };
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [silentRefetch]);

  const s               = summaryData?.summary || {};
  const telemetryWindow = summaryData?.telemetry_window ?? null;
  const freshnessWarn   = summaryData?.freshness_warning ?? null;
  const dbOk            = health?.db?.connected;
  const ollamaOk        = health?.ollama?.connected;

  return (
    <PageShell maxW="100%">
      <PageHeader
        title="Operations Dashboard"
        subtitle={`Unicharm HVAC Plant · Last ${SUMMARY_HOURS} hours`}
        icon={<PageHeaderIcon icon={<LayoutDashboard size={20} strokeWidth={1.85} />} />}
        actions={
          <>
            <Flex
              align="center" gap={2}
              bg="bg.surface"
              border="1px solid"
              borderColor="border.subtle"
              borderRadius="10px"
              px={3} py={2}
              color="text.muted"
            >
              <Box as="span" opacity={0.55} lineHeight={0} display="flex">
                <Database size={ICON_SM.size} strokeWidth={ICON_SM.strokeWidth} />
              </Box>
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
              flexShrink={0}
              maxW={{ base: "100%", sm: "none" }}
              color="text.muted"
            >
              <Box as="span" opacity={0.55} lineHeight={0} display="flex">
                <Cpu size={ICON_SM.size} strokeWidth={ICON_SM.strokeWidth} />
              </Box>
              <StatusPulse active={ollamaOk} size="7px" />
              <Text
                fontSize="xs"
                color={ollamaOk ? "green.400" : "red.400"}
                fontWeight={500}
                maxW={{ base: "160px", md: "240px", xl: "320px" }}
                noOfLines={1}
                title={health?.ollama?.default_model ?? "Ollama"}
              >
                {health?.ollama?.default_model ?? "Ollama"}
              </Text>
            </Flex>

            <MotionBox whileTap={{ scale: 0.92 }}>
              <Box
                as="button"
                aria-label="Refresh dashboard"
                onClick={refetch}
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
                <MotionBox animate={{ rotate: spinning ? 360 : 0 }} transition={{ duration: 0.55 }}>
                  <RefreshCw size={16} strokeWidth={2} />
                </MotionBox>
              </Box>
            </MotionBox>
          </>
        }
      />

      <ErrorAlert error={error} />
      <ErrorAlert error={freshnessWarn} mb={4} />
      {summaryData?.empty_hint && (
        <Flex
          mb={{ base: 4, md: 5 }}
          align="flex-start"
          gap={{ base: 2, md: 3 }}
          bg="rgba(31,63,254,0.08)"
          border="1px solid"
          borderColor="rgba(31,63,254,0.22)"
          borderRadius="12px"
          px={4}
          py={3}
        >
          <Text fontSize="sm" color="accent.primary" flex={1} lineHeight={1.65} fontWeight={500}>
            {summaryData.empty_hint}
          </Text>
        </Flex>
      )}

      {telemetryWindow?.anchor === "latest_in_db" && telemetryWindow?.until_utc && (
        <Text fontSize="xs" color="text.muted" mb={5} lineHeight="tall">
          Historical snapshot: window ends{" "}
          <Box as="span" fontWeight={600} color="text.primary">{telemetryWindow.until_utc}</Box>
          {" "}UTC ({telemetryWindow.since_utc} → {telemetryWindow.until_utc}).
        </Text>
      )}

      {/* KPI strip — minmax prevents grid blowout; dense cols only on xl+ */}
      <MotionGrid
        variants={stagger}
        initial="initial"
        animate="animate"
        templateColumns={{
          base: "minmax(0, 1fr)",
          sm: "repeat(2, minmax(0, 1fr))",
          md: "repeat(3, minmax(0, 1fr))",
          xl: "repeat(3, minmax(0, 1fr))",
          "2xl": "repeat(6, minmax(0, 1fr))",
        }}
        gap={{ base: 3, md: 4 }} mb={{ base: 4, md: 6 }} w="100%" minW={0}
      >
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <MotionBox key={i} variants={fadeUp} minW={0}><SkeletonKpiCard /></MotionBox>
          ))
        ) : (
          <>
            <MotionBox variants={fadeUp} minW={0}>
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
                icon={<Snowflake {...KPI_ICON} />}
              />
            </MotionBox>
            <MotionBox variants={fadeUp} minW={0}>
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
                icon={<Snowflake {...KPI_ICON} />}
              />
            </MotionBox>
            <MotionBox variants={fadeUp} minW={0}>
              <KpiCard label="CH1 Load" value={s.chiller_1?.avg_chiller_load} unit="%" decimals={1} icon={<Gauge {...KPI_ICON} />} />
            </MotionBox>
            <MotionBox variants={fadeUp} minW={0}>
              <KpiCard label="CH2 Load" value={s.chiller_2?.avg_chiller_load} unit="%" decimals={1} icon={<Gauge {...KPI_ICON} />} />
            </MotionBox>
            <MotionBox variants={fadeUp} minW={0}>
              <KpiCard label="Ambient" value={s.chiller_1?.latest_ambient_temp} unit="°C" decimals={1} icon={<ThermometerSun {...KPI_ICON} />} />
            </MotionBox>
            <MotionBox variants={fadeUp} minW={0}>
              <KpiCard label="CHW Supply" value={s.chiller_1?.latest_evap_leaving} unit="°C" decimals={1} icon={<Droplets {...KPI_ICON} />} />
            </MotionBox>
          </>
        )}
      </MotionGrid>

      {/* Equipment Grid */}
      <Eyebrow mb={4}>Equipment Overview</Eyebrow>

      <MotionGrid
        variants={stagger}
        initial="initial"
        animate="animate"
        templateColumns={{
          base: "minmax(0, 1fr)",
          sm: "repeat(2, minmax(0, 1fr))",
          lg: "repeat(2, minmax(0, 1fr))",
          xl: "repeat(3, minmax(0, 1fr))",
        }}
        gap={{ base: 3, md: 4 }}
        w="100%"
        minW={0}
      >
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <MotionBox key={i} variants={fadeUp} minW={0}><SkeletonEquipCard /></MotionBox>
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
    </PageShell>
  );
}
