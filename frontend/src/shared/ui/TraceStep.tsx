import { useState, memo, type CSSProperties } from "react";
import {
  Check,
  Wrench,
  List,
  Zap,
  ScanSearch,
  BarChart2,
  Columns2,
  History,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/** SSE frame emitted by the agent stream. */
export interface TraceFrame {
  type?: string;
  tool?: string;
  step?: number | null;
  runningLabel?: string;
  args?: Record<string, unknown> | null;
  result?: unknown;
}

export type TraceStatus = "done" | "running" | "pending";

interface ToolMeta {
  label: string;
  Icon: LucideIcon;
}

const TOOL_META: Record<string, ToolMeta> = {
  get_equipment_list: { label: "Equipment List", Icon: List },
  compute_efficiency: { label: "Efficiency Calc", Icon: Zap },
  detect_anomalies: { label: "Anomaly Scan", Icon: ScanSearch },
  get_timeseries_summary: { label: "Timeseries Stats", Icon: BarChart2 },
  compare_equipment: { label: "Compare", Icon: Columns2 },
  get_anomaly_history: { label: "History", Icon: History },
  retrieve_manual: { label: "Manual Lookup", Icon: List },
  search_knowledge_base: { label: "Knowledge Search", Icon: ScanSearch },
  propose_work_order: { label: "Work Order Draft", Icon: ClipboardList },
};

// Shimmer gradient applied to the running label. Kept as a style object so the
// label is ALWAYS a <p> (same box model in every state) — switching between an
// inline <span> and a block element on the running→done flip caused a reflow
// jump. Only the paint changes now, never the layout. Uses the `shimmer-text`
// keyframe defined in index.css (kept at the legacy 2.1s linear timing).
const SHIMMER_STYLE: CSSProperties = {
  backgroundImage:
    "linear-gradient(90deg, var(--ink) 0%, var(--ink) 35%, #6671FF 45%, #1F3FFE 50%, #6671FF 55%, var(--ink) 65%, var(--ink) 100%)",
  backgroundSize: "200% 100%",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  WebkitTextFillColor: "transparent",
  color: "transparent",
  animation: "shimmer-text 2.1s linear infinite",
};

interface DotStyle {
  bg: string;
  border: string;
}

interface RowStyle {
  bg: string;
  border: string;
  shadow: string;
}

export interface TraceStepProps {
  frame: TraceFrame;
  status?: TraceStatus;
  /** "primary" = brand blue (agent surface), "cyan" = THERMYNX signature (Nyx assistant). */
  accent?: "primary" | "cyan";
}

interface AccentScheme {
  token: string;
  rgb: string;
  mid: string;
  hi: string;
}

/**
 * Reasoning trace step — design system spec.
 *
 * status: "done" | "running" | "pending"
 * frame: SSE frame from agent (type: tool_call | tool_result)
 *
 * Memoized (see export) so the streaming turn re-rendering ~25×/sec doesn't
 * re-render every settled step — only a step whose frame ref or status changed.
 */
function TraceStep({ frame, status = "done", accent = "primary" }: TraceStepProps) {
  const [expanded, setExpanded] = useState(false);
  const reduceMotion = useReducedMotion();

  const A: AccentScheme =
    accent === "cyan"
      ? { token: "var(--cyan)", rgb: "6,182,212", mid: "#06B6D4", hi: "#22D3EE" }
      : { token: "var(--brand)", rgb: "31,63,254", mid: "#6671FF", hi: "#1F3FFE" };

  // Accent-aware shimmer (cyan for Nyx, blue for the agent surface).
  const shimmerStyle: CSSProperties = {
    ...SHIMMER_STYLE,
    backgroundImage: `linear-gradient(90deg, var(--ink) 0%, var(--ink) 35%, ${A.mid} 45%, ${A.hi} 50%, ${A.mid} 55%, var(--ink) 65%, var(--ink) 100%)`,
  };

  const meta: ToolMeta =
    (frame.tool != null ? TOOL_META[frame.tool] : undefined) ?? {
      label: frame.tool ?? "Unknown",
      Icon: Wrench,
    };
  const MetaIcon = meta.Icon;

  // Dot styles (CSS custom-prop colors / literal rgba kept verbatim)
  const dot: DotStyle =
    {
      done: { bg: A.token, border: A.token },
      running: { bg: "var(--surface)", border: A.token },
      pending: { bg: "var(--surface)", border: "var(--border-subtle)" },
    }[status] ?? { bg: A.token, border: A.token };

  // Row styles
  const row: RowStyle =
    {
      done: { bg: `rgba(${A.rgb},0.04)`, border: `rgba(${A.rgb},0.18)`, shadow: "none" },
      running: {
        bg: "var(--surface)",
        border: `rgba(${A.rgb},0.30)`,
        shadow: `0 4px 14px rgba(${A.rgb},0.08)`,
      },
      pending: { bg: "var(--elevated)", border: "var(--border-subtle)", shadow: "none" },
    }[status] ?? {
      bg: `rgba(${A.rgb},0.04)`,
      border: `rgba(${A.rgb},0.18)`,
      shadow: "none",
    };

  const isPending = status === "pending";
  const toolIconBg = isPending ? "var(--elevated)" : `rgba(${A.rgb},0.10)`;
  const toolIconColor = isPending ? "var(--ink-faint)" : A.token;

  const hasExpandable =
    (!!frame.args && Object.keys(frame.args).length > 0) ||
    (!!frame.result && typeof frame.result === "object");
  const expandData = frame.type === "tool_call" ? frame.args : frame.result;

  const RowTag = (hasExpandable ? "button" : "div") as "button" | "div";

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="relative py-1"
    >
      {/* Step dot — the running state gets the pulse-halo keyframe (index.css). */}
      <div
        className={cn(
          "absolute top-[14px] left-[-22px] z-[2] flex h-[18px] w-[18px] items-center justify-center rounded-full border-[1.5px] border-solid",
          "transition-[background-color,border-color] duration-200 ease-[ease]",
          status === "running" && "animate-pulse-halo",
        )}
        style={{ backgroundColor: dot.bg, borderColor: dot.border }}
      >
        {status === "done" && <Check size={10} strokeWidth={3} color="white" />}
        {status === "running" && (
          <div className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: A.token }} />
        )}
      </div>

      {/* Row */}
      <RowTag
        type={RowTag === "button" ? "button" : undefined}
        onClick={hasExpandable ? () => setExpanded(!expanded) : undefined}
        className={cn(
          "mb-2 w-full rounded-lg border px-3 py-[9px] text-left transition-all duration-[180ms] ease-[ease]",
          hasExpandable ? "cursor-pointer hover:opacity-90" : "cursor-default",
        )}
        style={{
          backgroundColor: row.bg,
          borderColor: row.border,
          boxShadow: row.shadow,
        }}
      >
        <div className="flex flex-wrap items-start gap-[10px]">
          {/* Tool icon */}
          <div
            className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px]"
            style={{ backgroundColor: toolIconBg, color: toolIconColor }}
          >
            <MetaIcon size={13} strokeWidth={2} />
          </div>

          {/* Label — always a <p> (identical box in every state, so the
              running→done flip repaints without reflowing). */}
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "text-[12px] leading-[1.35]",
                isPending ? "font-medium text-ink-faint" : "font-semibold text-ink",
              )}
              style={status === "running" ? shimmerStyle : undefined}
            >
              {status === "running"
                ? frame.runningLabel ?? `${meta.label}…`
                : frame.type === "tool_result"
                  ? `${meta.label} result`
                  : meta.label}
            </p>
          </div>

          {/* Right meta */}
          <div className="flex w-full shrink-0 items-center justify-end gap-2 pl-[32px] sm:ml-auto sm:w-auto sm:pl-0">
            {frame.step != null && (
              <div
                className="rounded-[5px] px-[6px] py-[2px] font-sans text-[9px] font-bold tracking-[0.04em]"
                style={{
                  backgroundColor: isPending ? "var(--elevated)" : `rgba(${A.rgb},0.10)`,
                  color: isPending ? "var(--ink-faint)" : A.token,
                }}
              >
                step {frame.step}
              </div>
            )}
            {hasExpandable && (
              <span className="text-[10px] text-ink-muted">{expanded ? "▲" : "▼"}</span>
            )}
          </div>
        </div>

        {/* Expandable JSON */}
        <AnimatePresence>
          {expanded && expandData != null && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-2 max-h-[150px] overflow-x-auto overflow-y-auto rounded-md bg-elevated p-2 text-left font-mono text-[10px] whitespace-pre-wrap text-ink-muted">
                {JSON.stringify(expandData, null, 2)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </RowTag>
    </motion.div>
  );
}

// Shallow-compares props: a settled step (stable `frame` ref + unchanged
// `status`) is skipped while the streaming turn re-renders, so only the newly
// appended step and the one flipping running→done actually re-render.
export default memo(TraceStep);
