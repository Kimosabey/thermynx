import { useEffect, useRef } from "react";
import { gsap } from "gsap";

/**
 * Stagger-animates direct children of the returned `ref` on mount.
 *
 * Usage:
 *   const ref = useGsapEntrance();
 *   <Box ref={ref}> <Card /> <Card /> <Card /> </Box>
 *
 * Options:
 *   stagger   — seconds between each child  (default 0.07)
 *   y         — start offset in px          (default 18)
 *   duration  — per-child tween duration    (default 0.45)
 *   delay     — initial delay before start  (default 0)
 *   selector  — child selector string       (default "> *")
 */
export default function useGsapEntrance({
  stagger  = 0.07,
  y        = 18,
  duration = 0.45,
  delay    = 0,
  selector = "> *",
} = {}) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        selector,
        { opacity: 0, y },
        {
          opacity: 1,
          y: 0,
          duration,
          delay,
          stagger,
          ease: "power3.out",
          clearProps: "transform,opacity",
        }
      );
    }, ref.current);

    return () => ctx.revert();
  }, [stagger, y, duration, delay, selector]);

  return ref;
}
