import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Z-score pill for anomaly cards — full-round, color-coded by severity.
 * Severity colors are intentionally literal (not theme tokens).
 *
 * Usage: <ZScorePill value={3.8} />  →  "+3.8σ" in amber
 *        <ZScorePill value={-5.2} /> →  "-5.2σ" in red
 */
export default function ZScorePill({
  value,
  className,
  ...props
}: { value: number } & HTMLAttributes<HTMLSpanElement>) {
  const abs = Math.abs(value ?? 0);
  const sign = value >= 0 ? "+" : "";
  const label = `${sign}${Number(value).toFixed(1)}σ`;

  let color: string, bg: string, border: string;
  if (abs >= 4.5) {
    color = "#ef4444"; bg = "rgba(239,68,68,0.20)"; border = "rgba(239,68,68,0.60)";
  } else if (abs >= 3.5) {
    color = "#f97316"; bg = "rgba(249,115,22,0.20)"; border = "rgba(249,115,22,0.60)";
  } else {
    color = "#f59e0b"; bg = "rgba(245,158,11,0.20)"; border = "rgba(245,158,11,0.60)";
  }

  return (
    <span
      className={cn("inline-flex items-center rounded-full border px-2 py-[3px]", className)}
      style={{ background: bg, borderColor: border }}
      {...props}
    >
      <span className="text-[10px] font-bold tracking-[0.02em] tabular-nums" style={{ color }}>
        {label}
      </span>
    </span>
  );
}
