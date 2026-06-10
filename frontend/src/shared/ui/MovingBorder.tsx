import { type ReactNode, type CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * MovingBorder — button with a rotating gradient border (Aceternity pattern).
 *
 * A pill button whose border traces a continuous gradient orbit around
 * it. Implemented with a single rotating conic-gradient layer clipped
 * by an inner mask — pure CSS + Framer Motion (rotation transform).
 *
 *   <MovingBorder onClick={...} icon={Play}>Run agent</MovingBorder>
 *
 * Variants:
 *   `tone="primary"` (default) — brand blue gradient
 *   `tone="cyan"`              — cyan-accent gradient
 *   `tone="amber"`             — warning/amber gradient
 *
 * Respects prefers-reduced-motion (rotation paused; static gradient shown).
 */

type Tone = "primary" | "cyan" | "amber";
type Size = "sm" | "md" | "lg";

const TONES: Record<Tone, { a: string; b: string; c: string }> = {
  primary: { a: "#1F3FFE", b: "#6671FF", c: "#000F64" },
  cyan: { a: "#0EA5E9", b: "#6671FF", c: "#075985" },
  amber: { a: "#F59E0B", b: "#FBBF24", c: "#B45309" },
};

export interface MovingBorderProps {
  children?: ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  size?: Size;
  duration?: number;
  onClick?: () => void;
  isDisabled?: boolean;
  className?: string;
}

export default function MovingBorder({
  children,
  icon: Icon,
  tone = "primary",
  size = "md",
  duration = 4,
  onClick,
  isDisabled = false,
  className,
}: MovingBorderProps) {
  const reduced = useReducedMotion();
  const t = TONES[tone] || TONES.primary;

  const pad = size === "sm" ? "10px 14px" : size === "lg" ? "16px 28px" : "12px 20px";
  const fontSize = size === "sm" ? "12px" : size === "lg" ? "15px" : "13px";

  return (
    <button
      type="button"
      onClick={isDisabled ? undefined : onClick}
      className={cn(
        "relative isolate overflow-hidden rounded-full p-[2px] transition-transform duration-[0.18s] ease-out",
        isDisabled ? "cursor-not-allowed opacity-55" : "cursor-pointer hover:-translate-y-px",
        className,
      )}
    >
      {/* Rotating conic gradient acts as the orbiting border */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-[-60%]"
        style={{
          borderRadius: "999px",
          background: `conic-gradient(from 0deg, ${t.a}, ${t.b} 25%, transparent 50%, ${t.c} 75%, ${t.a})`,
        }}
        animate={reduced ? undefined : { rotate: 360 }}
        transition={{ duration, repeat: Infinity, ease: "linear" }}
      />

      {/* Inner pill — sits above the rotating gradient, leaving a 2px ring visible */}
      <div
        className="relative z-[1] inline-flex items-center gap-2 rounded-full"
        style={{
          padding: pad,
          background: "rgba(15,17,40,0.96)",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06), 0 8px 20px rgba(31,63,254,0.25)",
        }}
      >
        {Icon && <Icon size={size === "lg" ? 16 : 14} strokeWidth={2.2} color="#fff" />}
        <span
          className="font-bold text-white tracking-[-0.01em]"
          style={{ fontSize } as CSSProperties}
        >
          {children}
        </span>
      </div>
    </button>
  );
}
