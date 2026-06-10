import { useState, type KeyboardEvent } from "react";
import { motion } from "framer-motion";
import { Gauge, Sparkles, CheckCircle2, ClipboardList } from "lucide-react";
import PageShell from "@/shared/ui/PageShell";
import PageHeader from "@/shared/ui/PageHeader";
import PageHeaderIcon from "@/shared/ui/PageHeaderIcon";
import Eyebrow from "@/shared/ui/Eyebrow";
import GlassCard from "@/shared/ui/GlassCard";
import KpiCard from "@/shared/ui/KpiCard";
import ErrorAlert from "@/shared/ui/ErrorAlert";
import { SkeletonKpiCard, SkeletonChartCard } from "@/shared/ui/SkeletonCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import useApi from "@/shared/hooks/useApi";
import { apiFetch } from "@/shared/api/client";
import useAppToast from "@/shared/hooks/useAppToast";
import { useModelToast } from "@/shared/ai/useModels";

// ── Response shapes (derived from legacy field usage) ───────────────────────
interface StagingOption {
  label: string;
  est_kw?: number | null;
  feasible?: boolean;
  note?: string;
}

interface StagingProfile {
  equipment_id: string;
  name: string;
  currently_running?: boolean;
  capacity_tr?: number | null;
  overall_kw_per_tr?: number | null;
  latest_tr?: number | null;
  samples?: number;
}

interface RecommendedStaging {
  label: string;
  est_kw?: number | null;
}

interface ProposedWorkOrder {
  title?: string;
  [key: string]: unknown;
}

interface OptimizerStaging {
  target_tr?: number | null;
  target_source?: string;
  current_chillers?: unknown[];
  current_est_kw?: number | null;
  recommended?: RecommendedStaging | null;
  savings_kw?: number | null;
  savings_pct?: number | null;
  savings_inr_per_hr?: number | null;
  narrative?: string;
  rationale?: string[];
  options?: StagingOption[];
  profiles?: StagingProfile[];
  proposed_work_order?: ProposedWorkOrder | null;
}

const fmt = (v: number | null | undefined, d = 1): string =>
  v == null ? "—" : Number(v).toLocaleString(undefined, { maximumFractionDigits: d });

