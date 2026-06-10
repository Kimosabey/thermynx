import { useState } from "react";
import { Wrench as WrenchIcon } from "lucide-react";
import { motion, type Variants } from "framer-motion";
import PageShell from "@/shared/ui/PageShell";
import PageHeader from "@/shared/ui/PageHeader";
import PageHeaderIcon from "@/shared/ui/PageHeaderIcon";
import PeriodSelect from "@/shared/ui/PeriodSelect";
import GlassCard from "@/shared/ui/GlassCard";
import Eyebrow from "@/shared/ui/Eyebrow";
import StatusPulse from "@/shared/ui/StatusPulse";
import { SkeletonKpiCard } from "@/shared/ui/SkeletonCard";
import { Badge } from "@/components/ui/badge";
import useApi from "@/shared/hooks/useApi";

// ── Response shapes (derived from legacy field usage) ──────────────────────────
interface MaintenanceAsset {
  equipment_id: string;
  name: string;
  type: string;
  health_score?: number | null;
  run_hours?: number | null;
  record_count: number;
  avg_kw_per_tr?: number | null;
  avg_chw_delta_t?: number | null;
  degradation_flag?: boolean;
  degradation_reasons?: string[];
}

interface MaintenanceResponse {
  assets?: MaintenanceAsset[];
}

interface TowerHint {
  equipment_id?: string;
  name: string;
  wet_bulb_avg_c?: number | null;
  avg_fan_kw?: number | null;
  est_kwh_saved_per_day?: number | null;
  staging_hint: string;
  rationale?: string;
}

// ── Motion variants (verbatim from legacy) ─────────────────────────────────────
const stagger: Variants = { animate: { transition: { staggerChildren: 0.08 } } };
const fadeUp: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

/** green.400 / yellow.400 / red.400 -> status token utilities (auto dark-flip). */
function healthColorClass(score: number): string {
  if (score >= 75) return "text-good";
  if (score >= 55) return "text-warn";
  return "text-bad";
}

function HealthCard({ asset }: { asset: MaintenanceAsset }) {
  const colorClass = healthColorClass(asset.health_score ?? 0);
  const on = asset.run_hours != null && asset.run_hours > 0;

  return (
    <motion.div variants={fadeUp}>
      <GlassCard>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusPulse active={on} />
            <p className="text-sm font-bold text-ink">{asset.name}</p>
          </div>
          <Badge className="rounded-full bg-white/10 px-2 text-[10px] font-medium text-ink">
            {String(asset.type).replace(/_/g, " ")}
          </Badge>
        </div>

        <div className="mb-2 flex items-baseline gap-2">
          <p className={`text-4xl font-extrabold tabular-nums ${colorClass}`}>
            {asset.health_score ?? "—"}
          </p>
          <p className="text-sm text-ink-muted">health</p>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-3">
          <div>
            <Eyebrow>Run hours</Eyebrow>
            <p className="text-sm font-semibold">{asset.run_hours?.toFixed(2) ?? "—"}</p>
          </div>
          <div>
            <Eyebrow>Buckets</Eyebrow>
            <p className="text-sm font-semibold">{asset.record_count}</p>
          </div>
          {asset.type === "chiller" && (
            <>
              <div>
                <Eyebrow>Avg kW/TR</Eyebrow>
                <p className="text-sm font-semibold">{asset.avg_kw_per_tr?.toFixed(3) ?? "—"}</p>
              </div>
              <div>
                <Eyebrow>CHW ΔT</Eyebrow>
                <p className="text-sm font-semibold">{asset.avg_chw_delta_t?.toFixed(2) ?? "—"} °C</p>
              </div>
            </>
          )}
        </div>

        {asset.degradation_flag && (
          <div className="rounded-[10px] border border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.08)] p-3">
            <p className="mb-2 text-[9px] font-bold text-bad">Degradation signals</p>
            {(asset.degradation_reasons || []).map((d, i) => (
              <p
                key={i}
                className="text-xs text-ink"
                style={{
                  marginBottom:
                    i < (asset.degradation_reasons?.length ?? 0) - 1 ? 8 : 0,
                }}
              >
                {d}
              </p>
            ))}
          </div>
        )}
      </GlassCard>
    </motion.div>
  );
}

export default function MaintenancePage() {
  const [hours, setHours] = useState<number>(24);

  const { data: maintenance, isLoading: maintLoading } = useApi<MaintenanceResponse>(
    `/api/v1/maintenance?hours=${hours}`,
  );
  const { data: tower1, isLoading: t1Loading } = useApi<TowerHint>(
    `/api/v1/cooling-tower/cooling_tower_1/optimize?hours=${hours}`,
  );
  const { data: tower2, isLoading: t2Loading } = useApi<TowerHint>(
    `/api/v1/cooling-tower/cooling_tower_2/optimize?hours=${hours}`,
  );

  const loading = maintLoading || t1Loading || t2Loading;
  const assets = maintenance?.assets ?? [];
  const towerHints = [tower1, tower2].filter(
    (x): x is TowerHint => !!x && !!x.equipment_id,
  );

  return (
    <PageShell>
      <PageHeader
        title="Predictive Maintenance"
        icon={<PageHeaderIcon icon={<WrenchIcon size={20} strokeWidth={1.85} />} />}
        subtitle="Run-hours from telemetry buckets · efficiency-based degradation · composite health 0–100"
        actions={<PeriodSelect value={hours} onChange={setHours} />}
      />

      <motion.div
        variants={stagger}
        initial="initial"
        animate="animate"
        className="mb-6 grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-2 md:mb-8"
      >
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <motion.div key={i} variants={fadeUp}>
                <SkeletonKpiCard />
              </motion.div>
            ))
          : assets.map((a) => <HealthCard key={a.equipment_id} asset={a} />)}
      </motion.div>

      <Eyebrow className="mb-4">Cooling tower staging hints</Eyebrow>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
        {towerHints.map((h) => (
          <GlassCard key={h.equipment_id}>
            <p className="mb-2 text-sm font-bold">{h.name}</p>
            <p className="mb-2 text-xs text-ink-muted">
              {h.wet_bulb_avg_c != null
                ? `WB avg ${h.wet_bulb_avg_c} °C`
                : "WB n/a (not on normalized tower feed)"}
              {" · "}fan kW ~{h.avg_fan_kw ?? "—"}
              {h.est_kwh_saved_per_day != null &&
                ` · est. savings hint ~${h.est_kwh_saved_per_day} kWh/day`}
            </p>
            <p className="text-sm leading-[1.7] text-ink">{h.staging_hint}</p>
            {h.rationale && <p className="mt-3 text-xs text-ink-muted">{h.rationale}</p>}
          </GlassCard>
        ))}
      </div>
    </PageShell>
  );
}
