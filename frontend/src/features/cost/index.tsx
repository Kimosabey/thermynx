import { useState } from "react";
import { motion } from "framer-motion";
import { IndianRupee } from "lucide-react";
import PageShell from "@/shared/ui/PageShell";
import PageHeader from "@/shared/ui/PageHeader";
import PageHeaderIcon from "@/shared/ui/PageHeaderIcon";
import Eyebrow from "@/shared/ui/Eyebrow";
import PeriodSelect from "@/shared/ui/PeriodSelect";
import GlassCard from "@/shared/ui/GlassCard";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import useApi from "@/shared/hooks/useApi";

interface CostEquipmentRow {
  equipment_id: number | string;
  name: string;
  type: string;
  kwh?: number;
  cost_inr?: number;
  run_hours?: number | null;
  inr_per_tr_hr?: number | null;
}

interface CostResponse {
  total_kwh?: number | null;
  total_cost_inr?: number | null;
  tariff_inr_per_kwh?: number | null;
  equipment?: CostEquipmentRow[];
}

interface KpiSpec {
  label: string;
  value: string;
  /** Tailwind class or null when an explicit hex (color prop) is used. */
  className?: string;
  color?: string;
}

export default function CostPage() {
  const [hours, setHours] = useState(24);
  const { data, isLoading: loading } = useApi<CostResponse>(`/api/v1/cost?hours=${hours}`);

  const eq = data?.equipment ?? [];

  const kpis: KpiSpec[] = [
    {
      label: "Plant kWh",
      value: data?.total_kwh != null ? data.total_kwh.toFixed(2) : "—",
      className: "text-cyan",
    },
    {
      label: "Plant cost",
      value: data?.total_cost_inr != null ? `₹ ${data.total_cost_inr.toLocaleString()}` : "—",
      color: "#48BB78", // Chakra green.400
    },
    {
      label: "Tariff",
      value: data?.tariff_inr_per_kwh != null ? `₹ ${data.tariff_inr_per_kwh}/kWh` : "—",
      color: "#9F7AEA", // Chakra purple.400
    },
  ];

  return (
    <PageShell>
      <PageHeader
        title="Cost Analytics"
        subtitle="Electrical energy from bucketed kW × flat ₹/kWh · ₹/TR-h on chillers"
        icon={<PageHeaderIcon icon={<IndianRupee size={20} strokeWidth={1.85} />} />}
        actions={<PeriodSelect value={hours} onChange={setHours} />}
      />

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        {kpis.map((k) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <GlassCard>
              <Eyebrow className="mb-2">{k.label}</Eyebrow>
              <p
                className={`text-2xl font-extrabold tabular-nums ${k.className ?? ""}`}
                style={k.color ? { color: k.color } : undefined}
              >
                {loading ? "…" : k.value}
              </p>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      <GlassCard className="overflow-hidden p-0">
        <div className="border-b border-border-subtle px-5 py-4">
          <p className="text-sm font-bold">Equipment rollup</p>
          <p className="text-xs text-ink-muted">15-minute buckets · energy gated on is_running</p>
        </div>
        <div className="overflow-x-auto">
          <Table className="text-sm">
            <TableHeader>
              <TableRow>
                <TableHead className="text-ink-muted">Equipment</TableHead>
                <TableHead className="text-ink-muted">Type</TableHead>
                <TableHead className="text-right text-ink-muted">kWh</TableHead>
                <TableHead className="text-right text-ink-muted">INR</TableHead>
                <TableHead className="text-right text-ink-muted">Run h</TableHead>
                <TableHead className="text-right text-ink-muted">₹/TR-h</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eq.map((row) => (
                <TableRow key={row.equipment_id}>
                  <TableCell className="font-semibold">{row.name}</TableCell>
                  <TableCell>{row.type}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.kwh?.toFixed(3)}</TableCell>
                  <TableCell className="text-right tabular-nums">₹ {row.cost_inr?.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{row.run_hours?.toFixed(2) ?? "—"}</TableCell>
                  <TableCell className="text-right">{row.inr_per_tr_hr?.toFixed(4) ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </GlassCard>
    </PageShell>
  );
}
