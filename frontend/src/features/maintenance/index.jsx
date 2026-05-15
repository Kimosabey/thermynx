import { useState, useEffect } from "react";
import { Box, Flex, Text, Grid, Badge } from "@chakra-ui/react";
import { Wrench as WrenchIcon } from "lucide-react";
import { motion } from "framer-motion";
import PageShell from "../../shared/ui/PageShell";
import PageHeader from "../../shared/ui/PageHeader";
import PeriodSelect from "../../shared/ui/PeriodSelect";
import GlassCard from "../../shared/ui/GlassCard";
import PageHeaderIcon from "../../shared/ui/PageHeaderIcon";
import Eyebrow from "../../shared/ui/Eyebrow";
import StatusPulse from "../../shared/ui/StatusPulse";
import { SkeletonKpiCard } from "../../shared/ui/SkeletonCard";

const MotionBox = motion.create(Box);
const MotionGrid = motion.create(Grid);
const stagger = { animate: { transition: { staggerChildren: 0.08 } } };
const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

function healthColor(score) {
  if (score >= 75) return "green.400";
  if (score >= 55) return "yellow.400";
  return "red.400";
}

function HealthCard({ asset }) {
  const color = healthColor(asset.health_score ?? 0);
  const on = asset.run_hours != null && asset.run_hours > 0;

  return (
    <MotionBox variants={fadeUp}>
      <GlassCard>
        <Flex justify="space-between" align="center" mb={4}>
          <Flex align="center" gap={2}>
            <StatusPulse active={on} />
            <Text fontWeight={700} fontSize="sm" color="text.primary">{asset.name}</Text>
          </Flex>
          <Badge fontSize="10px" px={2} borderRadius="full" bg="whiteAlpha.100">
            {String(asset.type).replace(/_/g, " ")}
          </Badge>
        </Flex>

        <Flex align="baseline" gap={2} mb={2}>
          <Text fontSize="4xl" fontWeight={800} color={color} sx={{ fontVariantNumeric: "tabular-nums" }}>
            {asset.health_score ?? "—"}
          </Text>
          <Text fontSize="sm" color="text.muted">health</Text>
        </Flex>

        <Grid templateColumns="repeat(2, 1fr)" gap={3} mb={3}>
          <Box>
            <Eyebrow>Run hours</Eyebrow>
            <Text fontSize="sm" fontWeight={600}>{asset.run_hours?.toFixed(2) ?? "—"}</Text>
          </Box>
          <Box>
            <Eyebrow>Buckets</Eyebrow>
            <Text fontSize="sm" fontWeight={600}>{asset.record_count}</Text>
          </Box>
          {asset.type === "chiller" && (
            <>
              <Box>
                <Eyebrow>Avg kW/TR</Eyebrow>
                <Text fontSize="sm" fontWeight={600}>{asset.avg_kw_per_tr?.toFixed(3) ?? "—"}</Text>
              </Box>
              <Box>
                <Eyebrow>CHW ΔT</Eyebrow>
                <Text fontSize="sm" fontWeight={600}>{asset.avg_chw_delta_t?.toFixed(2) ?? "—"} °C</Text>
              </Box>
            </>
          )}
        </Grid>

        {asset.degradation_flag && (
          <Box bg="rgba(239,68,68,0.08)" border="1px solid rgba(239,68,68,0.2)" borderRadius="10px" p={3}>
            <Text fontSize="9px" fontWeight={700} color="red.400" mb={2}>Degradation signals</Text>
            {(asset.degradation_reasons || []).map((d, i) => (
              <Text key={i} fontSize="xs" color="text.primary" mb={i < asset.degradation_reasons.length - 1 ? 2 : 0}>{d}</Text>
            ))}
          </Box>
        )}
      </GlassCard>
    </MotionBox>
  );
}

export default function MaintenancePage() {
  const [hours, setHours] = useState(24);
  const [assets, setAssets] = useState([]);
  const [towerHints, setTowerHints] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/v1/maintenance?hours=${hours}`).then((r) => r.json()),
      fetch(`/api/v1/cooling-tower/cooling_tower_1/optimize?hours=${hours}`).then((r) => r.json()),
      fetch(`/api/v1/cooling-tower/cooling_tower_2/optimize?hours=${hours}`).then((r) => r.json()),
    ])
      .then(([m, t1, t2]) => {
        setAssets(m.assets || []);
        setTowerHints([t1, t2].filter((x) => x && x.equipment_id));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [hours]);

  return (
    <PageShell>
      <PageHeader
        title="Predictive Maintenance"
        icon={<PageHeaderIcon icon={<WrenchIcon size={20} strokeWidth={1.85} />} />}
        subtitle="Run-hours from telemetry buckets · efficiency-based degradation · composite health 0–100"
        actions={<PeriodSelect value={hours} onChange={setHours} />}
      />

      <MotionGrid variants={stagger} initial="initial" animate="animate" templateColumns={{ base: "1fr", lg: "repeat(2, 1fr)" }} gap={{ base: 4, md: 5 }} mb={{ base: 6, md: 8 }}>
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <MotionBox key={i} variants={fadeUp}><SkeletonKpiCard /></MotionBox>
            ))
          : assets.map((a) => <HealthCard key={a.equipment_id} asset={a} />)
        }
      </MotionGrid>

      <Eyebrow mb={4}>Cooling tower staging hints</Eyebrow>
      <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={{ base: 3, md: 4 }}>
        {towerHints.map((h) => (
          <GlassCard key={h.equipment_id}>
            <Text fontWeight={700} fontSize="sm" mb={2}>{h.name}</Text>
            <Text fontSize="xs" color="text.muted" mb={2}>
              {h.wet_bulb_avg_c != null ? `WB avg ${h.wet_bulb_avg_c} °C` : "WB n/a (not on normalized tower feed)"}
              {" · "}fan kW ~{h.avg_fan_kw ?? "—"}
              {h.est_kwh_saved_per_day != null && ` · est. savings hint ~${h.est_kwh_saved_per_day} kWh/day`}
            </Text>
            <Text fontSize="sm" color="text.primary" lineHeight={1.7}>{h.staging_hint}</Text>
            {h.rationale && (
              <Text fontSize="xs" color="text.muted" mt={3}>{h.rationale}</Text>
            )}
          </GlassCard>
        ))}
      </Grid>
    </PageShell>
  );
}
