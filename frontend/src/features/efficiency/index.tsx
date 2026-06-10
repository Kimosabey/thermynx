import { useState, type CSSProperties } from "react";
import { Zap } from "lucide-react";
import { motion, type Variants } from "framer-motion";
import useApi from "@/shared/hooks/useApi";
import PageShell from "@/shared/ui/PageShell";
import PageHeader from "@/shared/ui/PageHeader";
import PeriodSelect from "@/shared/ui/PeriodSelect";
import GlassCard from "@/shared/ui/GlassCard";
import PageHeaderIcon from "@/shared/ui/PageHeaderIcon";
import Eyebrow from "@/shared/ui/Eyebrow";
import StatusPulse from "@/shared/ui/StatusPulse";
import { SkeletonKpiCard } from "@/shared/ui/SkeletonCard";
import { Badge } from "@/components/ui/badge";

// ── Response shape (derived from legacy field usage) ─────────────────────────
type Band = "excellent" | "good" | "fair" | "poor" | "critical" | "unknown";

interface EfficiencyResult {
  equipment_id: string | number;
  name: string;
  band?: Band | string;
  running_pct?: number | null;
  kw_per_tr_avg?: number | null;
  kw_per_tr_best?: number | null;
  kw_per_tr_worst?: number | null;
  avg_load?: number | null;
  avg_delta_t?: number | null;
  delta_pct?: number | null;
  record_count?: number | null;
  loss_drivers?: string[];
  observations?: string[];
}

interface EfficiencyResponse {
  results?: EfficiencyResult[];
}

const stagger: Variants = { animate: { transition: { staggerChildren: 0.08 } } };
const fadeUp: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

interface BandMeta {
  color: string;
  bg: string;
  border: string;
  label: string;
}

const BAND_META: Record<string, BandMeta> = {
  excellent: { color: "#10b981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.25)", label: "Excellent" },
  good:      { color: "#00c4f4", bg: "rgba(0,196,244,0.12)",  border: "rgba(0,196,244,0.25)",  label: "Good" },
  fair:      { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.25)", label: "Fair" },
  poor:      { color: "#f97316", bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.25)", label: "Poor" },
  critical:  { color: "#ef4444", bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.25)", label: "Critical" },
  unknown:   { color: "#64748b", bg: "rgba(100,116,139,0.1)", border: "rgba(100,116,139,0.2)", label: "No data" },
};

