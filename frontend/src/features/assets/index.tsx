import { useMemo, useState } from "react";
import { Boxes, MapPin, Activity, Loader2 } from "lucide-react";
import PageShell from "@/shared/ui/PageShell";
import PageHeader from "@/shared/ui/PageHeader";
import PageHeaderIcon from "@/shared/ui/PageHeaderIcon";
import GlassCard from "@/shared/ui/GlassCard";
import Eyebrow from "@/shared/ui/Eyebrow";
import { Badge } from "@/components/ui/badge";
import useApi from "@/shared/hooks/useApi";
import { cn } from "@/lib/utils";

interface Asset {
  id: string | number;
  name: string;
  ss_type: string;
  type_label: string;
  status: string;
  monitored?: boolean;
  zone_name?: string | null;
  address?: string | null;
}

interface AssetType {
  ss_type: string;
  type_label: string;
  count: number;
}

interface AssetsResponse {
  assets?: Asset[];
}

interface AssetTypesResponse {
  types?: AssetType[];
}

const STATUS_COLOR: Record<string, string> = {
  active: "text-good",
  inactive: "text-ink-muted",
};

export default function AssetsPage() {
  const { data: assetsData, error: assetsError } = useApi<AssetsResponse>("/api/v1/assets");
  const { data: typesData } = useApi<AssetTypesResponse>("/api/v1/assets/types");
  const [filter, setFilter] = useState("");

  // Legacy: assets stays `null` until loaded; on error it falls back to [].
  const assets = assetsError ? [] : assetsData?.assets ?? (assetsData ? [] : null);
  const types = typesData?.types ?? [];

  const shown = useMemo(
    () => (assets || []).filter((a) => !filter || a.ss_type === filter),
    [assets, filter],
  );
  const total = assets?.length ?? 0;
  const monitored = (assets || []).filter((a) => a.monitored).length;

  return (
    <PageShell>
      <PageHeader
        title="Asset Registry"
        icon={<PageHeaderIcon icon={<Boxes size={20} strokeWidth={1.85} />} />}
        subtitle={`Plant equipment & meters from the IBMS registry — ${total} assets, ${monitored} with live telemetry`}
      />

      {/* Type summary chips (click to filter) */}
      <div className="mb-5">
        <Eyebrow className="mb-2">By type</Eyebrow>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFilter("")}
            className={cn(
              "rounded-[10px] border px-3 py-[6px] text-[12px] font-semibold",
              filter === ""
                ? "bg-[var(--glow)] text-ink-brand border-border-brand"
                : "bg-chip text-ink-secondary border-border-subtle",
            )}
          >
            All ({total})
          </button>
          {types.map((t) => (
            <button
              key={t.ss_type}
              type="button"
              onClick={() => setFilter(t.ss_type)}
              className={cn(
                "rounded-[10px] border px-3 py-[6px] text-[12px] font-semibold",
                filter === t.ss_type
                  ? "bg-[var(--glow)] text-ink-brand border-border-brand"
                  : "bg-chip text-ink-secondary border-border-subtle",
              )}
            >
              {t.type_label} ({t.count})
            </button>
          ))}
        </div>
      </div>

      <GlassCard className="p-2">
        {/* header row */}
        <div className="hidden items-center gap-3 px-3 py-[8px] md:flex">
          <p className="flex-[2] text-[10px] font-bold tracking-[0.08em] text-ink-faint uppercase">
            Asset
          </p>
          <p className="flex-[1.4] text-[10px] font-bold tracking-[0.08em] text-ink-faint uppercase">
            Type
          </p>
          <p className="flex-[1] text-[10px] font-bold tracking-[0.08em] text-ink-faint uppercase">
            Status
          </p>
          <p className="flex-[1.4] text-[10px] font-bold tracking-[0.08em] text-ink-faint uppercase">
            Zone
          </p>
          <p className="flex-[1.6] text-[10px] font-bold tracking-[0.08em] text-ink-faint uppercase">
            Address
          </p>
        </div>

        {assets === null && (
          <div className="flex items-center gap-2 px-3 py-4 text-ink-muted">
            <Loader2 className="size-3 animate-spin" />
            <p className="text-sm">Loading asset registry…</p>
          </div>
        )}
        {assets !== null && shown.length === 0 && (
          <p className="px-3 py-4 text-sm text-ink-muted">No assets match this filter.</p>
        )}

        {shown.map((a) => (
          <div
            key={a.id}
            className="flex flex-wrap items-center gap-3 rounded-[10px] px-3 py-[10px] transition-[background] duration-150 hover:bg-[rgba(31,63,254,0.04)] md:flex-nowrap"
          >
            <div className="flex min-w-0 flex-[1_0_100%] items-center gap-2 md:flex-[2]">
              <div className="flex size-[26px] shrink-0 items-center justify-center rounded-[7px] border border-border-brand bg-[var(--glow)] text-brand">
                <Activity size={13} strokeWidth={2} />
              </div>
              <p className="line-clamp-1 text-sm font-bold text-ink">{a.name}</p>
              {a.monitored && (
                <Badge className="h-auto rounded-[5px] border border-border-brand bg-[var(--glow)] px-[5px] py-0 text-[8px] font-medium text-ink-brand">
                  LIVE
                </Badge>
              )}
            </div>
            <p className="line-clamp-1 flex-[1_0_auto] text-[13px] text-ink-secondary md:flex-[1.4]">
              {a.type_label}
            </p>
            <div className="flex-[0_0_auto] md:flex-[1]">
              <Badge
                className={cn(
                  "h-auto rounded-[6px] border border-border-subtle bg-chip px-2 py-[2px] text-[9px] font-medium",
                  STATUS_COLOR[a.status] || "text-ink-muted",
                )}
              >
                {a.status}
              </Badge>
            </div>
            <div className="flex min-w-0 flex-[1_0_auto] items-center gap-1 text-ink-muted md:flex-[1.4]">
              {a.zone_name ? (
                <>
                  <MapPin size={11} />
                  <p className="line-clamp-1 text-[12px]">{a.zone_name}</p>
                </>
              ) : (
                <p className="text-[12px] text-ink-faint">—</p>
              )}
            </div>
            <p
              className="line-clamp-1 flex-[1_0_auto] font-mono text-[11px] text-ink-faint md:flex-[1.6]"
              title={a.address || ""}
            >
              {a.address || "—"}
            </p>
          </div>
        ))}
      </GlassCard>
    </PageShell>
  );
}
