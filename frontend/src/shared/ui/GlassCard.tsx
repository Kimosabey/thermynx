import { useEffect, useState, type ReactNode } from "react";
import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Detects pointer:coarse / hover:none — i.e. touch-primary devices. Used to
 * disable hover lift so cards don't get stuck "elevated" on tap.
 */
function useIsTouchDevice() {
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(hover: none)");
    setIsTouch(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsTouch(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return isTouch;
}

export interface GlassCardProps extends HTMLMotionProps<"div"> {
  children?: ReactNode;
  hover?: boolean;
  accent?: boolean;
  glow?: boolean;
}

export default function GlassCard({
  children,
  hover = true,
  accent = false,
  glow = false,
  className,
  ...props
}: GlassCardProps) {
  const isTouch = useIsTouchDevice();
  const shouldReduceMotion = useReducedMotion();
  const enableHover = hover && !isTouch && !shouldReduceMotion;

  return (
    <motion.div
      className={cn(
        "relative max-w-full min-w-0 overflow-hidden rounded-xl border border-border-subtle bg-surface p-4 shadow-card md:p-5",
        className,
      )}
      whileHover={
        enableHover
          ? {
              y: -2,
              boxShadow: "0 8px 32px rgba(31,63,254,0.1)",
              borderColor: "rgba(31,63,254,0.28)",
            }
          : undefined
      }
      transition={{ duration: 0.18 }}
      {...props}
    >
      {/* Top glow bar */}
      {glow && (
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 z-[1] h-[2px] opacity-55"
          style={{ backgroundImage: "linear-gradient(to right, transparent, var(--brand), transparent)" }}
        />
      )}
      {/* Left accent bar */}
      {accent && (
        <div
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-[3px] bg-brand"
          style={{ borderRadius: "16px 0 0 16px" }}
        />
      )}
      {children}
    </motion.div>
  );
}
