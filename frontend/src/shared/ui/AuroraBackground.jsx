/**
 * AuroraBackground — Aceternity-inspired layered ambient background.
 *
 * Pure Framer Motion + Chakra Box + CSS. No Tailwind, no canvas, no WebGL,
 * no remote assets. Fully on-prem compatible. Layers (bottom → top):
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

import { useCallback } from "react";
import { Box, useColorMode } from "@chakra-ui/react";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
} from "framer-motion";

const MotionBox = motion.create(Box);

const BRAND_500 = "#1F3FFE";
const BRAND_300 = "#6671FF";
const BRAND_100 = "#C7C9FF";

export default function AuroraBackground({ intensity = 0.6 }) {
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
    (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      mx.set(((e.clientX - r.left) / r.width) * 100);
      my.set(((e.clientY - r.top) / r.height) * 100);
    },
    [mx, my],
  );

  const spotlight = useMotionTemplate`radial-gradient(680px circle at ${mx}% ${my}%, ${BRAND_500}1f, transparent 55%)`;

  return (
    <Box
      aria-hidden="true"
      onMouseMove={onMove}
      position="absolute"
      inset={0}
      zIndex={0}
      overflow="hidden"
      pointerEvents="none"
      sx={{
        "@keyframes glxScan": {
          "0%":   { transform: "translateX(-30%)", opacity: 0 },
          "10%":  { opacity: 1 },
          "90%":  { opacity: 1 },
          "100%": { transform: "translateX(130%)", opacity: 0 },
        },
      }}
    >
      {/* Layer 1 — base wash (light/dark aware) */}
      <Box
        position="absolute"
        inset={0}
        bg={baseWash}
      />

      {/* Layer 2 — mesh-gradient blobs (Aceternity-style) */}
      <MotionBox
        position="absolute"
        left="-8rem"
        top="20%"
        w="40rem"
        h="40rem"
        borderRadius="50%"
        filter="blur(96px)"
        opacity={intensity * 0.5}
        bg={`radial-gradient(circle, ${BRAND_500}33, transparent 70%)`}
        animate={reduced ? undefined : { x: [0, 80, 0], y: [0, 40, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <MotionBox
        position="absolute"
        right="-6rem"
        top="30%"
        w="36rem"
        h="36rem"
        borderRadius="50%"
        filter="blur(96px)"
        opacity={intensity * 0.45}
        bg={`radial-gradient(circle, ${BRAND_300}30, transparent 70%)`}
        animate={reduced ? undefined : { x: [0, -70, 0], y: [0, -50, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <MotionBox
        position="absolute"
        left="33%"
        bottom="-6rem"
        w="32rem"
        h="32rem"
        borderRadius="50%"
        filter="blur(96px)"
        opacity={intensity * 0.5}
        bg={`radial-gradient(circle, ${BRAND_100}66, transparent 70%)`}
        animate={reduced ? undefined : { x: [0, 50, 0], y: [0, 30, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Layer 3 — dot grid with radial mask */}
      <Box
        position="absolute"
        inset={0}
        opacity={0.5}
        sx={{
          backgroundImage:
            `radial-gradient(circle at 1px 1px, ${dotColor} 1px, transparent 0)`,
          backgroundSize: "20px 20px",
          maskImage:
            "radial-gradient(ellipse 80% 60% at 50% 30%, black 30%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 60% at 50% 30%, black 30%, transparent 80%)",
        }}
      />

      {/* Layer 4 — mouse-following spotlight */}
      {!reduced && (
        <MotionBox
          position="absolute"
          inset={0}
          style={{ background: spotlight }}
        />
      )}

      {/* Layer 5 — scan-line beam sweeping across the top */}
      {!reduced && (
        <Box
          position="absolute"
          top={0}
          left={0}
          w="40%"
          h="2px"
          bg={`linear-gradient(90deg, transparent 0%, ${BRAND_500}aa 50%, transparent 100%)`}
          sx={{
            animation: "glxScan 9s ease-in-out infinite",
            filter: `drop-shadow(0 0 6px ${BRAND_500}aa)`,
          }}
        />
      )}
    </Box>
  );
}
