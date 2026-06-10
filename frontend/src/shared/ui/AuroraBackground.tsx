import { useCallback, type CSSProperties, type MouseEvent } from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
} from "framer-motion";
import { useColorMode } from "@/app/theme/ColorModeProvider";

/**
 * AuroraBackground — Aceternity-inspired layered ambient background.
 *
 * Pure Framer Motion + CSS. No canvas, no WebGL, no remote assets. Fully
 * on-prem compatible. Layers (bottom -> top):
 *
 *   1. Base wash               — soft canvas tint
 *   2. Mesh-gradient blobs     — three slowly-drifting radial blurs
 *   3. Dot-grid                — operator-console texture w/ radial mask
 *   4. Mouse-following spotlight (Aceternity Spotlight pattern)
 *   5. Scan-line beam          — sweeping cyan line across the top
 *
 * Honours `prefers-reduced-motion`: drifting + scan line stop, static
 * layers remain.
 */

// Brand hex constants (kept literal — these layers can't read semantic tokens).
const BRAND_500 = "#1F3FFE";
const BRAND_300 = "#6671FF";
const THERMAL_CYAN = "#06B6D4";

export interface AuroraBackgroundProps {
  intensity?: number;
}

export default function AuroraBackground({ intensity = 0.6 }: AuroraBackgroundProps) {
  const reduced = useReducedMotion();
  const { colorMode } = useColorMode();
  const isDark = colorMode === "dark";
  const baseWash = isDark
    ? "linear-gradient(180deg, #0A0E1F 0%, #0E1330 100%)"
    : "linear-gradient(180deg, #F8FAFF 0%, #EEF1FB 100%)";
  const dotColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.08)";
  const mx = useMotionValue(50);
  const my = useMotionValue(15);

  const onMove = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      mx.set(((e.clientX - r.left) / r.width) * 100);
      my.set(((e.clientY - r.top) / r.height) * 100);
    },
    [mx, my],
  );

  const spotlight = useMotionTemplate`radial-gradient(680px circle at ${mx}% ${my}%, ${BRAND_500}1f, transparent 55%)`;

  return (
    <div
      aria-hidden="true"
      onMouseMove={onMove}
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      {/* Local keyframes for the scan-line beam (Chakra sx @keyframes equivalent) */}
      <style>{`
        @keyframes glxScan {
          0%   { transform: translateX(-30%); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateX(130%); opacity: 0; }
        }
      `}</style>

      {/* Layer 1 — base wash (light/dark aware) */}
      <div className="absolute inset-0" style={{ background: baseWash }} />

      {/* Layer 2 — mesh-gradient blobs (Aceternity-style) */}
      <motion.div
        className="absolute -left-32 top-[20%] h-[40rem] w-[40rem] rounded-full"
        style={{
          filter: "blur(96px)",
          opacity: intensity * 0.5,
          background: `radial-gradient(circle, ${BRAND_500}33, transparent 70%)`,
        }}
        animate={reduced ? undefined : { x: [0, 80, 0], y: [0, 40, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -right-24 top-[30%] h-[36rem] w-[36rem] rounded-full"
        style={{
          filter: "blur(96px)",
          opacity: intensity * 0.45,
          background: `radial-gradient(circle, ${BRAND_300}30, transparent 70%)`,
        }}
        animate={reduced ? undefined : { x: [0, -70, 0], y: [0, -50, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-24 left-1/3 h-[32rem] w-[32rem] rounded-full"
        style={{
          filter: "blur(96px)",
          opacity: intensity * 0.5,
          background: `radial-gradient(circle, ${THERMAL_CYAN}40, transparent 70%)`,
        }}
        animate={reduced ? undefined : { x: [0, 50, 0], y: [0, 30, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Layer 3 — dot grid with radial mask */}
      <div
        className="absolute inset-0 opacity-50"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, ${dotColor} 1px, transparent 0)`,
          backgroundSize: "20px 20px",
          maskImage:
            "radial-gradient(ellipse 80% 60% at 50% 30%, black 30%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 60% at 50% 30%, black 30%, transparent 80%)",
        }}
      />

      {/* Layer 4 — mouse-following spotlight */}
      {!reduced && (
        <motion.div className="absolute inset-0" style={{ background: spotlight }} />
      )}

      {/* Layer 5 — scan-line beam sweeping across the top */}
      {!reduced && (
        <div
          className="absolute left-0 top-0 h-[2px] w-2/5"
          style={
            {
              background: `linear-gradient(90deg, transparent 0%, ${THERMAL_CYAN}aa 50%, transparent 100%)`,
              animation: "glxScan 9s ease-in-out infinite",
              filter: `drop-shadow(0 0 6px ${THERMAL_CYAN}aa)`,
            } as CSSProperties
          }
        />
      )}
    </div>
  );
}
