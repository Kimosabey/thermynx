import { useRef, useState, type ReactNode } from "react";
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * HoverGradientCard — Aceternity-style card with cursor-following gradient.
 *
 * A card that reveals a soft radial gradient at the cursor position on
 * hover (the "spotlight" effect popularised by Linear / Vercel / Aceternity).
 * Pure Framer Motion, backdrop-blur surface.
 *
 *   <HoverGradientCard>
 *     <KpiCard ... />
 *   </HoverGradientCard>
 *
 * Props:
 *   `glow`     — main gradient colour (default brand blue)
 *   `radius`   — corner radius (default 16)
 *   `border`   — show animated 1px gradient border (default true)
 *   `padding`  — inner surface padding in Tailwind/Chakra units (default 5 = 20px)
 *   `bg`       — inner surface background (CSS color string, default translucent white)
 *
 * Note (Chakra→Tailwind): the legacy component spread arbitrary Chakra style
 * props onto the outer Box. This port spreads framer-motion div props and
 * merges `className` via `cn`; outer layout overrides should come through
 * `className`/standard DOM props rather than Chakra style-props.
 */

const BRAND_500 = "#1F3FFE";
const BRAND_300 = "#6671FF";

export interface HoverGradientCardProps extends HTMLMotionProps<"div"> {
  children?: ReactNode;
  glow?: string;
  radius?: number;
  border?: boolean;
  padding?: number;
  bg?: string;
}

export default function HoverGradientCard({
  children,
  glow = BRAND_500,
  radius = 16,
  border = true,
  padding = 5,
  bg = "rgba(255,255,255,0.85)",
  className,
  ...rest
}: HoverGradientCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const mx = useMotionValue(-200);
  const my = useMotionValue(-200);
  const [hovered, setHovered] = useState(false);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current || reduced) return;
    const r = ref.current.getBoundingClientRect();
    mx.set(e.clientX - r.left);
    my.set(e.clientY - r.top);
  };

  const spotlight = useMotionTemplate`radial-gradient(380px circle at ${mx}px ${my}px, ${glow}26, transparent 60%)`;
  const borderGlow = useMotionTemplate`radial-gradient(280px circle at ${mx}px ${my}px, ${glow}80, transparent 70%)`;

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn("relative", className)}
      style={{ borderRadius: `${radius}px` }}
      {...rest}
    >
      {/* Animated gradient border */}
      {border && (
        <motion.div
          className="pointer-events-none absolute -inset-px"
          style={{
            borderRadius: `${radius + 1}px`,
            background: hovered && !reduced ? borderGlow : `${BRAND_300}30`,
          }}
          transition={{ duration: 0.25 }}
        />
      )}

      {/* Inner surface */}
      <div
        className="relative overflow-hidden [backdrop-filter:blur(8px)]"
        style={{ borderRadius: `${radius}px`, background: bg, padding: `${padding * 4}px` }}
      >
        {/* Spotlight overlay */}
        {!reduced && (
          <motion.div
            className="pointer-events-none absolute inset-0"
            style={{ borderRadius: `${radius}px`, background: spotlight, opacity: hovered ? 1 : 0 }}
            transition={{ duration: 0.25 }}
          />
        )}
        <div className="relative">{children}</div>
      </div>
    </motion.div>
  );
}
