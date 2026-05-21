/**
 * MovingBorder — button with a rotating gradient border (Aceternity pattern).
 *
 * A pill button whose border traces a continuous gradient orbit around
 * it. Implemented with a single rotating conic-gradient `<Box>` clipped
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

import { Box } from "@chakra-ui/react";
import { motion, useReducedMotion } from "framer-motion";

const MotionBox = motion.create(Box);

const TONES = {
  primary: { a: "#1F3FFE", b: "#6671FF", c: "#000F64" },
  cyan:    { a: "#0EA5E9", b: "#6671FF", c: "#075985" },
  amber:   { a: "#F59E0B", b: "#FBBF24", c: "#B45309" },
};

export default function MovingBorder({
  children,
  icon: Icon,
  tone = "primary",
  size = "md",       // sm | md | lg
  duration = 4,
  onClick,
  isDisabled = false,
  ...rest
}) {
  const reduced = useReducedMotion();
  const t = TONES[tone] || TONES.primary;

  const pad = size === "sm" ? "10px 14px" : size === "lg" ? "16px 28px" : "12px 20px";
  const fontSize = size === "sm" ? "12px" : size === "lg" ? "15px" : "13px";

  return (
    <Box
      as="button"
      onClick={isDisabled ? undefined : onClick}
      position="relative"
      borderRadius="999px"
      p="2px"
      cursor={isDisabled ? "not-allowed" : "pointer"}
      opacity={isDisabled ? 0.55 : 1}
      overflow="hidden"
      _hover={isDisabled ? undefined : { transform: "translateY(-1px)" }}
      transition="transform 0.18s ease-out"
      sx={{
        // Force a stacking context for the rotating layer
        isolation: "isolate",
      }}
      {...rest}
    >
      {/* Rotating conic gradient acts as the orbiting border */}
      <MotionBox
        position="absolute"
        inset="-60%"
        bg={`conic-gradient(from 0deg, ${t.a}, ${t.b} 25%, transparent 50%, ${t.c} 75%, ${t.a})`}
        animate={reduced ? undefined : { rotate: 360 }}
        transition={{ duration, repeat: Infinity, ease: "linear" }}
        style={{ borderRadius: "999px" }}
        pointerEvents="none"
      />

      {/* Inner pill — sits above the rotating gradient, leaving a 2px ring visible */}
      <Box
        position="relative"
        zIndex={1}
        px={0} py={0}
        borderRadius="999px"
        bg="rgba(15,17,40,0.96)"
        display="inline-flex"
        alignItems="center"
        gap={2}
        sx={{ padding: pad }}
        boxShadow="inset 0 0 0 1px rgba(255,255,255,0.06), 0 8px 20px rgba(31,63,254,0.25)"
      >
        {Icon && <Icon size={size === "lg" ? 16 : 14} strokeWidth={2.2} color="#fff" />}
        <Box
          as="span"
          color="white"
          fontWeight={700}
          fontSize={fontSize}
          letterSpacing="-0.01em"
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}