function BandBar({ kw_per_tr }: { kw_per_tr?: number | null }) {
  if (kw_per_tr == null) return null;
  const zones = [
    { max: 0.55, color: "#10b981", label: "Excellent" },
    { max: 0.65, color: "#00c4f4", label: "Good" },
    { max: 0.75, color: "#f59e0b", label: "Fair" },
    { max: 0.85, color: "#f97316", label: "Poor" },
    { max: 1.10, color: "#ef4444", label: "Critical" },
  ];
  const total = 1.10;
  const markerPct = Math.min((kw_per_tr / total) * 100, 100);

  return (
    <div>
      <div className="mb-2 flex h-[6px] overflow-hidden rounded-full">
        {zones.map((z, i) => (
          <div
            key={i}
            style={{ flex: (z.max - (zones[i - 1]?.max ?? 0)) / total, background: z.color, opacity: 0.7 }}
          />
        ))}
      </div>
      <div className="relative h-[12px]">
        <motion.div
          className="absolute top-0"
          style={{ left: `${markerPct}%`, transform: "translateX(-50%)" }}
          initial={{ left: "0%" }}
          animate={{ left: `${markerPct}%` }}
          transition={{ duration: 1, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <div className="h-[12px] w-[2px] rounded-full bg-white shadow-[0_0_4px_rgba(255,255,255,0.5)]" />
        </motion.div>
      </div>
      <div className="mt-1 flex justify-between">
        <p className="text-[9px] text-ink-muted">0.55</p>
        <p className="text-[9px] text-ink-muted">0.65</p>
        <p className="text-[9px] text-ink-muted">0.75</p>
        <p className="text-[9px] text-ink-muted">0.85</p>
      </div>
    </div>
  );
}

function EfficiencyCard({ result }: { result: EfficiencyResult }) {
  const meta = BAND_META[result.band ?? "unknown"] ?? BAND_META.unknown;
  const isOn = result.running_pct != null && result.running_pct > 0;

  const stats: { label: string; value: string | number | null | undefined; unit: string }[] = [
    { label: "Best",     value: result.kw_per_tr_best?.toFixed(3),  unit: "kW/TR" },
    { label: "Worst",    value: result.kw_per_tr_worst?.toFixed(3), unit: "kW/TR" },
    { label: "Avg Load", value: result.avg_load != null ? `${result.avg_load.toFixed(1)}%` : "—", unit: "" },
    { label: "CHW ΔT",   value: result.avg_delta_t != null ? `${result.avg_delta_t.toFixed(2)}°C` : "—", unit: "" },
    { label: "Run %",    value: result.running_pct != null ? `${result.running_pct}%` : "—", unit: "" },
    { label: "Samples",  value: result.record_count, unit: "" },
  ];

  return (
    <motion.div variants={fadeUp}>
      <GlassCard>
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <StatusPulse active={isOn} />
            <p className="text-sm font-bold text-ink">{result.name}</p>
          </div>
          <Badge
            className="rounded-full border px-3 py-[3px] text-[10px] font-bold"
            style={{ background: meta.bg, color: meta.color, borderColor: meta.border }}
          >
            {meta.label}
          </Badge>
        </div>

        {/* Main metric */}
        <div className="mb-4 flex items-baseline gap-2">
          <p
            className="text-3xl font-extrabold tracking-[-0.03em] tabular-nums"
            style={{ color: meta.color }}
          >
            {result.kw_per_tr_avg != null ? result.kw_per_tr_avg.toFixed(3) : "—"}
          </p>
          <p className="text-sm text-ink-muted">kW/TR</p>
          {result.delta_pct != null && (
            <Badge
              className="ml-auto rounded-full border px-2 text-[10px]"
              style={{
                background: result.delta_pct <= 0 ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.1)",
                color: result.delta_pct <= 0 ? "#4ade80" : "#f87171",
                borderColor: result.delta_pct <= 0 ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.2)",
              }}
            >
              {result.delta_pct > 0 ? "+" : ""}{result.delta_pct.toFixed(1)}% vs design
            </Badge>
          )}
        </div>

        {/* Band bar */}
        <div className="mb-4">
          <BandBar kw_per_tr={result.kw_per_tr_avg} />
        </div>

        {/* Stats row */}
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
          {stats.map((s, i) => (
            <div key={i}>
              <Eyebrow className="mb-1">{s.label}</Eyebrow>
              <p className="text-sm font-semibold text-ink tabular-nums">{s.value ?? "—"}</p>
            </div>
          ))}
        </div>

        {/* Loss drivers */}
        {result.loss_drivers?.length ? (
          <div
            className="rounded-[10px] border p-3"
            style={{ background: "rgba(239,68,68,0.06)", borderColor: "rgba(239,68,68,0.15)" }}
          >
            <Eyebrow className="mb-2" style={{ color: "#f87171" } as CSSProperties}>
              Loss Drivers
            </Eyebrow>
            {result.loss_drivers.map((d, i) => (
              <div
                key={i}
                className="flex gap-2"
                style={{ marginBottom: i < result.loss_drivers!.length - 1 ? 8 : 0 }}
              >
                <span className="mt-px shrink-0" style={{ color: "#f87171" }}>›</span>
                <p className="text-xs leading-[1.6] text-ink">{d}</p>
              </div>
            ))}
          </div>
        ) : null}

        {/* Observations */}
        {result.observations?.length && !result.loss_drivers?.length ? (
          <div
            className="rounded-[10px] border p-3"
            style={{ background: "rgba(16,185,129,0.06)", borderColor: "rgba(16,185,129,0.15)" }}
          >
            {result.observations.map((obs, i) => (
              <p key={i} className="text-xs leading-[1.6] text-ink">{obs}</p>
            ))}
          </div>
        ) : null}
      </GlassCard>
    </motion.div>
  );
}

export default function EfficiencyPage() {
  const [hours, setHours] = useState(24);

  const { data, isLoading } = useApi<EfficiencyResponse>(`/api/v1/efficiency?hours=${hours}`);
  const results = data?.results ?? [];

  const legend = [
    { label: "Excellent", range: "< 0.55", color: "#10b981" },
    { label: "Good",      range: "0.55 – 0.65", color: "#00c4f4" },
    { label: "Fair",      range: "0.65 – 0.75", color: "#f59e0b" },
    { label: "Poor",      range: "0.75 – 0.85", color: "#f97316" },
    { label: "Critical",  range: "> 0.85", color: "#ef4444" },
  ];

  return (
    <PageShell>
      <PageHeader
        title="Efficiency Benchmarker"
        icon={<PageHeaderIcon icon={<Zap size={20} strokeWidth={1.85} />} />}
        subtitle="kW/TR analysis vs design + industry benchmarks · loss driver attribution"
        actions={<PeriodSelect value={hours} onChange={setHours} />}
      />

      {/* Benchmark legend */}
      <GlassCard className="mb-6 p-4">
        <Eyebrow className="mb-3">kW/TR Benchmark Scale</Eyebrow>
        <div className="flex w-full max-w-full flex-wrap items-center gap-2 sm:gap-3 xl:w-auto">
          {legend.map((b) => (
            <div key={b.label} className="flex items-center gap-2">
              <div className="size-3 rounded-[3px]" style={{ background: b.color }} />
              <p className="text-xs text-ink-muted">
                <span className="font-semibold text-ink">{b.label}</span> {b.range}
              </p>
            </div>
          ))}
        </div>
      </GlassCard>

      <motion.div
        variants={stagger}
        initial="initial"
        animate="animate"
        className="mb-6 grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-2 md:mb-8"
      >
        {isLoading
          ? Array.from({ length: 2 }).map((_, i) => (
              <motion.div key={i} variants={fadeUp}>
                <SkeletonKpiCard />
              </motion.div>
            ))
          : results.map((r) => <EfficiencyCard key={r.equipment_id} result={r} />)}
      </motion.div>
    </PageShell>
  );
}
