import { Box } from "@chakra-ui/react";
import { motion } from "framer-motion";

const MotionBox = motion.create(Box);

export default function GlassCard({ children, hover = true, glow = false, p = 5, ...props }) {
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
      whileHover={hover ? { y: -2, borderColor: "rgba(0,196,244,0.25)" } : undefined}
      transition={{ duration: 0.15 }}
      _before={glow ? {
        content: '""',
        position: "absolute",
        top: 0, left: 0, right: 0,
        height: "1px",
        bgGradient: "linear(to-r, transparent, accent.cyan, transparent)",
        opacity: 0.6,
      } : undefined}
      sx={{
        backdropFilter: "blur(12px)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
      {...props}
    >
      {children}
    </MotionBox>
  );
}
