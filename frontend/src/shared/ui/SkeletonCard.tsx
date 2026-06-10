import { type ReactNode, type CSSProperties } from "react";
import { motion, type Variants } from "framer-motion";

// Framer Motion shimmer — smoother than CSS keyframes, synced to new palette
const shimmerVariants: Variants = {
  initial: { x: "-100%" },
  animate: {
    x: "100%",
    transition: {
      repeat: Infinity,
      repeatType: "loop",
      duration: 1.6,
      ease: "easeInOut",
    },
  },
};

interface ShimmerBoxProps {
  h?: string;
  w?: string;
  borderRadius?: string;
  mb?: number;
  mt?: number;
}

function ShimmerBox({ h = "12px", w = "100%", borderRadius = "6px", mb = 0, mt = 0 }: ShimmerBoxProps) {
  return (
    <div
      className="relative shrink-0 overflow-hidden"
      style={{
        height: h,
        width: w,
        marginBottom: mb * 4,
        marginTop: mt * 4,
        borderRadius: borderRadius === "full" ? "9999px" : borderRadius,
        background: "#EFF0FF",
      }}
    >
      <motion.div
        className="absolute inset-y-0 w-[60%]"
        variants={shimmerVariants}
        initial="initial"
        animate="animate"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(199,201,255,0.7) 50%, transparent 100%)",
        }}
      />
    </div>
  );
}

// Staggered container — children animate in sequence
const staggerContainer: Variants = {
  animate: { transition: { staggerChildren: 0.08 } },
};
const staggerItem: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
};

function SkeletonShell({ children }: { children?: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface p-5">
      {children}
    </div>
  );
}

export function SkeletonKpiCard() {
  return (
    <SkeletonShell>
      <ShimmerBox h="10px" w="55%" mb={4} />
      <ShimmerBox h="30px" w="38%" mb={3} />
      <ShimmerBox h="10px" w="70%" />
    </SkeletonShell>
  );
}

export function SkeletonEquipCard() {
  return (
    <SkeletonShell>
      <div className="mb-4 flex items-center gap-3">
        <ShimmerBox h="32px" w="32px" borderRadius="8px" />
        <div className="flex-1">
          <ShimmerBox h="11px" w="60%" mb={2} />
          <ShimmerBox h="10px" w="40%" />
        </div>
      </div>
      <ShimmerBox h="10px" w="100%" mb={2} />
      <ShimmerBox h="10px" w="82%" mb={2} />
      <ShimmerBox h="10px" w="91%" />
    </SkeletonShell>
  );
}

export function SkeletonChartCard() {
  return (
    <SkeletonShell>
      <ShimmerBox h="11px" w="45%" mb={5} />
      {/* Chart bars */}
      <div className="mb-3 flex h-[80px] items-end gap-2">
        {[65, 80, 55, 90, 70, 85, 60, 75, 88, 50, 72, 68].map((pct, i) => (
          <div
            key={i}
            className="relative flex-1 overflow-hidden"
            style={{ height: `${pct}%`, borderRadius: "4px 4px 0 0", background: "#EFF0FF" }}
          >
            <motion.div
              className="absolute inset-y-0 w-[60%]"
              variants={shimmerVariants}
              initial="initial"
              animate="animate"
              style={
                {
                  background: "linear-gradient(90deg, transparent, rgba(199,201,255,0.7), transparent)",
                  animationDelay: `${i * 0.05}s`,
                } as CSSProperties
              }
            />
          </div>
        ))}
      </div>
      <ShimmerBox h="10px" w="100%" mb={2} borderRadius="2px" />
    </SkeletonShell>
  );
}

export function SkeletonListCard({ rows = 4 }: { rows?: number }) {
  return (
    <SkeletonShell>
      <ShimmerBox h="11px" w="40%" mb={5} />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3" style={{ marginBottom: i < rows - 1 ? 16 : 0 }}>
          <ShimmerBox h="8px" w="8px" borderRadius="full" />
          <ShimmerBox h="10px" w={`${55 + (i % 3) * 12}%`} />
          <div className="ml-auto shrink-0">
            <ShimmerBox h="18px" w="48px" borderRadius="full" />
          </div>
        </div>
      ))}
    </SkeletonShell>
  );
}

// Grid of staggered skeletons for page-level loading state
export function SkeletonDashboard() {
  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <div className="mb-4 flex flex-wrap gap-4">
        {[0, 1, 2, 3].map((i) => (
          <motion.div key={i} className="flex-[1_1_180px]" variants={staggerItem}>
            <SkeletonKpiCard />
          </motion.div>
        ))}
      </div>
      <motion.div className="mb-4" variants={staggerItem}>
        <SkeletonChartCard />
      </motion.div>
      <div className="flex gap-4">
        {[0, 1, 2].map((i) => (
          <motion.div key={i} className="flex-1" variants={staggerItem}>
            <SkeletonEquipCard />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

export default SkeletonDashboard;
