import { useState, type CSSProperties, type ComponentType } from "react";
import { BellRing, TriangleAlert, Activity, Info } from "lucide-react";
import { motion } from "framer-motion";
import PageShell from "@/shared/ui/PageShell";
import PageHeader from "@/shared/ui/PageHeader";
import GlassSelect from "@/shared/ui/GlassSelect";
import GlassCard from "@/shared/ui/GlassCard";
import PageHeaderIcon from "@/shared/ui/PageHeaderIcon";
import Eyebrow from "@/shared/ui/Eyebrow";
import { SkeletonKpiCard } from "@/shared/ui/SkeletonCard";
import { Badge } from "@/components/ui/badge";
import useApi from "@/shared/hooks/useApi";

// ── Response shapes (derived from legacy field usage) ──────────────────────────
type Severity = "critical" | "warning" | "info";

interface Alarm {
  id: string | number;
  severity: Severity;
  equipment_name: string;
  kind: string;
  message: string;
  value?: number | null;
}

interface AlarmsResponse {
  alarms?: Alarm[];
}

interface AlarmsStats {
  total: number;
  by_severity?: Partial<Record<Severity, number>>;
}

// ── Severity palette (data-only, fixed hex — verbatim from legacy) ──────────────
interface SevSpec {
  color: string;
  bg: string;
  border: string;
  Icon: ComponentType<{ size?: number; strokeWidth?: number }>;
}

const SEV: Record<Severity, SevSpec> = {
  critical: { color: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.32)", Icon: TriangleAlert },
  warning: { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.32)", Icon: Activity },
  info: { color: "#0ea5e9", bg: "rgba(14,165,233,0.12)", border: "rgba(14,165,233,0.32)", Icon: Info },
};

function SeverityChip({ severity }: { severity: Severity }) {
  const s = SEV[severity] || SEV.info;
  const Icon = s.Icon;
  return (
    <div
      className="flex w-fit items-center gap-1.5 rounded-[6px] border px-2 py-[3px] text-[10px] font-bold tracking-[0.06em] uppercase"
      style={{ background: s.bg, borderColor: s.border, color: s.color }}
    >
      <Icon size={11} strokeWidth={2.2} />
      {severity}
    </div>
  );
}

const GRID_COLS = "100px 160px 110px minmax(0,1fr) 90px";

export default function AlarmsPage() {
  const [hours, setHours] = useState<number>(1);
  const [severity, setSeverity] = useState<string>("");

  const sevQ = severity ? `&severity=${severity}` : "";
  const { data, isLoading: listLoading } = useApi<AlarmsResponse>(
    `/api/v1/alarms?hours=${hours}${sevQ}&limit=100`,
  );
  const { data: stats, isLoading: statsLoading } = useApi<AlarmsStats>(
    `/api/v1/alarms/stats?hours=${hours}`,
  );

  const loading = listLoading || statsLoading;
  const alarms = data?.alarms || [];

  const kpis: { l: string; v: number; c: string }[] = stats
    ? [
        { l: "Total", v: stats.total, c: "var(--ink)" },
        { l: "Critical", v: stats.by_severity?.critical ?? 0, c: SEV.critical.color },
        { l: "Warning", v: stats.by_severity?.warning ?? 0, c: SEV.warning.color },
        { l: "Info", v: stats.by_severity?.info ?? 0, c: SEV.info.color },
      ]
    : [];

  return (
    <PageShell>
      <PageHeader
        title="Alarms"
        icon={<PageHeaderIcon icon={<BellRing size={20} strokeWidth={1.85} />} />}
        subtitle="Unified anomaly + maintenance alerts with severity tiers"
        actions={
          <div className="flex flex-wrap gap-3">
            <GlassSelect
              value={severity}
              onChange={(v) => setSeverity(String(v))}
              width="150px"
              options={[
                { value: "", label: "All severities" },
                { value: "critical", label: "Critical" },
                { value: "warning", label: "Warning" },
                { value: "info", label: "Info" },
              ]}
            />
            <GlassSelect
              value={hours}
              onChange={(v) => setHours(Number(v))}
              width="130px"
              options={[
                { value: 1, label: "Last 1h" },
                { value: 6, label: "Last 6h" },
                { value: 24, label: "Last 24h" },
                { value: 72, label: "Last 72h" },
                { value: 168, label: "Last 7d" },
              ]}
            />
          </div>
        }
      />

      {/* Severity KPIs */}
      {stats && !loading && (
        <div className="mb-6 grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.04 }}
            >
              <GlassCard className="p-4">
                <Eyebrow className="mb-2">{s.l}</Eyebrow>
                <p
                  className="text-2xl font-bold [font-variant-numeric:tabular-nums]"
                  style={{ color: s.c }}
                >
                  {s.v}
                </p>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      )}

      {loading ? (
        <SkeletonKpiCard />
      ) : alarms.length === 0 ? (
        <GlassCard className="flex items-center justify-center p-6">
          <p className="text-sm text-ink-muted">No alarms in this window.</p>
        </GlassCard>
      ) : (
        <GlassCard className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <div className="min-w-[720px]">
              <div
                className="grid gap-3 border-b border-border-subtle px-4 py-3"
                style={{ gridTemplateColumns: GRID_COLS }}
              >
                <Eyebrow>Severity</Eyebrow>
                <Eyebrow>Equipment</Eyebrow>
                <Eyebrow>Kind</Eyebrow>
                <Eyebrow>Message</Eyebrow>
                <Eyebrow>Value</Eyebrow>
              </div>
              {alarms.map((a, i) => (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: Math.min(i, 12) * 0.015 }}
                >
                  <div
                    className="grid items-center gap-3 border-b border-border-subtle px-4 py-[10px] hover:bg-[rgba(31,63,254,0.04)]"
                    style={{ gridTemplateColumns: GRID_COLS }}
                  >
                    <SeverityChip severity={a.severity} />
                    <p className="line-clamp-1 text-xs font-semibold text-ink">{a.equipment_name}</p>
                    <Badge
                      variant="outline"
                      className="w-fit rounded-[6px] border-border-subtle bg-chip px-2 text-[9px] text-ink-muted"
                    >
                      {a.kind}
                    </Badge>
                    <p className="line-clamp-2 text-xs text-ink-muted">{a.message}</p>
                    <p
                      className="text-right text-xs font-bold text-ink"
                      style={{ fontVariantNumeric: "tabular-nums" } as CSSProperties}
                    >
                      {a.value != null ? Number(a.value).toFixed(2) : "—"}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </GlassCard>
      )}
    </PageShell>
  );
}
