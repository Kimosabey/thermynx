/**
 * GraylinxLogo — animated lockup around the real Graylinx PNG.
 *
 * Uses the actual brand PNG (src/assets/logo.png) — fully on-prem, no
 * remote assets. Framer Motion adds a breathing glow + hover spring +
 * gradient sheen behind the mark so the logo reads as "live", without
 * altering the brand artwork itself.
 *
 *   <GraylinxLogo />                  → full lockup (default)
 *   <GraylinxLogo variant="mark" />   → mark only (sidebar collapsed)
 *   <GraylinxLogo variant="wordmark"> → wordmark text (fallback / mobile)
 */

import { Box, Flex, Image, Text } from "@chakra-ui/react";
import { motion, useReducedMotion } from "framer-motion";

import logoPng from "../../assets/logo.png";

const MotionBox = motion.create(Box);

const BRAND_500 = "#1F3FFE";
const BRAND_300 = "#6671FF";

function AnimatedFrame({ children, padding = 6, rounded = 12, glow = true, animated = true }) {
  const reduced = useReducedMotion();
  const animate = animated && !reduced;
  return (
    <MotionBox
      position="relative"
      display="inline-flex"
      alignItems="center"
      justifyContent="center"
      borderRadius={`${rounded}px`}
      bg="white"
      p={`${padding}px`}
      boxShadow={`0 0 0 1px ${BRAND_500}26, 0 6px 18px ${BRAND_500}33`}
      whileHover={animate ? { scale: 1.04 } : undefined}
      transition={{ type: "spring", stiffness: 280, damping: 18 }}
    >
      {/* Soft breathing glow behind the mark */}
      {animate && glow && (
        <MotionBox
          position="absolute"
          inset="-6px"
          borderRadius={`${rounded + 6}px`}
          bg={`radial-gradient(circle at 50% 50%, ${BRAND_500}3b 0%, transparent 70%)`}
          animate={{ opacity: [0.45, 0.9, 0.45], scale: [1, 1.05, 1] }}
          transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
          pointerEvents="none"
        />
      )}
      <Box position="relative">{children}</Box>
    </MotionBox>
  );
}

function LogoWordmark({ color = "white", muted = "rgba(255,255,255,0.35)", tagline = "HVAC intelligence" }) {
  const reduced = useReducedMotion();
  return (
    <Box>
      <MotionBox
        as="span"
        display="inline-block"
        fontFamily="heading"
        fontWeight={800}
        fontSize="15px"
        letterSpacing="-0.02em"
        lineHeight="1.1"
        color={color}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
        sx={
          reduced
            ? undefined
            : {
                backgroundImage: `linear-gradient(90deg, ${color} 0%, ${BRAND_300} 45%, ${color} 100%)`,
                backgroundSize: "200% 100%",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
                animation: "glxSheen 5.5s linear infinite",
                "@keyframes glxSheen": {
                  "0%":   { backgroundPosition: "200% 0" },
                  "100%": { backgroundPosition: "-200% 0" },
                },
              }
        }
      >
        Graylinx
      </MotionBox>
      {tagline && (
        <Text
          fontSize="9px"
          color={muted}
          letterSpacing="0.14em"
          textTransform="uppercase"
          mt="1px"
        >
          {tagline}
        </Text>
      )}
    </Box>
  );
}

export function GraylinxLogo({
  variant = "full",
  height = 28,
  animated = true,
  color = "white",
  muted = "rgba(255,255,255,0.35)",
  tagline = "HVAC intelligence",
}) {
  if (variant === "wordmark") {
    return <LogoWordmark color={color} muted={muted} tagline={tagline} />;
  }

  // Square framed mark (sidebar collapsed / chips). Show the PNG centred.
  if (variant === "mark") {
    const size = height + 12; // padding box
    return (
      <AnimatedFrame padding={4} rounded={10} animated={animated}>
        <Image
          src={logoPng}
          alt="Graylinx"
          h={`${height}px`}
          w={`${height}px`}
          objectFit="contain"
        />
      </AnimatedFrame>
    );
  }

  // Full lockup — the real brand PNG with breathing glow + hover spring.
  return (
    <Flex align="center" gap={3}>
      <AnimatedFrame padding={6} rounded={12} animated={animated}>
        <Image
          src={logoPng}
          alt="Graylinx"
          h={`${height}px`}
          w="auto"
          objectFit="contain"
          draggable={false}
        />
      </AnimatedFrame>
      {tagline && (
        <Text
          fontSize="9px"
          color={muted}
          letterSpacing="0.14em"
          textTransform="uppercase"
        >
          {tagline}
        </Text>
      )}
    </Flex>
  );
}

export default GraylinxLogo;
