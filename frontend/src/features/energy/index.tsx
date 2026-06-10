import { useState, type ReactNode } from "react";
import { Zap, IndianRupee, Gauge, Loader2 } from "lucide-react";
import PageShell from "@/shared/ui/PageShell";
import PageHeader from "@/shared/ui/PageHeader";
import PageHeaderIcon from "@/shared/ui/PageHeaderIcon";
import GlassCard from "@/shared/ui/GlassCard";
import Eyebrow from "@/shared/ui/Eyebrow";
import GlassSelect from "@/shared/ui/GlassSelect";
import useApi from "@/shared/hooks/useApi";

// ── Response shapes (derived from legacy field usage) ───────────────────────
interface EnergyByType {
  device_type: string;
  kwh: number;
  cost_inr: number;
}

interface EnergyByDevice {
  device_id: string;
  name?: string;
  device_type: string;
  kwh: number;
  cost_inr: number;
}

interface EnergyCost {
  by_device: EnergyByDevice[];
  by_type: EnergyByType[];
  total_kwh: number;
  total_cost_inr: number;
  days?: number;
  tariff_inr_per_kwh?: number;
  tariff_source?: string;
}

interface MetersResponse {
  total?: number;
}

const EMPTY_COST: EnergyCost = { by_device: [], by_type: [], total_kwh: 0, total_cost_inr: 0 };

const fmt = (n: number | null | undefined): string =>
  (n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 });

function Stat({ icon, label, value, sub }: { icon: ReactNode; label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <GlassCard className="p-4">
      <div className="mb-1 flex items-center gap-2 text-ink-muted">
        {icon}
        <p className="text-[11px] tracking-[0.08em] uppercase">{label}</p>
      </div>
      <p className="text-[26px] leading-[1.1] font-extrabold text-ink">{value}</p>
      {sub && <p className="mt-1 text-[11px] text-ink-faint">{sub}</p>}
    </GlassCard>
  );
}

export default function EnergyPage() {
  const [days, setDays] = useState<number>(7);

  // Two fetches mirror the legacy Promise.all. On error the legacy code fell
  // back to an empty cost object (renders empty states, not an error banner).
  const { data: costData, isLoading: costLoading, error: costError } = useApi<EnergyCost>(
    `/api/v1/energy/cost?period=daily&days=${days}`,
  );
  const { data: metersData, isLoading: metersLoading } = useApi<MetersResponse>(`/api/v1/energy/meters`);

  // Legacy showed the spinner on EVERY period change (it set data=null each
  // time), so gate on the cost request's loading flag — `costData` is retained
  // by useApi across refetches and would otherwise suppress the spinner.
  const loading = costLoading;
  const data: EnergyCost | null = costData ?? (costError ? EMPTY_COST : null);
  const meters = metersLoading ? 0 : metersData?.total ?? 0;

  const maxType = Math.max(1, ...((data?.by_type ?? []).map((t) => t.kwh)));

  return (
    <PageShell>
      <PageHeader
        title="Energy Management"
        icon={<PageHeaderIcon icon={<Zap size={20} strokeWidth={1.85} />} />}
        subtitle="Plant energy consumption & cost from the IBMS energy meters"
        actions={
          <GlassSelect
            value={days}
            onChange={(v) => setDays(Number(v))}
            width="130px"
            options={[
              { value: 1, label: "Last 1 day" },
              { value: 7, label: "Last 7 days" },
              { value: 30, label: "Last 30 days" },
              { value: 90, label: "Last 90 days" },
            ]}
          />
        }
      />

      {loading || data === null ? (
        <div className="flex items-center gap-2 py-6 text-ink-muted">
          <Loader2 className="size-4 animate-spin" />
          <p>Loading energy data…</p>
        </div>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat
              icon={<Zap size={14} />}
              label="Total energy"
              value={`${fmt(data.total_kwh)} kWh`}
              sub={`last ${data.days} days`}
            />
            <Stat
              icon={<IndianRupee size={14} />}
              label="Total cost"
              value={`₹${fmt(data.total_cost_inr)}`}
              sub={`@ ₹${data.tariff_inr_per_kwh}/kWh · ${data.tariff_source}`}
            />
            <Stat icon={<Gauge size={14} />} label="Energy meters" value={meters} sub="IBMS EMS subsystems" />
          </div>

          <div className="mb-5">
            <Eyebrow className="mb-2">By equipment type</Eyebrow>
            <GlassCard className="p-4">
              {(data.by_type ?? []).map((t) => (
                <div key={t.device_type} className="mb-3">
                  <div className="mb-1 flex justify-between">
                    <p className="text-[13px] font-semibold text-ink-secondary">{t.device_type}</p>
                    <p className="text-[13px] text-ink-muted">
                      {fmt(t.kwh)} kWh · ₹{fmt(t.cost_inr)}
                    </p>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-chip">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${Math.round((t.kwh / maxType) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </GlassCard>
          </div>

          <Eyebrow className="mb-2">By device</Eyebrow>
          <GlassCard className="p-2">
            <div className="hidden px-3 py-2 md:flex">
              <p className="flex-[2] text-[10px] font-bold text-ink-faint uppercase">Device</p>
              <p className="flex-[1.2] text-[10px] font-bold text-ink-faint uppercase">Type</p>
              <p className="flex-1 text-right text-[10px] font-bold text-ink-faint uppercase">kWh</p>
              <p className="flex-1 text-right text-[10px] font-bold text-ink-faint uppercase">Cost</p>
            </div>
            {(data.by_device ?? []).map((d) => (
              <div
                key={d.device_id}
                className="flex items-center rounded-[10px] px-3 py-[9px] hover:bg-[rgba(31,63,254,0.04)]"
              >
                <p className="flex-[2] line-clamp-1 text-[13px] font-semibold text-ink">{d.name || d.device_id}</p>
                <p className="flex-[1.2] text-[12px] text-ink-secondary">{d.device_type}</p>
                <p className="flex-1 text-right text-[13px] text-ink-secondary tabular-nums">{fmt(d.kwh)}</p>
                <p className="flex-1 text-right text-[13px] text-ink-muted tabular-nums">₹{fmt(d.cost_inr)}</p>
              </div>
            ))}
          </GlassCard>
        </>
      )}
    </PageShell>
  );
}
