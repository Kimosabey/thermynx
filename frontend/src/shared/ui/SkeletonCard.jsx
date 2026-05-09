import { Box } from "@chakra-ui/react";
import { keyframes } from "@emotion/react";

const shimmer = keyframes`
  0%   { background-position: -400px 0; }
  100% { background-position: 400px 0; }
`;

function ShimmerBox({ h = "12px", w = "100%", borderRadius = "6px", mb = 0 }) {
  return (
    <Box
      h={h} w={w} mb={mb}
      borderRadius={borderRadius}
      sx={{
        background: "linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 75%)",
        backgroundSize: "800px 100%",
        animation: `${shimmer} 1.5s infinite linear`,
      }}
    />
  );
}

export function SkeletonKpiCard() {
  return (
    <Box
      bg="bg.surface"
      borderRadius="16px"
      border="1px solid"
      borderColor="border.subtle"
      p={5}
    >
      <ShimmerBox h="10px" w="60%" mb={4} />
      <ShimmerBox h="28px" w="40%" mb={3} />
      <ShimmerBox h="10px" w="75%" />
    </Box>
  );
}

export function SkeletonEquipCard() {
  return (
    <Box
      bg="bg.surface"
      borderRadius="16px"
      border="1px solid"
      borderColor="border.subtle"
      p={5}
    >
      <ShimmerBox h="12px" w="50%" mb={4} />
      <ShimmerBox h="10px" w="100%" mb={2} />
      <ShimmerBox h="10px" w="80%" mb={2} />
      <ShimmerBox h="10px" w="90%" />
    </Box>
  );
}
