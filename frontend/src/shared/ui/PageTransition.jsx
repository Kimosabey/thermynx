import { Box } from "@chakra-ui/react";
import { motion } from "framer-motion";
import useGsapEntrance from "../hooks/useGsapEntrance";

const MotionBox = motion.create(Box);

// Framer Motion handles the page-level fade+slide
const pageVariants = {
  initial: { opacity: 0, y: 8 },
  enter:   { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit:    { opacity: 0, y: -5, transition: { duration: 0.14 } },
};

/**
 * Wraps page content with:
 *   1. Framer Motion page fade (fast, clean)
 *   2. GSAP stagger on direct children (cards fan in after page appears)
 *
 * stagger — delay between each child card (default 0.06s)
 */
export default function PageTransition({ children, stagger = 0.06 }) {
  const childRef = useGsapEntrance({ stagger, y: 14, duration: 0.42, delay: 0.1 });

  return (
    <MotionBox
      variants={pageVariants}
      initial="initial"
      animate="enter"
      exit="exit"
      w="100%"
      minW={0}
      maxW="100%"
      style={{ width: "100%" }}
    >
      <Box ref={childRef} w="100%">
        {children}
      </Box>
    </MotionBox>
  );
}
