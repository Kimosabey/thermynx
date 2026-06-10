import {
  useState,
  useCallback,
  useEffect,
  useRef,
  type ComponentType,
} from "react";
import { motion, type Variants } from "framer-motion";
import {
  LayoutDashboard,
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
import PageShell from "@/shared/ui/PageShell";
import PageHeader from "@/shared/ui/PageHeader";
import GlassCard from "@/shared/ui/GlassCard";
import KpiCard from "@/shared/ui/KpiCard";
import HoverGradientCard from "@/shared/ui/HoverGradientCard";
import StatusPulse from "@/shared/ui/StatusPulse";
import ErrorAlert from "@/shared/ui/ErrorAlert";
import PageHeaderIcon from "@/shared/ui/PageHeaderIcon";
import Eyebrow from "@/shared/ui/Eyebrow";
import useApi from "@/shared/hooks/useApi";
import { SkeletonKpiCard, SkeletonEquipCard } from "@/shared/ui/SkeletonCard";

/* ────────────────────────────────────────────────────────────────────────────
   Chakra default-palette literals — kept verbatim so the port renders
   pixel-identically (matches the convention in ErrorAlert.tsx). The new
   KpiCard's `resolveColor` passes unknown strings through unchanged, so we must
   feed it real hex (not "green.400") for the kW/TR efficiency bands.
   ──────────────────────────────────────────────────────────────────────────── */
const GREEN_400 = "#48BB78";
const YELLOW_400 = "#ECC94B";
const RED_400 = "#FC8181";

// ── Types (derived from legacy field usage) ──
interface EquipSummary {
  running_pct?: number | null;
  avg_kw_per_tr?: number | null;
  avg_kw?: number | null;
  avg_chiller_load?: number | null;
  latest_ambient_temp?: number | null;
  latest_evap_leaving?: number | null;
}

type SummaryMap = Record<string, EquipSummary | undefined>;

interface TelemetryWindow {
  anchor?: string | null;
  since_utc?: string | null;
  until_utc?: string | null;
}

interface SummaryResponse {
  summary?: SummaryMap;
  telemetry_window?: TelemetryWindow | null;
  freshness_warning?: string | null;
  empty_hint?: string | null;
}

interface HealthResponse {
  db?: { connected?: boolean | null };
  ollama?: { connected?: boolean | null; default_model?: string | null };
}

const MotionDiv = motion.div;

const stagger: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.06 } },
};
const fadeUp: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } },
};

const ICON_SM = { size: 14, strokeWidth: 2 };
const KPI_ICON = { size: 16, strokeWidth: 1.75 };

/** Default rolling window width (hours). Backend anchors end time to latest DB row when TELEMETRY_TIME_ANCHOR=latest_in_db. */
function clampSummaryHours(raw: unknown): number {
  const n = Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n) || n < 1) return 24;
  return Math.min(n, 8760);
}

const SUMMARY_HOURS = clampSummaryHours(import.meta.env.VITE_EQUIPMENT_SUMMARY_HOURS);

type EquipType = "chiller" | "ct" | "pump";

function equipTypeIcon(type: EquipType): ComponentType<{ size?: number; strokeWidth?: number }> {
  if (type === "chiller") return Snowflake;
  if (type === "ct") return Fan;
  return Waves;
}

