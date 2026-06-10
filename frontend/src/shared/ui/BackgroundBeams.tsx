import { useMemo, type CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * BackgroundBeams — animated diagonal light beams in SVG.
 *
 * Aceternity-style ambient beams that travel along curved paths.
 * Pure SVG + Framer Motion. Stagger of beam launches creates an
 * organic, never-quite-repeating motion. On-prem safe.
 *
 *   <BackgroundBeams beamCount={12} />
 *
 * Place inside a positioned container; the component fills `inset:0`.
 * Respects `prefers-reduced-motion` (no animation, static SVG).
 */

const BRAND_500 = "#1F3FFE";
const BRAND_300 = "#6671FF";
const BRAND_100 = "#C7C9FF";

// Curved path templates — each beam follows one of these arcs across the canvas.
const PATHS = [
  "M-380 -190 C-200 -100 200 30 600 240 C1000 460 1100 600 1400 760",
  "M-340 -120 C-150 -10 260 100 660 310 C1060 520 1120 660 1420 820",
  "M-300 -50  C-100 50  320 170 720 380 C1120 590 1140 720 1440 880",
  "M-260 30   C-50  120 380 240 780 450 C1180 660 1160 780 1460 940",
];

function pick(arr: string[], i: number): string {
  return arr[i % arr.length];
}

export interface BackgroundBeamsProps {
  beamCount?: number;
  opacity?: number;
  colorA?: string;
  colorB?: string;
  className?: string;
}

export default function BackgroundBeams({
  beamCount = 10,
  opacity = 0.55,
  colorA = BRAND_500,
  colorB = BRAND_300,
  className,
}: BackgroundBeamsProps) {
  const reduced = useReducedMotion();

  const beams = useMemo(
    () =>
      Array.from({ length: beamCount }).map((_, i) => ({
        id: i,
        d: pick(PATHS, i),
        delay: i * 0.45,
        duration: 6 + (i % 5) * 0.8,
        width: 1.2 + (i % 3) * 0.4,
        opacity: 0.4 + (i % 4) * 0.15,
        color: i % 2 === 0 ? colorA : colorB,
      })),
    [beamCount, colorA, colorB],
  );

  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      style={{ opacity } as CSSProperties}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1400 800"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          <linearGradient id="bgbeam-grad-a" x1="0" y1="0" x2="1400" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={colorA} stopOpacity="0" />
            <stop offset="50%" stopColor={colorA} stopOpacity="1" />
            <stop offset="100%" stopColor={colorB} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Static faint base lines for depth even with reduced motion */}
        {beams.map((b) => (
          <path
            key={`base-${b.id}`}
            d={b.d}
            stroke={BRAND_100}
            strokeWidth="0.6"
            strokeOpacity="0.22"
            fill="none"
          />
        ))}

        {/* Travelling beams */}
        {beams.map((b) => (
          <motion.path
            key={`beam-${b.id}`}
            d={b.d}
            stroke="url(#bgbeam-grad-a)"
            strokeWidth={b.width}
            strokeOpacity={b.opacity}
            fill="none"
            strokeLinecap="round"
            strokeDasharray="180 1200"
            initial={{ strokeDashoffset: 1400 }}
            animate={reduced ? { strokeDashoffset: 0 } : { strokeDashoffset: [1400, -200] }}
            transition={{
              duration: b.duration,
              repeat: Infinity,
              ease: "easeInOut",
              delay: b.delay,
            }}
          />
        ))}
      </svg>
    </div>
  );
}
