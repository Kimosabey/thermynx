import { Box } from "@chakra-ui/react";
import { keyframes } from "@emotion/react";

const pulse = keyframes`
  0%   { transform: scale(1);   opacity: 1; }
  50%  { transform: scale(1.8); opacity: 0; }
  100% { transform: scale(1);   opacity: 1; }
`;

export default function StatusPulse({ active = true, size = "8px" }) {
  const color = active ? "#059669" : "#CBD5E1";
  return (
    <Box position="relative" w={size} h={size} flexShrink={0}>
      {active && (
        <Box
          position="absolute"
          inset={0}
          borderRadius="full"
          bg={color}
          opacity={0.4}
          animation={`${pulse} 2s ease-in-out infinite`}
        />
      )}
      <Box w={size} h={size} borderRadius="full" bg={color} position="relative" />
    </Box>
  );
}
