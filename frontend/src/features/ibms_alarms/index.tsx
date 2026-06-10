import { useState } from "react";
import { BellRing, Check, ClipboardPlus, Loader2 } from "lucide-react";
import PageShell from "@/shared/ui/PageShell";
import PageHeader from "@/shared/ui/PageHeader";
import PageHeaderIcon from "@/shared/ui/PageHeaderIcon";
import GlassCard from "@/shared/ui/GlassCard";
import { Button } from "@/components/ui/button";
import useApi from "@/shared/hooks/useApi";
import { apiFetch } from "@/shared/api/client";
import useAppToast from "@/shared/hooks/useAppToast";
import { cn } from "@/lib/utils";

interface AlarmAction {
  operator_acked?: boolean;
  wo_id?: string;
}

interface IbmsAlarm {
  id: number | string;
  asset_name?: string;
  asset_type?: string;
  message?: string;
  active?: boolean;
  action?: AlarmAction;
}

interface AlarmsResponse {
  alarms?: IbmsAlarm[];
}

interface ActionResponse {
  detail?: string;
  work_order_id?: string;
}

type ActionKind = "ack" | "wo";

export default function IbmsAlarmsPage() {
  const { data, isLoading, refetch } = useApi<AlarmsResponse>("/api/v1/alarms/ibms?limit=100");
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useAppToast();

  const alarms = data?.alarms ?? [];

  async function act(id: number | string, kind: ActionKind) {
    setBusy(`${id}:${kind}`);
    try {
      const body =
        kind === "ack"
          ? { acknowledged_by: "operator" }
          : { created_by: "operator", priority: "high" };
      const res = await apiFetch(
        `/api/v1/alarms/ibms/${id}/${kind === "ack" ? "ack" : "raise-wo"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const d = (await res.json()) as ActionResponse;
      if (!res.ok) throw new Error(d.detail || "failed");
      toast.success(
        kind === "ack"
          ? "Acknowledged"
          : `Work order ${d.work_order_id?.slice(0, 8)} raised`,
      );
      await refetch();
    } catch (e) {
      const err = e as { message?: string };
      toast.error("Action failed", String(err.message || e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="IBMS Alarms"
        icon={<PageHeaderIcon icon={<BellRing size={20} strokeWidth={1.85} />} />}
        subtitle="Building-management alarm log — acknowledge or raise a work order"
      />
      <GlassCard className="p-2">
        {/* Column headers (desktop only) */}
        <div className="hidden gap-3 px-3 py-2 md:flex">
          <p className="flex-[1.4] text-[10px] font-bold uppercase text-ink-faint">Asset</p>
          <p className="flex-[2.4] text-[10px] font-bold uppercase text-ink-faint">Message</p>
          <p className="flex-1 text-[10px] font-bold uppercase text-ink-faint">State</p>
          <p className="flex-[1.4] text-right text-[10px] font-bold uppercase text-ink-faint">
            Actions
          </p>
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 px-3 py-4 text-ink-muted">
            <Loader2 className="size-3 animate-spin" />
            <p className="text-sm">Loading alarms…</p>
          </div>
        )}

        {!isLoading && alarms.length === 0 && (
          <p className="px-3 py-4 text-sm text-ink-muted">No alarms.</p>
        )}

        {!isLoading &&
          alarms.map((a) => (
            <div
              key={a.id}
              className="flex flex-wrap items-center gap-3 rounded-[10px] px-3 py-2.5 hover:bg-[rgba(31,63,254,0.04)] md:flex-nowrap"
            >
              <div className="flex min-w-0 flex-col flex-[1_0_100%] md:flex-[1.4]">
                <p className="line-clamp-1 text-[13px] font-bold text-ink">
                  {a.asset_name || "—"}
                </p>
                <p className="text-[10px] text-ink-faint">
                  {a.asset_type} · #{a.id}
                </p>
              </div>
              <p
                className="line-clamp-1 flex-[1_0_auto] text-[13px] text-ink-secondary md:flex-[2.4]"
                title={a.message}
              >
                {a.message}
              </p>
              <div className="flex flex-[0_0_auto] gap-1 md:flex-1">
                <span
                  className={cn(
                    "rounded-[6px] border border-border-subtle px-2 py-0.5 text-[9px]",
                    a.active ? "bg-[rgba(220,38,38,0.12)] text-bad" : "bg-chip text-ink-muted",
                  )}
                >
                  {a.active ? "active" : "restored"}
                </span>
                {a.action?.operator_acked && (
                  <span className="rounded-[6px] border border-transparent bg-[var(--glow)] px-2 py-0.5 text-[9px] text-ink-brand">
                    acked
                  </span>
                )}
              </div>
              <div className="flex flex-[1_0_auto] justify-end gap-2 md:flex-[1.4]">
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => act(a.id, "ack")}
                  disabled={busy === `${a.id}:ack` || a.action?.operator_acked}
                >
                  {busy === `${a.id}:ack` ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Check size={12} />
                  )}
                  Ack
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => act(a.id, "wo")}
                  disabled={busy === `${a.id}:wo` || !!a.action?.wo_id}
                >
                  {busy === `${a.id}:wo` ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <ClipboardPlus size={12} />
                  )}
                  {a.action?.wo_id ? "WO raised" : "Raise WO"}
                </Button>
              </div>
            </div>
          ))}
      </GlassCard>
    </PageShell>
  );
}