function EquipCard({
  name,
  data,
  type,
}: {
  name: string;
  data?: EquipSummary;
  type: EquipType;
}) {
  const running = data?.running_pct;
  const isOn = running != null && running > 0;
  const kwPerTr = data?.avg_kw_per_tr;
  const band = kwPerTr == null ? null : kwPerTr < 0.65 ? "good" : kwPerTr < 0.85 ? "warn" : "bad";
  const bandColor =
    band === "good" ? GREEN_400 : band === "warn" ? YELLOW_400 : band === "bad" ? RED_400 : "var(--ink-muted)";
  const TypeIcon = equipTypeIcon(type);

  return (
    <MotionDiv variants={fadeUp} className="min-w-0">
      <GlassCard className="min-w-0 p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2 md:mb-4">
          <div className="flex min-w-0 flex-[1_1_auto] items-center gap-2">
            <StatusPulse active={isOn} />
            <div
              className={`flex size-8 shrink-0 items-center justify-center rounded-[10px] border border-border-subtle bg-chip ${
                isOn ? "text-cyan" : "text-ink-muted"
              }`}
            >
              <TypeIcon size={16} strokeWidth={1.75} />
            </div>
            <p className="line-clamp-2 text-sm font-semibold break-words text-ink">{name}</p>
          </div>
          <span
            className="rounded-[6px] border px-2 py-[2px] text-[9px] font-bold"
            style={
              isOn
                ? {
                    background: "rgba(5,150,105,0.1)",
                    color: "var(--good)",
                    borderColor: "rgba(5,150,105,0.25)",
                  }
                : {
                    background: "var(--elevated)",
                    color: "var(--ink-muted)",
                    borderColor: "var(--border-subtle)",
                  }
            }
          >
            {isOn ? "RUNNING" : "STANDBY"}
          </span>
        </div>

        <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3">
          <div>
            <p className="mb-1 text-[9px] font-bold tracking-[0.1em] text-ink-muted uppercase">Avg kW</p>
            <p className="text-lg font-bold tabular-nums text-ink">
              {data?.avg_kw != null ? Number(data.avg_kw).toFixed(1) : "—"}
            </p>
          </div>
          <div>
            <p className="mb-1 text-[9px] font-bold tracking-[0.1em] text-ink-muted uppercase">Run %</p>
            <p className="text-lg font-bold tabular-nums text-ink">
              {running != null ? `${running}%` : "—"}
            </p>
          </div>
          {type === "chiller" && (
            <>
              <div>
                <p className="mb-1 text-[9px] font-bold tracking-[0.1em] text-ink-muted uppercase">kW/TR</p>
                <p className="text-lg font-bold tabular-nums" style={{ color: bandColor }}>
                  {kwPerTr != null ? kwPerTr.toFixed(3) : "—"}
                </p>
              </div>
              <div>
                <p className="mb-1 text-[9px] font-bold tracking-[0.1em] text-ink-muted uppercase">Load</p>
                <p className="text-lg font-bold tabular-nums text-ink">
                  {data?.avg_chiller_load != null ? `${Number(data.avg_chiller_load).toFixed(1)}%` : "—"}
                </p>
              </div>
            </>
          )}
        </div>
      </GlassCard>
    </MotionDiv>
  );
}

