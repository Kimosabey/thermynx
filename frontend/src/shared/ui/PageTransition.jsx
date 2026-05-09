import { motion } from "framer-motion";
import { Box } from "@chakra-ui/react";

const variants = {
  initial: { opacity: 0, y: 10 },
  enter:   { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit:    { opacity: 0, y: -6, transition: { duration: 0.15 } },
};

const MotionBox = motion(Box);

export default function PageTransition({ children }) {
  return (
    <MotionBox
      variants={variants}
      initial="initial"
      animate="enter"
      exit="exit"
      style={{ width: "100%" }}
    >
      {children}
    </MotionBox>
  );
}
