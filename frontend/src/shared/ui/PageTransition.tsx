import { type ReactNode } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { cn } from "@/lib/utils";

export interface PageTransitionProps {
  children?: ReactNode;
  className?: string;
}

/**
 * Page-level fade+slide transition.
 * Respects `prefers-reduced-motion` — collapses to instant render.
 *
 * Drive the variants from a parent <AnimatePresence> (e.g. keyed on the
 * route pathname) so the `exit` variant fires on navigation. Individual
 * pages can opt into staggering their own children via Framer Motion
 * variants.
 */
export default function PageTransition({ children, className }: PageTransitionProps) {
  const shouldReduceMotion = useReducedMotion();

  const variants: Variants = shouldReduceMotion
    ? { initial: {}, enter: {}, exit: {} }
    : {
        initial: { opacity: 0, y: 8 },
        enter: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] } },
        exit: { opacity: 0, y: -5, transition: { duration: 0.14 } },
      };

  return (
    <motion.div
      variants={variants}
      initial="initial"
      animate="enter"
      exit="exit"
      className={cn("w-full max-w-full min-w-0", className)}
    >
      {children}
    </motion.div>
  );
}
