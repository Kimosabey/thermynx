import { Box } from "@chakra-ui/react";
import { motion, useReducedMotion } from "framer-motion";

const MotionBox = motion.create(Box);

/**
 * Page-level fade+slide transition.
 * Respects `prefers-reduced-motion` — collapses to instant render.
 *
 * The `stagger` prop is kept for API compatibility but no longer
 * staggers Outlet's single render output. Individual pages can opt
 * into staggering their own children via Framer Motion variants.
 */
export default function PageTransition({ children }) {
  const shouldReduceMotion = useReducedMotion();

  const variants = shouldReduceMotion
    ? { initial: {}, enter: {}, exit: {} }
    : {
        initial: { opacity: 0, y: 8 },
        enter: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] } },
        exit: { opacity: 0, y: -5, transition: { duration: 0.14 } },
      };

  return (
    <MotionBox
      variants={variants}
      initial="initial"
      animate="enter"
      exit="exit"
      w="100%"
      minW={0}
      maxW="100%"
    >
      {children}
    </MotionBox>
  );
}
