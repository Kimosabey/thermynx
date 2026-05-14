import { Box, Flex } from "@chakra-ui/react";
import { motion } from "framer-motion";

const MotionBox = motion.create(Box);

// Framer Motion shimmer — smoother than CSS keyframes, synced to new palette
const shimmerVariants = {
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

function ShimmerBox({ h = "12px", w = "100%", borderRadius = "6px", mb = 0, mt = 0 }) {
  return (
    <Box
      h={h} w={w} mb={mb} mt={mt}
      borderRadius={borderRadius}
      bg="#EFF0FF"
      overflow="hidden"
      position="relative"
      flexShrink={0}
    >
      <MotionBox
        position="absolute"
        top={0} bottom={0}
        w="60%"
        variants={shimmerVariants}
        initial="initial"
        animate="animate"
        sx={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(199,201,255,0.7) 50%, transparent 100%)",
        }}
      />
    </Box>
  );
}

// Staggered container — children animate in sequence
const staggerContainer = {
  animate: { transition: { staggerChildren: 0.08 } },
};
const staggerItem = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
};

function SkeletonShell({ children }) {
  return (
    <Box
      bg="bg.surface"
      borderRadius="16px"
      border="1px solid"
      borderColor="border.subtle"
      p={5}
      overflow="hidden"
    >
      {children}
    </Box>
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
      <Flex align="center" gap={3} mb={4}>
        <ShimmerBox h="32px" w="32px" borderRadius="8px" />
        <Box flex={1}>
          <ShimmerBox h="11px" w="60%" mb={2} />
          <ShimmerBox h="10px" w="40%" />
        </Box>
      </Flex>
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
      <Flex align="flex-end" gap={2} h="80px" mb={3}>
        {[65, 80, 55, 90, 70, 85, 60, 75, 88, 50, 72, 68].map((pct, i) => (
          <Box key={i} flex={1} borderRadius="4px 4px 0 0" bg="#EFF0FF" overflow="hidden"
            position="relative" style={{ height: `${pct}%` }}>
            <MotionBox
              position="absolute" top={0} bottom={0} w="60%"
              variants={shimmerVariants}
              initial="initial"
              animate="animate"
              sx={{ background: "linear-gradient(90deg, transparent, rgba(199,201,255,0.7), transparent)" }}
              style={{ animationDelay: `${i * 0.05}s` }}
            />
          </Box>
        ))}
      </Flex>
      <ShimmerBox h="10px" w="100%" mb={2} borderRadius="2px" />
    </SkeletonShell>
  );
}

export function SkeletonListCard({ rows = 4 }) {
  return (
    <SkeletonShell>
      <ShimmerBox h="11px" w="40%" mb={5} />
      {Array.from({ length: rows }).map((_, i) => (
        <Flex key={i} align="center" gap={3} mb={i < rows - 1 ? 4 : 0}>
          <ShimmerBox h="8px" w="8px" borderRadius="full" />
          <ShimmerBox h="10px" w={`${55 + (i % 3) * 12}%`} />
          <Box ml="auto" flexShrink={0}>
            <ShimmerBox h="18px" w="48px" borderRadius="full" />
          </Box>
        </Flex>
      ))}
    </SkeletonShell>
  );
}

// Grid of staggered skeletons for page-level loading state
export function SkeletonDashboard() {
  return (
    <MotionBox variants={staggerContainer} initial="initial" animate="animate">
      <Flex gap={4} mb={4} flexWrap="wrap">
        {[0, 1, 2, 3].map((i) => (
          <MotionBox key={i} flex="1 1 180px" variants={staggerItem}>
            <SkeletonKpiCard />
          </MotionBox>
        ))}
      </Flex>
      <MotionBox variants={staggerItem} mb={4}>
        <SkeletonChartCard />
      </MotionBox>
      <Flex gap={4}>
        {[0, 1, 2].map((i) => (
          <MotionBox key={i} flex={1} variants={staggerItem}>
            <SkeletonEquipCard />
          </MotionBox>
        ))}
      </Flex>
    </MotionBox>
  );
}
