import { useEffect, useState, useCallback, type ComponentType } from "react";
import {
  Server,
  Database,
  HardDrive,
  BookOpen,
  Cpu,
  ExternalLink,
  Copy,
  ScrollText,
  Activity,
  Settings as SettingsIcon,
  ShieldCheck,
  BarChart2,
  Bell,
  FileText,
  Radio,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { motion } from "framer-motion";
import PageShell from "@/shared/ui/PageShell";
import PageHeader from "@/shared/ui/PageHeader";
import PageHeaderIcon from "@/shared/ui/PageHeaderIcon";
import GlassCard from "@/shared/ui/GlassCard";
import Eyebrow from "@/shared/ui/Eyebrow";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import useAppToast from "@/shared/hooks/useAppToast";
import ModelConfigPanel from "./ModelConfigPanel";

type LucideIcon = ComponentType<{ size?: number | string; strokeWidth?: number }>;

interface ServiceItem {
  Icon: LucideIcon;
  label: string;
  url: string;
  port: number;
  healthUrl: string | null;
  role: string;
}

interface ServiceGroup {
  group: string;
  items: ServiceItem[];
}

type LiveStatus = "up" | "down" | "pending";
type StatusMap = Record<string, LiveStatus>;

// healthUrl: endpoint to GET for liveness. null = not HTTP-checkable (DB conn strings).
const SERVICES: ServiceGroup[] = [
  {
    group: "Frontend",
    items: [
      { Icon: Server, label: "Frontend", url: "http://localhost:5173", port: 5173, healthUrl: "http://localhost:5173", role: "Vite dev server (this app)" },
      { Icon: Server, label: "Frontend (preview)", url: "http://localhost:4173", port: 4173, healthUrl: null, role: "Vite preview build (npm run preview)" },
    ],
  },
  {
    group: "Backend API",
    items: [
      { Icon: Activity, label: "Health", url: "http://localhost:8000/healthz", port: 8000, healthUrl: "http://localhost:8000/healthz", role: "Backend liveness" },
      { Icon: Activity, label: "Full health", url: "http://localhost:8000/api/v1/health", port: 8000, healthUrl: "http://localhost:8000/api/v1/health", role: "Backend + DB + Ollama state" },
      { Icon: BookOpen, label: "Swagger UI", url: "http://localhost:8000/docs", port: 8000, healthUrl: "http://localhost:8000/healthz", role: "Interactive OpenAPI explorer" },
      { Icon: BookOpen, label: "ReDoc", url: "http://localhost:8000/redoc", port: 8000, healthUrl: "http://localhost:8000/healthz", role: "Read-only OpenAPI view" },
      { Icon: ScrollText, label: "OpenAPI JSON", url: "http://localhost:8000/openapi.json", port: 8000, healthUrl: "http://localhost:8000/openapi.json", role: "Machine-readable schema" },
      { Icon: BarChart2, label: "Metrics", url: "http://localhost:8000/metrics", port: 8000, healthUrl: "http://localhost:8000/metrics", role: "Prometheus scrape endpoint" },
      { Icon: SettingsIcon, label: "Capabilities", url: "http://localhost:8000/api/v1/capabilities", port: 8000, healthUrl: "http://localhost:8000/api/v1/capabilities", role: "Self-describing feature catalogue" },
      { Icon: ShieldCheck, label: "Slack health", url: "http://localhost:8000/api/v1/slack/health", port: 8000, healthUrl: "http://localhost:8000/api/v1/slack/health", role: "Slack integration status" },
    ],
  },
  {
    group: "Observability",
    items: [
      { Icon: BarChart2, label: "Grafana", url: "http://localhost:3030", port: 3030, healthUrl: "/proxy/grafana", role: "Dashboards — API Overview + AI Operations" },
      { Icon: Radio, label: "Prometheus", url: "http://localhost:9292", port: 9292, healthUrl: "/proxy/prometheus", role: "Metrics store + alert evaluation" },
      { Icon: Bell, label: "Alertmanager", url: "http://localhost:9394", port: 9394, healthUrl: "/proxy/alertmanager", role: "Alert routing + silences" },
      { Icon: FileText, label: "Loki", url: "http://localhost:3100", port: 3100, healthUrl: "/proxy/loki", role: "Log aggregation (Promtail → Loki)" },
      { Icon: Radio, label: "Promtail targets", url: "http://localhost:9080/targets", port: 9080, healthUrl: "/proxy/promtail", role: "Log scrape agent — target list" },
    ],
  },
  {
    group: "Datastores",
    items: [
      { Icon: Database, label: "Unicharm MySQL", url: "mysql://localhost:3307", port: 3307, healthUrl: null, role: "Telemetry source (read-only)" },
      { Icon: Database, label: "Postgres (pgvector)", url: "postgres://localhost:5442", port: 5442, healthUrl: null, role: "App state + RAG embeddings" },
      { Icon: HardDrive, label: "Redis", url: "redis://localhost:6380", port: 6380, healthUrl: null, role: "Cache + arq queue" },
      { Icon: HardDrive, label: "Redis Commander", url: "http://localhost:8181", port: 8181, healthUrl: "/proxy/redis-commander", role: "Browser UI for Redis" },
    ],
  },
  {
    group: "AI Runtime",
    items: [
      { Icon: Cpu, label: "Ollama API", url: "http://100.125.103.28:11434", port: 11434, healthUrl: "http://100.125.103.28:11434/api/tags", role: "On-prem LLM server · per-task model routing" },
      { Icon: Cpu, label: "Ollama models", url: "http://100.125.103.28:11434/api/tags", port: 11434, healthUrl: "http://100.125.103.28:11434/api/tags", role: "List installed models" },
    ],
  },
];

// Collect all unique healthUrls for bulk polling
const HEALTH_URLS: string[] = [
  ...new Set(
    SERVICES.flatMap((g) => g.items.map((i) => i.healthUrl)).filter(
      (u): u is string => Boolean(u),
    ),
  ),
];

function useLiveStatus() {
  const [status, setStatus] = useState<StatusMap>({}); // url → "up"|"down"|"pending"
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const poll = useCallback(async () => {
    setStatus((prev) =>
      Object.fromEntries(HEALTH_URLS.map((u) => [u, prev[u] ?? "pending"])) as StatusMap,
    );
    const results = await Promise.allSettled(
      HEALTH_URLS.map((url) =>
        fetch(url, { method: "GET", signal: AbortSignal.timeout(4000) })
          .then((r) => ({ url, ok: r.status < 500 }))
          .catch(() => ({ url, ok: false })),
      ),
    );
    const next: StatusMap = {};
    results.forEach((r) => {
      if (r.status === "fulfilled") next[r.value.url] = r.value.ok ? "up" : "down";
    });
    setStatus(next);
    setLastChecked(new Date());
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, [poll]);

  return { status, poll, lastChecked };
}

function StatusDot({ healthUrl, status }: { healthUrl: string | null; status: StatusMap }) {
  if (!healthUrl)
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="size-[8px] shrink-0 rounded-full bg-[rgba(255,255,255,0.15)]" />
        </TooltipTrigger>
        <TooltipContent>Not HTTP-checkable</TooltipContent>
      </Tooltip>
    );
  const s: LiveStatus = status[healthUrl] ?? "pending";
  const map: Record<LiveStatus, { bg: string; shadow: string; label: string }> = {
    up: { bg: "#10b981", shadow: "0 0 6px rgba(16,185,129,0.55)", label: "Reachable" },
    down: { bg: "#ef4444", shadow: "0 0 6px rgba(239,68,68,0.55)", label: "Unreachable" },
    pending: { bg: "rgba(255,255,255,0.25)", shadow: "none", label: "Checking…" },
  };
  const { bg, shadow, label } = map[s];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="size-[8px] shrink-0 rounded-full transition-[background,box-shadow] duration-300"
          style={{ background: bg, boxShadow: shadow }}
        />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function ServiceRow({
  Icon,
  label,
  url,
  port,
  role,
  healthUrl,
  status,
  idx,
}: ServiceItem & { status: StatusMap; idx: number }) {
  const toast = useAppToast();
  const isHttp = url.startsWith("http");

  const copyText = (t: string) => {
    navigator.clipboard.writeText(t).then(
      () => toast.success("Copied", t),
      () => toast.error("Copy failed"),
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: Math.min(idx, 12) * 0.015 }}
    >
      <div className="flex items-center gap-3 rounded-[10px] px-3 py-[10px] transition-[background] duration-150 hover:bg-[rgba(31,63,254,0.04)]">
        {/* Status dot */}
        <StatusDot healthUrl={healthUrl} status={status} />

        {/* Icon */}
        <div className="flex size-[32px] shrink-0 items-center justify-center rounded-[9px] border border-border-brand bg-[var(--glow)] text-brand">
          <Icon size={15} strokeWidth={2} />
        </div>

        {/* Label + role */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-ink">{label}</p>
            <Badge className="h-auto rounded-[6px] border border-border-subtle bg-chip px-2 py-[2px] text-[9px] font-medium text-ink-muted tabular-nums">
              :{port}
            </Badge>
          </div>
          <p className="mt-[2px] text-[11px] text-ink-muted">{role}</p>
        </div>

        {/* URL + actions */}
        <div className="flex items-center gap-2">
          <p className="line-clamp-1 max-w-[240px] font-mono text-[10px] text-ink-faint" title={url}>
            {url}
          </p>
          <button
            type="button"
            aria-label={`Copy ${url}`}
            onClick={() => copyText(url)}
            className="flex size-[28px] items-center justify-center rounded-md border border-border-subtle text-ink-muted transition-all duration-150 hover:border-border-brand hover:bg-[var(--glow)] hover:text-brand"
          >
            <Copy size={12} strokeWidth={2} />
          </button>
          {isHttp && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${url}`}
              className="flex size-[28px] items-center justify-center rounded-md border border-border-subtle text-ink-muted transition-all duration-150 hover:border-border-brand hover:bg-[var(--glow)] hover:text-brand"
            >
              <ExternalLink size={12} strokeWidth={2} />
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function SummaryBar({
  status,
  poll,
  lastChecked,
  loading,
}: {
  status: StatusMap;
  poll: () => void;
  lastChecked: Date | null;
  loading: boolean;
}) {
  const total = HEALTH_URLS.length;
  const up = HEALTH_URLS.filter((u) => status[u] === "up").length;
  const down = HEALTH_URLS.filter((u) => status[u] === "down").length;
  const pending = total - up - down;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-[6px]">
        <div
          className="size-[8px] rounded-full"
          style={{ background: "#10b981", boxShadow: "0 0 5px rgba(16,185,129,0.5)" }}
        />
        <p className="text-[12px] text-ink-muted">{up} up</p>
      </div>
      {down > 0 && (
        <div className="flex items-center gap-[6px]">
          <div
            className="size-[8px] rounded-full"
            style={{ background: "#ef4444", boxShadow: "0 0 5px rgba(239,68,68,0.5)" }}
          />
          <p className="text-[12px] text-[#ef4444]">{down} down</p>
        </div>
      )}
      {pending > 0 && (
        <div className="flex items-center gap-[6px]">
          <div className="size-[8px] rounded-full bg-[rgba(255,255,255,0.2)]" />
          <p className="text-[12px] text-ink-faint">{pending} checking</p>
        </div>
      )}
      {lastChecked && (
        <p className="text-[10px] text-ink-faint">checked {lastChecked.toLocaleTimeString()}</p>
      )}
      <button
        type="button"
        onClick={poll}
        aria-label="Refresh status"
        className="flex items-center gap-[5px] rounded-[7px] border border-border-subtle px-2 py-[3px] text-[11px] text-ink-muted transition-all duration-150 hover:border-border-brand hover:bg-[var(--glow)] hover:text-brand"
      >
        {loading ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <RefreshCw size={11} strokeWidth={2} />
        )}
        Refresh
      </button>
    </div>
  );
}

// NOTE: the legacy file defined a `ModelsCard` (per-role map from GET
// /api/v1/health) plus a `useModelInfo` hook, but `SystemPage` never rendered
// them — they are dead code in the original. Under the new app's strict
// `noUnusedLocals`/`noUnusedParameters` they would fail the build, and since
// they produce no observable behavior, the behavior-equivalent port omits them.
// (Live model-roster management is handled by <ModelConfigPanel /> below.)

export default function SystemPage() {
  const { status, poll, lastChecked } = useLiveStatus();
  const loading = Object.values(status).some((s) => s === "pending");

  return (
    <TooltipProvider>
      <PageShell>
        <PageHeader
          title="System"
          icon={<PageHeaderIcon icon={<Server size={20} strokeWidth={1.85} />} />}
          subtitle="Every running service, port, and endpoint — live status, one click to open or copy"
          actions={
            <SummaryBar status={status} poll={poll} lastChecked={lastChecked} loading={loading} />
          }
        />

        <ModelConfigPanel />

        {SERVICES.map((group) => (
          <div key={group.group} className="mb-5">
            <Eyebrow className="mb-2">{group.group}</Eyebrow>
            <GlassCard className="p-2">
              {group.items.map((s, i) => (
                <ServiceRow key={s.label} idx={i} {...s} status={status} />
              ))}
            </GlassCard>
          </div>
        ))}

        <GlassCard className="p-4">
          <Eyebrow className="mb-2">Tip</Eyebrow>
          <p className="text-sm text-ink-muted">
            MySQL / Postgres / Redis rows are connection strings — use Copy and paste into your DB
            client. Status dots poll every 30 s automatically; hit <strong>Refresh</strong> for an
            instant check. Obs stack ports are remapped: Grafana → 3030, Prometheus → 9292,
            Alertmanager → 9394 (9090/9093/3000 ghost-held by Docker Desktop on this machine).
          </p>
        </GlassCard>
      </PageShell>
    </TooltipProvider>
  );
}
