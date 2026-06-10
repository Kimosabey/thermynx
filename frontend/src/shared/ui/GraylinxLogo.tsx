/**
 * GraylinxLogo — animated lockup around the real Graylinx PNG.
 *
 * Uses the actual brand PNG (@/assets/logo.png) — fully on-prem, no remote
 * assets. Framer Motion adds a hover spring + gradient sheen across the
 * wordmark so the logo reads as "live", without altering the brand artwork
 * itself.
 *
 *   <GraylinxLogo />                  → full lockup (default)
 *   <GraylinxLogo variant="mark" />   → mark only (sidebar collapsed)
 *   <GraylinxLogo variant="wordmark"> → wordmark text (fallback / mobile)
 */

import { type ReactNode, type CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";

import logoUrl from "@/assets/logo.png";

const BRAND_300 = "#6671FF";

interface AnimatedFrameProps {
  children?: ReactNode;
  rounded?: number;
  animated?: boolean;
}

function AnimatedFrame({ children, rounded = 12, animated = true }: AnimatedFrameProps) {
  const reduced = useReducedMotion();
  const animate = animated && !reduced;
  return (
    <motion.div
      className="relative inline-flex items-center justify-center"
      style={{ borderRadius: `${rounded}px` }}
      whileHover={animate ? { scale: 1.04 } : undefined}
      transition={{ type: "spring", stiffness: 280, damping: 18 }}
    >
      <div className="relative">{children}</div>
    </motion.div>
  );
}

interface LogoWordmarkProps {
  color?: string;
  muted?: string;
  tagline?: ReactNode;
}

function LogoWordmark({
  color = "white",
  muted = "rgba(255,255,255,0.35)",
  tagline = "HVAC intelligence",
}: LogoWordmarkProps) {
  const reduced = useReducedMotion();

  const sheenStyle: CSSProperties = reduced
    ? { color }
    : {
        backgroundImage: `linear-gradient(90deg, ${color} 0%, ${BRAND_300} 45%, ${color} 100%)`,
        backgroundSize: "200% 100%",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        WebkitTextFillColor: "transparent",
        animation: "glxSheen 5.5s linear infinite",
      };

  return (
    <div>
      {!reduced && (
        <style>{`@keyframes glxSheen{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      )}
      <motion.span
        className="inline-block font-heading text-[15px] leading-[1.1] font-extrabold tracking-[-0.02em]"
        style={sheenStyle}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        Graylinx
      </motion.span>
      {tagline && (
        <p className="mt-px text-[9px] uppercase tracking-[0.14em]" style={{ color: muted }}>
          {tagline}
        </p>
      )}
    </div>
  );
}

export interface GraylinxLogoProps {
  variant?: "full" | "mark" | "wordmark";
  height?: number;
  animated?: boolean;
  color?: string;
  muted?: string;
  tagline?: ReactNode;
}

export function GraylinxLogo({
  variant = "full",
  height = 28,
  animated = true,
  color = "white",
  muted = "rgba(255,255,255,0.35)",
  tagline = "HVAC intelligence",
}: GraylinxLogoProps) {
  if (variant === "wordmark") {
    return <LogoWordmark color={color} muted={muted} tagline={tagline} />;
  }

  // Square framed mark (sidebar collapsed / chips). Show the PNG centred.
  if (variant === "mark") {
    return (
      <AnimatedFrame rounded={10} animated={animated}>
        <img
          src={logoUrl}
          alt="Graylinx"
          className="object-contain"
          style={{ height: `${height}px`, width: `${height}px` }}
        />
      </AnimatedFrame>
    );
  }

  // Full lockup — the real brand PNG with hover spring.
  return (
    <div className="flex items-center gap-3">
      <AnimatedFrame rounded={12} animated={animated}>
        <img
          src={logoUrl}
          alt="Graylinx"
          draggable={false}
          className="w-auto object-contain"
          style={{ height: `${height}px` }}
        />
      </AnimatedFrame>
      {tagline && (
        <p className="text-[9px] uppercase tracking-[0.14em]" style={{ color: muted }}>
          {tagline}
        </p>
      )}
    </div>
  );
}

export default GraylinxLogo;
