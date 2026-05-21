/**
 * HoverGradientCard — Aceternity-style card with cursor-following gradient.
 *
 * A card that reveals a soft radial gradient at the cursor position on
 * hover (the "spotlight" effect popularised by Linear / Vercel / Aceternity).
 * Pure Framer Motion + Chakra Box, no Tailwind, no extra deps.
 *
 *   <HoverGradientCard>
 *     <KpiCard ... />
 *   </HoverGradientCard>
 *
 * Props:
 *   `glow`     — main gradient colour (default brand blue)
 *   `radius`   — corner radius (default 16)
 *   `border`   — show animated 1px gradient border (default true)
 */

import { useRef, useState } from "react";
import { Box } from "@chakra-ui/react";
import { motion, useMotionTemplate, useMotionValue, useReducedMotion } from "framer-motion";

const MotionBox = motion(Box);

const BRAND_500 = "#1F3FFE";
const BRAND_300 = "#6671FF";

export default function HoverGradientCard({
  children,
  glow = BRAND_500,
  radius = 16,
  border = true,
  padding = 5,
  bg = "rgba(255,255,255,0.85)",
  ...rest
}) {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const mx = useMotionValue(-200);
  const my = useMotionValue(-200);
  const [hovered, setHovered] = useState(false);

  const onMove = (e) => {
    if (!ref.current || reduced) return;
    const r = ref.current.getBoundingClientRect();
    mx.set(e.clientX - r.left);
    my.set(e.clientY - r.top);
  };

  const spotlight = useMotionTemplate`radial-gradient(380px circle at ${mx}px ${my}px, ${glow}26, transparent 60%)`;
  const borderGlow = useMotionTemplate`radial-gradient(280px circle at ${mx}px ${my}px, ${glow}80, transparent 70%)`;

  return (
    <Box
      ref={ref}
      onMouseMove={onMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      position="relative"
      borderRadius={`${radius}px`}
      {...rest}
    >
      {/* Animated gradient border */}
      {border && (
        <MotionBox
          position="absolute"
          inset="-1px"
          borderRadius={`${radius + 1}px`}
          pointerEvents="none"
          style={{ background: hovered && !reduced ? borderGlow : `${BRAND_300}30` }}
          transition={{ duration: 0.25 }}
        />
      )}

      {/* Inner surface */}
      <Box
        position="relative"
        borderRadius={`${radius}px`}
        bg={bg}
        p={padding}
        backdropFilter="blur(8px)"
        overflow="hidden"
      >
        {/* Spotlight overlay */}
        {!reduced && (
          <MotionBox
            position="absolute"
            inset={0}
            borderRadius={`${radius}px`}
            pointerEvents="none"
            style={{ background: spotlight, opacity: hovered ? 1 : 0 }}
            transition={{ duration: 0.25 }}
          />
        )}
        <Box position="relative">{children}</Box>
      </Box>
    </Box>
  );
}
