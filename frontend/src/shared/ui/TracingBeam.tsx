import { useEffect, useRef, useState, type ReactNode, type HTMLAttributes } from "react";
import { motion, useTransform, useScroll, useSpring } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * TracingBeam — Aceternity UI component ported to Tailwind v4 + Framer Motion.
 * Tracks the scroll progress of its container and draws an animated SVG
 * gradient laser beam that follows the user's scroll.
 */
export interface TracingBeamProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

export default function TracingBeam({ children, className, ...props }: TracingBeamProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    container: containerRef,
  });

  const contentRef = useRef<HTMLDivElement>(null);
  const [svgHeight, setSvgHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) {
      const observer = new ResizeObserver((entries) => {
        setSvgHeight(entries[0].contentRect.height);
      });
      observer.observe(contentRef.current);
      return () => observer.disconnect();
    }
  }, []);

  // Map scroll progress to SVG height
  const y1 = useSpring(
    useTransform(scrollYProgress, [0, 1], [0, svgHeight]),
    { stiffness: 500, damping: 90 }
  );

  // The tail of the gradient beam lags behind
  const y2 = useSpring(
    useTransform(scrollYProgress, [0, 1], [-200, svgHeight - 200]),
    { stiffness: 500, damping: 90 }
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative h-full w-full overflow-y-auto",
        "[&::-webkit-scrollbar]:w-[4px]",
        "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[rgba(31,63,254,0.25)]",
        className,
      )}
      {...props}
    >
      <div className="relative min-h-full w-full" ref={contentRef}>
        {svgHeight > 0 && (
          <div className="pointer-events-none absolute top-0 left-0 h-full w-[20px]">
            {/* The glowing dot head of the laser */}
            <motion.div
              style={{
                position: "absolute",
                left: "4px",
                top: y1,
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                backgroundColor: "var(--brand)",
                boxShadow: "0 0 16px 2px var(--brand)",
                border: "2px solid white",
                zIndex: 2,
                translateY: "-6px", // Center the dot on the tip of the beam
              }}
            />

            {/* The SVG path and gradient laser beam */}
            <svg
              viewBox={`0 0 20 ${svgHeight}`}
              width="20"
              height={svgHeight}
              style={{ position: "absolute", top: 0, left: 0 }}
            >
              {/* Background muted track line */}
              <path
                d={`M 10 0 V ${svgHeight}`}
                fill="none"
                stroke="var(--border-subtle)"
                strokeWidth="1.5"
              />

              {/* The glowing laser beam */}
              <motion.path
                d={`M 10 0 V ${svgHeight}`}
                fill="none"
                stroke="url(#gradient-beam)"
                strokeWidth="3"
                strokeLinecap="round"
              />

              <defs>
                <motion.linearGradient
                  id="gradient-beam"
                  gradientUnits="userSpaceOnUse"
                  x1="0"
                  x2="0"
                  y1={y2}
                  y2={y1}
                >
                  <stop stopColor="rgba(31,63,254,0)" stopOpacity="0" />
                  <stop offset="0.4" stopColor="var(--cyan)" />
                  <stop offset="1" stopColor="var(--brand)" />
                </motion.linearGradient>
              </defs>
            </svg>
          </div>
        )}

        {/* Render the actual timeline children slightly offset from the beam */}
        <div className="py-[16px] pr-[4px] pl-[32px]">{children}</div>
      </div>
    </div>
  );
}
