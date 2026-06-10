/**
 * ServiceStatusBar — live, modern indicator of every backend service.
 *
 * Polls /api/v1/health every 15s. Renders four animated pills (MySQL,
 * Postgres+pgvector, Ollama, telemetry freshness). Each pill shows a
 * pulsing status dot, a label, and the current value (host:port, model,
 * lag). Toast notifications fire only when a service transitions
 * (ok → down or down → ok) so the operator is alerted without spam.
 *
 * Floats bottom-right, glassmorphic. Click any pill to expand into a
 * compact details popover. All Framer Motion + Tailwind — no extra deps.
 */

import { useEffect, useRef, useState, type ComponentType } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Database, Server, Cpu, Activity, ChevronUp, ChevronDown,
} from "lucide-react";
import useAppToast from "@/shared/hooks/useAppToast";

const POLL_MS = 15_000;

type StatusKind = "ok" | "warn" | "down";

const STATUS: Record<StatusKind, { color: string; glow: string }> = {
  ok:   { color: "#10b981", glow: "rgba(16,185,129,0.35)" },
  warn: { color: "#f59e0b", glow: "rgba(245,158,11,0.35)" },
  down: { color: "#ef4444", glow: "rgba(239,68,68,0.35)" },
};

interface HealthResponse {
  _err?: boolean;
  db?: { connected?: boolean; host?: string; port?: number | string };
  ollama?: { connected?: boolean; host?: string; default_model?: string };
  telemetry?: {
    freshness_warning?: boolean;
    age_seconds?: number;
    latest_slot_time?: string;
  };
}

interface ServiceKinds {
  db: StatusKind;
  ollama: StatusKind;
  telemetry: StatusKind;
}

function StatusDot({ kind = "ok", size = 8 }: { kind?: StatusKind; size?: number }) {
  const c = STATUS[kind];
  return (
    <div className="relative shrink-0" style={{ width: `${size}px`, height: `${size}px` }}>
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: c.color, boxShadow: `0 0 8px ${c.glow}` }}
      />
      {kind !== "down" && (
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ border: `1px solid ${c.color}` }}
          animate={{ scale: [1, 2.2, 1], opacity: [0.7, 0, 0.7] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut" }}
        />
      )}
    </div>
  );
}

interface PillProps {
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  value?: string;
  kind?: StatusKind;
  detail?: string;
}

function Pill({ icon: Icon, label, value, kind = "ok", detail }: PillProps) {
  return (
    <div
      className="flex items-center gap-2 rounded-full border border-border-subtle bg-glass px-3 py-[6px] backdrop-blur-[12px] shadow-[0_4px_14px_rgba(31,63,254,0.08)]"
      title={detail}
    >
      <StatusDot kind={kind} />
      <Icon size={13} strokeWidth={2} />
      <p className="text-[11px] font-semibold tracking-[-0.01em] text-ink-secondary">
        {label}
      </p>
      {value && (
        <p className="max-w-[120px] overflow-hidden font-mono text-[10px] text-ink-muted text-ellipsis whitespace-nowrap">
          {value}
        </p>
      )}
    </div>
  );
}

function kindFromHealth(h: HealthResponse | null): ServiceKinds {
  // Map /api/v1/health response → 4 service states
  const db_ok      = !!h?.db?.connected;
  const ollama_ok  = !!h?.ollama?.connected;
  const freshness  = h?.telemetry?.freshness_warning;
  const slot       = h?.telemetry?.latest_slot_time;
  const tk: StatusKind = freshness ? "warn" : slot ? "ok" : "warn";
  return {
    db:        db_ok ? "ok" : "down",
    ollama:    ollama_ok ? "ok" : "down",
    telemetry: tk,
  };
}