export default function EnergyOptimizerPage() {
  const [whatIf, setWhatIf] = useState<string>(""); // target TR override (string)
  const [appliedTr, setAppliedTr] = useState<string | null>(null);
  const toast = useAppToast();
  const notifyModel = useModelToast();
  const [creating, setCreating] = useState<boolean>(false);

  const url = `/api/v1/optimizer/staging?hours=72${appliedTr ? `&target_tr=${appliedTr}` : ""}`;
  const { data, isLoading, error, refetch } = useApi<OptimizerStaging>(url);

  const rec = data?.recommended;
  const saves = data?.savings_kw != null && data.savings_kw > 0;
  const wo = data?.proposed_work_order;

  async function createWorkOrder() {
    if (!wo) return;
    setCreating(true);
    try {
      const res = await apiFetch("/api/v1/work-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...wo, created_by: "operator" }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { detail?: string };
        throw new Error(body.detail || `HTTP ${res.status}`);
      }
      toast.success("Work order created", wo.title);
    } catch (e) {
      toast.error("Failed to create work order", (e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Energy Optimizer"
        subtitle="Lowest-energy chiller staging for the cooling demand · deterministic math, human-approved actions"
        icon={<PageHeaderIcon icon={<Gauge size={20} strokeWidth={1.85} />} />}
        actions={
          <div className="flex items-center gap-2">
            <Input
              className="h-7 w-[150px] text-[0.8rem]"
              placeholder="What-if TR"
              value={whatIf}
              onChange={(e) => setWhatIf(e.target.value.replace(/[^0-9.]/g, ""))}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                if (e.key === "Enter") setAppliedTr(whatIf || null);
              }}
            />
            <Button
              size="sm"
              onClick={() => {
                notifyModel("text", { prefix: "Optimizer" });
                setAppliedTr(whatIf || null);
              }}
            >
              Simulate
            </Button>
            {appliedTr && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setWhatIf("");
                  setAppliedTr(null);
                }}
              >
                reset
              </Button>
            )}
          </div>
        }
      />

      <ErrorAlert error={error} onRetry={refetch} />

      {isLoading ? (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonKpiCard key={i} />
            ))}
          </div>
          <SkeletonChartCard />
        </>
      ) : !data ? null : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Target demand"
              value={data.target_tr}
              unit="TR"
              decimals={1}
              accent="accent.cyan"
              helpText={data.target_source === "user" ? "what-if" : "observed now"}
            />
            <KpiCard
              label="Current staging"
              value={data.current_chillers?.length ? `${data.current_chillers.length} on` : "none"}
              accent="text.primary"
              helpText={data.current_est_kw != null ? `est ${fmt(data.current_est_kw)} kW` : "—"}
            />
            <KpiCard
              label="Recommended"
              value={rec ? rec.label : "—"}
              accent={saves ? "status.good" : "text.primary"}
              helpText={rec ? `est ${fmt(rec.est_kw)} kW` : ""}
            />
            <KpiCard
              label="Potential saving"
              value={saves ? data.savings_kw : 0}
              unit={saves ? "kW" : ""}
              decimals={1}
              accent={saves ? "status.good" : "text.muted"}
              helpText={saves ? `${fmt(data.savings_pct)}% · ₹${fmt(data.savings_inr_per_hr)}/h` : "already optimal"}
            />
          </div>

          {/* Recommendation + narrative */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <GlassCard>
              <div className="mb-2 flex items-center gap-2">
                {saves ? <Sparkles size={16} strokeWidth={2} /> : <CheckCircle2 size={16} strokeWidth={2} />}
                <Eyebrow className="mb-0">{saves ? "Recommendation" : "Status"}</Eyebrow>
              </div>
              <p className={`text-base ${data.rationale?.length ? "mb-2" : "mb-0"}`}>
                {data.narrative || (data.rationale || []).join(" ") || "No recommendation available for this demand."}
              </p>
              {saves && wo && (
                <Button
                  className="mt-3"
                  size="sm"
                  onClick={createWorkOrder}
                  disabled={creating}
                >
                  <ClipboardList size={15} />
                  {creating ? "Creating…" : "Create work order (approve)"}
                </Button>
              )}
            </GlassCard>
          </motion.div>

          {/* Options table */}
          <GlassCard className="mb-6 overflow-hidden p-0">
            <div className="border-b border-border-subtle px-5 py-4">
              <p className="text-sm font-bold">Staging options @ {fmt(data.target_tr)} TR</p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-ink-muted">Configuration</TableHead>
                    <TableHead className="text-right text-ink-muted">Est. kW</TableHead>
                    <TableHead className="text-ink-muted">Feasible</TableHead>
                    <TableHead className="text-ink-muted"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data.options || []).map((o) => {
                    const isRec = rec != null && o.label === rec.label;
                    return (
                      <TableRow key={o.label} className={isRec ? "bg-[var(--glow)]" : undefined}>
                        <TableCell className={isRec ? "font-bold" : "font-medium"}>{o.label}</TableCell>
                        <TableCell className="text-right tabular-nums">{o.feasible ? fmt(o.est_kw) : "—"}</TableCell>
                        <TableCell>
                          {o.feasible ? (
                            <Badge variant="secondary" className="bg-good/15 text-good">
                              yes
                            </Badge>
                          ) : (
                            <Badge variant="secondary">{o.note || "no"}</Badge>
                          )}
                        </TableCell>
                        <TableCell>{isRec && <Badge>recommended</Badge>}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </GlassCard>

          {/* Profiles */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {(data.profiles || []).map((p) => (
              <GlassCard key={p.equipment_id}>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-bold">{p.name}</p>
                  {p.currently_running ? (
                    <Badge variant="secondary" className="bg-good/15 text-good">
                      running
                    </Badge>
                  ) : (
                    <Badge variant="secondary">off</Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-ink-muted">
                  <p>
                    Capacity: <b>{fmt(p.capacity_tr)} TR</b>
                  </p>
                  <p>
                    Avg kW/TR: <b>{fmt(p.overall_kw_per_tr, 3)}</b>
                  </p>
                  <p>
                    Now: <b>{fmt(p.latest_tr)} TR</b>
                  </p>
                  <p>
                    Samples: <b>{p.samples}</b>
                  </p>
                </div>
              </GlassCard>
            ))}
          </div>
        </>
      )}
    </PageShell>
  );
}
