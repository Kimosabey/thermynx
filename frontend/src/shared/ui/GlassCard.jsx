import { useEffect, useState } from "react";
import { Box } from "@chakra-ui/react";
import { motion, useReducedMotion } from "framer-motion";

const MotionBox = motion.create(Box);

/**
 * Detects pointer:coarse / hover:none — i.e. touch-primary devices.
 * Used to disable hover lift so cards don't get stuck in "elevated" state on tap.
 */
function useIsTouchDevice() {
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(hover: none)");
    setIsTouch(mq.matches);
    const onChange = (e) => setIsTouch(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return isTouch;
}

export default function GlassCard({
  children,
  hover = true,
  accent = false,
  glow = false,
  p = { base: 4, md: 5 },
  ...props
}) {
  const isTouch = useIsTouchDevice();
  const shouldReduceMotion = useReducedMotion();
  const enableHover = hover && !isTouch && !shouldReduceMotion;

  return (
    <MotionBox
      position="relative"
      bg="bg.surface"
      borderRadius="16px"
      border="1px solid"
      borderColor="border.subtle"
      p={p}
      overflow="hidden"
      minW={0}
      maxW="100%"
      boxShadow="card"
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
        <Box
          aria-hidden="true"
          position="absolute" top={0} left={0} right={0} h="2px"
          bgGradient="linear(to-r, transparent, brand.500, transparent)"
          opacity={0.55} zIndex={1}
        />
      )}
      {/* Left accent bar */}
      {accent && (
        <Box
          aria-hidden="true"
          position="absolute" top={0} bottom={0} left={0} w="3px"
          bg="accent.primary" borderRadius="16px 0 0 16px"
        />
      )}
      {children}
    </MotionBox>
  );
}
