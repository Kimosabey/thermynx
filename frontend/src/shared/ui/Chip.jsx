import { Box } from "@chakra-ui/react";
import { motion, useReducedMotion } from "framer-motion";

const MotionBox = motion.create(Box);

/**
 * Quick-prompt chip — pill-shaped button for preset questions.
 * Accent color animates on hover/active.
 *
 * Usage:
 *   <Chip onClick={() => setGoal(text)}>{text}</Chip>
 *   <Chip accentColor="#10b981" active onClick={...}>...</Chip>
 */
export default function Chip({ children, onClick, active = false, accentColor, ...props }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <MotionBox
      as="button"
      type="button"
      onClick={onClick}
      whileHover={shouldReduceMotion ? undefined : { y: -1 }}
      whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.15 }}
      fontSize="11px"
      fontWeight={500}
      lineHeight={1.4}
      px="14px"
      py="9px"
      minH="32px"
      borderRadius="full"
      border="1px solid"
      bg={active ? "accent.glow" : "bg.surface"}
      borderColor={active ? "accent.primary" : "border.subtle"}
      color={active ? "accent.primary" : "text.muted"}
      cursor="pointer"
      textAlign="left"
      fontFamily="body"
      aria-pressed={active}
      _hover={{
        bg: "accent.glow",
        borderColor: accentColor || "accent.primary",
        color: accentColor || "accent.primary",
      }}
      sx={{
        transition: "all 0.15s",
        ...(accentColor
          ? {
              "&:hover": {
                background: `${accentColor}18`,
                borderColor: accentColor,
                color: accentColor,
              },
            }
          : {}),
      }}
      {...props}
    >
      {children}
    </MotionBox>
  );
}
