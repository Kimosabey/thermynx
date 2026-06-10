import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, animate, useReducedMotion } from "framer-motion";
import GlassCard from "@/shared/ui/GlassCard";

/**
 * Resolves a legacy Chakra semantic token (e.g. "accent.primary", "status.good",
 * "text.muted") to the matching THERMYNX CSS variable defined in index.css.
 * Unknown values pass through verbatim (so a raw color string still works).
 */
const TOKEN_TO_VAR: Record<string, string> = {
  "accent.primary": "var(--brand)",
  "accent.secondary": "var(--brand-2)",
  "accent.cyan": "var(--cyan)",
  "status.good": "var(--good)",
  "status.warn": "var(--warn)",
  "status.bad": "var(--bad)",
  "status.info": "var(--info)",
  "text.primary": "var(--ink)",
  "text.secondary": "var(--ink-secondary)",
  "text.muted": "var(--ink-muted)",
  "text.faint": "var(--ink-faint)",
  "text.inverse": "var(--ink-inverse)",
  "text.brand": "var(--ink-brand)",
};

function resolveColor(token: string): string {
  return TOKEN_TO_VAR[token] ?? token;
}

/**
 * Animated number that counts from the previous value to the new value.
 * On first mount, animates from 0. On subsequent updates, animates from the
 * prior displayed value — so a refresh of 87 → 88 does NOT reset to 0.
 *
 * Respects `prefers-reduced-motion` — sets value instantly.
 */
function AnimatedNumber({ value, decimals = 0 }: { value?: number | string | null; decimals?: number }) {
  const [display, setDisplay] = useState("—");
  const prevRef = useRef<number | null>(null);
  const isMount = useRef(true);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (value == null) { setDisplay("—"); prevRef.current = null; return; }
    const target = parseFloat(String(value));
    if (isNaN(target)) { setDisplay(String(value)); return; }

    // Reduced motion or first mount with no previous value → snap
    if (shouldReduceMotion) {
      setDisplay(target.toFixed(decimals));
      prevRef.current = target;
      isMount.current = false;
      return;
    }

    const from = isMount.current ? 0 : (prevRef.current ?? 0);
    isMount.current = false;

    // Skip animation if change is < 1% of base (noise filter)
    const base = Math.abs(from) || Math.abs(target) || 1;
    if (Math.abs(target - from) / base < 0.01) {
      setDisplay(target.toFixed(decimals));
      prevRef.current = target;
      return;
    }

    const controls = animate(from, target, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(v.toFixed(decimals)),
      onComplete: () => { prevRef.current = target; },
    });
    return controls.stop;
  }, [value, decimals, shouldReduceMotion]);

  return <span>{display}</span>;
}

export interface KpiCardProps {
  label: ReactNode;
  value?: number | string | null;
  unit?: string;
  helpText?: ReactNode;
  decimals?: number;
  /** Legacy Chakra semantic token (e.g. "accent.primary", "status.good") or a raw color. */
  accent?: string;
  trend?: "up" | "down" | string;
  trendValue?: ReactNode;
  icon?: ReactNode;
}

export default function KpiCard({
  label,
  value,
  unit,
  helpText,
  decimals = 0,
  accent = "accent.primary",
  trend,
  trendValue,
  icon,
}: KpiCardProps) {
  const trendColor = trend === "up" ? "var(--good)" : trend === "down" ? "var(--bad)" : "var(--ink-muted)";
  const trendIcon  = trend === "up" ? "↑" : trend === "down" ? "↓" : "";
  const shouldReduceMotion = useReducedMotion();

  return (
    <GlassCard glow={false} hover>
      <div className="flex items-start justify-between">
        <p className="mb-3 line-clamp-2 text-[11px] leading-[1.25] font-bold tracking-[0.08em] break-words text-ink-muted uppercase">
          {label}
        </p>
        {icon && <div className="shrink-0 text-ink-muted opacity-45" aria-hidden="true">{icon}</div>}
      </div>

      <div className="flex items-baseline gap-1">
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="inline-block"
        >
          <p
            className="font-heading text-xl font-extrabold tracking-[-0.03em] tabular-nums sm:text-2xl"
            style={{ color: resolveColor(accent) }}
            aria-label={value != null ? `${label}: ${value}${unit ? " " + unit : ""}` : undefined}
          >
            <AnimatedNumber value={value} decimals={decimals} />
          </p>
        </motion.div>
        {unit && <p className="text-sm font-medium text-ink-muted" aria-hidden="true">{unit}</p>}
      </div>

      {(helpText || trendValue) && (
        <div className="mt-2 flex items-center gap-2">
          {trendValue && (
            <p className="text-xs font-semibold" style={{ color: trendColor }}>
              <span aria-hidden="true">{trendIcon}</span> {trendValue}
            </p>
          )}
          {helpText && <p className="text-xs text-ink-muted">{helpText}</p>}
        </div>
      )}
    </GlassCard>
  );
}
