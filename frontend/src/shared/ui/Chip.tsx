import { type ReactNode, type CSSProperties } from "react";
import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Quick-prompt chip — pill-shaped button for preset questions. Accent color
 * animates on hover/active (driven by the --chip-accent CSS var).
 *
 * Usage:
 *   <Chip onClick={() => setGoal(text)}>{text}</Chip>
 *   <Chip accentColor="#10b981" active onClick={...}>...</Chip>
 */
export interface ChipProps extends Omit<HTMLMotionProps<"button">, "children"> {
  children?: ReactNode;
  active?: boolean;
  accentColor?: string;
}

export default function Chip({ children, onClick, active = false, accentColor, className, ...props }: ChipProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={shouldReduceMotion ? undefined : { y: -1 }}
      whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.15 }}
      aria-pressed={active}
      style={{ "--chip-accent": accentColor || "var(--brand)" } as CSSProperties}
      className={cn(
        "inline-flex min-h-[32px] cursor-pointer items-center rounded-full border px-[14px] py-[9px] text-left font-sans text-[11px] leading-[1.4] font-medium transition-all",
        active
          ? "border-brand bg-[var(--glow)] text-brand"
          : "border-border-subtle bg-surface text-ink-muted",
        "hover:border-[var(--chip-accent)] hover:bg-[color-mix(in_srgb,var(--chip-accent)_12%,transparent)] hover:text-[var(--chip-accent)]",
        className,
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
}