export default function Dashboard() {
  const [spinning, setSpinning] = useState(false);

  const { data: health, refetch: refetchHealth } = useApi<HealthResponse>("/api/v1/health");

  const {
    data: summaryData,
    isLoading: loading,
    error,
    refetch: refetchSummary,
  } = useApi<SummaryResponse>(`/api/v1/equipment/summary?hours=${SUMMARY_HOURS}`);

  const refetch = useCallback(async () => {
    setSpinning(true);
    await Promise.all([refetchHealth(), refetchSummary()]);
    setSpinning(false);
  }, [refetchHealth, refetchSummary]);

  /** Back/forward cache + tab return: remount may not run (bfcache); refetch without spinner. */
  const refreshAfterHiddenMs = 800;
  const hiddenAtRef = useRef<number | null>(null);

  const silentRefetch = useCallback(() => {
    void Promise.all([refetchHealth(), refetchSummary()]);
  }, [refetchHealth, refetchSummary]);

  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
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

  const s: SummaryMap = summaryData?.summary || {};
  const telemetryWindow = summaryData?.telemetry_window ?? null;
  const freshnessWarn = summaryData?.freshness_warning ?? null;
  const dbOk = health?.db?.connected;
  const ollamaOk = health?.ollama?.connected;

  return (
    <PageShell className="max-w-full">
      <PageHeader
        title="Operations Dashboard"
        subtitle={`Unicharm HVAC Plant · Last ${SUMMARY_HOURS} hours`}
        icon={<PageHeaderIcon icon={<LayoutDashboard size={20} strokeWidth={1.85} />} />}
        actions={
          <>
            <div className="flex items-center gap-2 rounded-[10px] border border-border-subtle bg-surface px-3 py-2 text-ink-muted">
              <span className="flex leading-[0] opacity-55">
                <Database size={ICON_SM.size} strokeWidth={ICON_SM.strokeWidth} />
              </span>
              <StatusPulse active={!!dbOk} size="7px" />
              <p className="text-xs font-medium" style={{ color: dbOk ? GREEN_400 : RED_400 }}>
                DB
              </p>
            </div>

            <div className="flex max-w-full shrink-0 items-center gap-2 rounded-[10px] border border-border-subtle bg-surface px-3 py-2 text-ink-muted sm:max-w-none">
              <span className="flex leading-[0] opacity-55">
                <Cpu size={ICON_SM.size} strokeWidth={ICON_SM.strokeWidth} />
              </span>
              <StatusPulse active={!!ollamaOk} size="7px" />
              <p
                className="line-clamp-1 max-w-[160px] text-xs font-medium md:max-w-[240px] xl:max-w-[320px]"
                style={{ color: ollamaOk ? GREEN_400 : RED_400 }}
                title={health?.ollama?.default_model ?? "Ollama"}
              >
                {health?.ollama?.default_model ?? "Ollama"}
              </p>
            </div>

            <MotionDiv whileTap={{ scale: 0.92 }}>
              <button
                type="button"
                aria-label="Refresh dashboard"
                onClick={refetch}
                className="flex size-[34px] items-center justify-center rounded-[10px] border border-border-subtle bg-surface text-ink-muted transition-all duration-150 hover:border-cyan hover:text-cyan"
              >
                <MotionDiv animate={{ rotate: spinning ? 360 : 0 }} transition={{ duration: 0.55 }}>
                  <RefreshCw size={16} strokeWidth={2} />
                </MotionDiv>
              </button>
            </MotionDiv>
          </>
        }
      />

      <ErrorAlert error={error} />
      <ErrorAlert error={freshnessWarn} mb={4} />
      {summaryData?.empty_hint && (
        <div
          className="mb-4 flex items-start gap-2 rounded-lg px-4 py-3 md:mb-5 md:gap-3"
          style={{
            background: "rgba(31,63,254,0.08)",
            border: "1px solid rgba(31,63,254,0.22)",
          }}
        >
          <p className="flex-1 text-sm font-medium leading-[1.65] text-ink-brand">
            {summaryData.empty_hint}
          </p>
        </div>
      )}

      {telemetryWindow?.anchor === "latest_in_db" && telemetryWindow?.until_utc && (
        <p className="mb-5 text-xs leading-relaxed text-ink-muted">
          Historical snapshot: window ends{" "}
          <span className="font-semibold text-ink">{telemetryWindow.until_utc}</span> UTC (
          {telemetryWindow.since_utc} → {telemetryWindow.until_utc}).
        </p>
      )}

      {/* KPI strip — minmax prevents grid blowout; dense cols only on xl+ */}
      <MotionDiv
        variants={stagger}
        initial="initial"
        animate="animate"
        className="mb-4 grid w-full min-w-0 grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 md:mb-6 md:grid-cols-3 md:gap-4 2xl:grid-cols-6"
      >
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <MotionDiv key={i} variants={fadeUp} className="min-w-0">
              <SkeletonKpiCard />
            </MotionDiv>
          ))
        ) : (
          <>
            <MotionDiv variants={fadeUp} className="min-w-0">
              <HoverGradientCard padding={0} bg="transparent" border={false}>
                <KpiCard
                  label="Chiller 1 kW/TR"
                  value={s.chiller_1?.avg_kw_per_tr}
                  decimals={3}
                  accent={
                    s.chiller_1?.avg_kw_per_tr == null
                      ? "text.muted"
                      : s.chiller_1.avg_kw_per_tr < 0.65
                        ? GREEN_400
                        : s.chiller_1.avg_kw_per_tr < 0.85
                          ? YELLOW_400
                          : RED_400
                  }
                  helpText="Efficiency"
                  icon={<Snowflake {...KPI_ICON} />}
                />
              </HoverGradientCard>
            </MotionDiv>
            <MotionDiv variants={fadeUp} className="min-w-0">
              <HoverGradientCard padding={0} bg="transparent" border={false}>
                <KpiCard
                  label="Chiller 2 kW/TR"
                  value={s.chiller_2?.avg_kw_per_tr}
                  decimals={3}
                  accent={
                    s.chiller_2?.avg_kw_per_tr == null
                      ? "text.muted"
                      : s.chiller_2.avg_kw_per_tr < 0.65
                        ? GREEN_400
                        : s.chiller_2.avg_kw_per_tr < 0.85
                          ? YELLOW_400
                          : RED_400
                  }
                  helpText="Efficiency"
                  icon={<Snowflake {...KPI_ICON} />}
                />
              </HoverGradientCard>
            </MotionDiv>
            <MotionDiv variants={fadeUp} className="min-w-0">
              <HoverGradientCard padding={0} bg="transparent" border={false}>
                <KpiCard
                  label="CH1 Load"
                  value={s.chiller_1?.avg_chiller_load}
                  unit="%"
                  decimals={1}
                  icon={<Gauge {...KPI_ICON} />}
                />
              </HoverGradientCard>
            </MotionDiv>
            <MotionDiv variants={fadeUp} className="min-w-0">
              <HoverGradientCard padding={0} bg="transparent" border={false}>
                <KpiCard
                  label="CH2 Load"
                  value={s.chiller_2?.avg_chiller_load}
                  unit="%"
                  decimals={1}
                  icon={<Gauge {...KPI_ICON} />}
                />
              </HoverGradientCard>
            </MotionDiv>
            <MotionDiv variants={fadeUp} className="min-w-0">
              <HoverGradientCard padding={0} bg="transparent" border={false}>
                <KpiCard
                  label="Ambient"
                  value={s.chiller_1?.latest_ambient_temp}
                  unit="°C"
                  decimals={1}
                  icon={<ThermometerSun {...KPI_ICON} />}
                />
              </HoverGradientCard>
            </MotionDiv>
            <MotionDiv variants={fadeUp} className="min-w-0">
              <HoverGradientCard padding={0} bg="transparent" border={false}>
                <KpiCard
                  label="CHW Supply"
                  value={s.chiller_1?.latest_evap_leaving}
                  unit="°C"
                  decimals={1}
                  icon={<Droplets {...KPI_ICON} />}
                />
              </HoverGradientCard>
            </MotionDiv>
          </>
        )}
      </MotionDiv>

      {/* Equipment Grid */}
      <Eyebrow className="mb-4">Equipment Overview</Eyebrow>

      <MotionDiv
        variants={stagger}
        initial="initial"
        animate="animate"
        className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-2 xl:grid-cols-3"
      >
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <MotionDiv key={i} variants={fadeUp} className="min-w-0">
              <SkeletonEquipCard />
            </MotionDiv>
          ))
        ) : (
          <>
            <EquipCard name="Chiller 1" data={s.chiller_1} type="chiller" />
            <EquipCard name="Chiller 2" data={s.chiller_2} type="chiller" />
            <EquipCard name="Cooling Tower 1" data={s.cooling_tower_1} type="ct" />
            <EquipCard name="Cooling Tower 2" data={s.cooling_tower_2} type="ct" />
            <EquipCard name="Condenser Pump 1-2" data={s.condenser_pump_1} type="pump" />
            <EquipCard name="Condenser Pump 3" data={s.condenser_pump_3} type="pump" />
          </>
        )}
      </MotionDiv>
    </PageShell>
  );
}