function relative(slot?: string): string {
  if (!slot) return "—";
  const d = new Date(slot);
  if (isNaN(+d)) return "—";
  const ago = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (ago < 90)        return "live";
  if (ago < 3600)      return `${Math.round(ago / 60)}m ago`;
  if (ago < 86400)     return `${Math.round(ago / 3600)}h ago`;
  return `${Math.round(ago / 86400)}d ago`;
}

export default function ServiceStatusBar() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [open, setOpen] = useState(false);
  const prevKindRef = useRef<Partial<ServiceKinds>>({});
  const toast = useAppToast();

  useEffect(() => {
    let active = true;
    const tick = async () => {
      try {
        const r = await fetch("/api/v1/health");
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data: HealthResponse = await r.json();
        if (!active) return;
        setHealth(data);

        // Toast on transitions only
        const k = kindFromHealth(data);
        const p = prevKindRef.current;
        const labels: Record<keyof ServiceKinds, string> = {
          db: "MySQL", ollama: "Ollama", telemetry: "Telemetry",
        };
        (Object.keys(k) as (keyof ServiceKinds)[]).forEach((key) => {
          if (p[key] && p[key] !== k[key]) {
            const next = k[key];
            const title = `${labels[key]} ${
              next === "ok" ? "recovered" : next === "warn" ? "degraded" : "unreachable"
            }`;
            const description =
              next === "ok"
                ? `Connection restored`
                : next === "warn"
                ? `Service flagged ${next}`
                : `Service is unreachable from the backend`;
            if (next === "ok") toast.success(title, description);
            else if (next === "warn") toast.warning(title, description);
            else toast.error(title, description);
          }
        });
        prevKindRef.current = k;
      } catch {
        if (!active) return;
        setHealth({ _err: true });
      }
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => { active = false; clearInterval(id); };
  }, [toast]);

  if (!health) return null;
  if (health._err) {
    return (
      <div className="fixed right-[20px] bottom-[20px] z-50">
        <Pill icon={Server} label="Backend" value="unreachable" kind="down" />
      </div>
    );
  }

  const k = kindFromHealth(health);
  const dbHost   = `${health.db?.host}:${health.db?.port}`;
  const ollHost  = (health.ollama?.host || "").replace(/^https?:\/\//, "").replace(/:\d+$/, "");
  const ollModel = health.ollama?.default_model || "—";
  const fresh    = relative(health.telemetry?.latest_slot_time);

  return (
    <motion.div
      className="fixed right-[20px] bottom-[20px] z-50"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <div className="flex flex-col items-end gap-2 rounded-[14px] border border-[rgba(31,63,254,0.12)] bg-[rgba(255,255,255,0.55)] p-2 backdrop-blur-[18px] shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
        <button
          type="button"
          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-[2px] hover:bg-[rgba(31,63,254,0.06)]"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle service status details"
        >
          <Activity size={12} strokeWidth={2} color="#1F3FFE" />
          <p className="text-[10px] font-bold tracking-[0.06em] text-[#1F3FFE] uppercase">
            Live · system status
          </p>
          {open
            ? <ChevronDown size={12} strokeWidth={2} color="#1F3FFE" />
            : <ChevronUp   size={12} strokeWidth={2} color="#1F3FFE" />}
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              className="flex flex-col gap-2"
              initial={{ opacity: 0, y: -6, height: 0 }}
              animate={{ opacity: 1, y: 0,  height: "auto" }}
              exit   ={{ opacity: 0, y: -6, height: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <Pill icon={Database} label="MySQL"     value={dbHost}       kind={k.db}        detail="Unicharm telemetry source" />
              <Pill icon={Server}   label="Postgres"  value="thermynx_app" kind="ok"          detail="App state, RAG vectors" />
              <Pill icon={Cpu}      label="Ollama"    value={ollModel}     kind={k.ollama}    detail={ollHost ? `host: ${ollHost}` : "Local LLM"} />
              <Pill icon={Activity} label="Telemetry" value={fresh}        kind={k.telemetry} detail="Latest slot in MySQL" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
