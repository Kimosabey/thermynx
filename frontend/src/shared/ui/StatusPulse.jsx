import { useEffect, useState } from "react";
import { Box, VisuallyHidden } from "@chakra-ui/react";
import { keyframes } from "@emotion/react";

const pulse = keyframes`
  0%   { transform: scale(1);   opacity: 1; }
  50%  { transform: scale(1.8); opacity: 0; }
  100% { transform: scale(1);   opacity: 1; }
`;

export default function StatusPulse({ active = true, size = "8px", label }) {
  const color = active ? "#059669" : "#CBD5E1";
  const a11yLabel = label ?? (active ? "Data feed live" : "Data feed offline");

  // Pause CSS animation when tab is hidden (saves GPU)
  const [docHidden, setDocHidden] = useState(false);
  useEffect(() => {
    const onVis = () => setDocHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return (
    <Box role="status" position="relative" w={size} h={size} flexShrink={0} display="inline-flex">
      {active && (
        <Box
          aria-hidden="true"
          position="absolute"
          inset={0}
          borderRadius="full"
          bg={color}
          opacity={0.4}
          animation={`${pulse} 2s ease-in-out infinite`}
          sx={{
            animationPlayState: docHidden ? "paused" : "running",
            "@media (prefers-reduced-motion: reduce)": { animation: "none" },
          }}
        />
      )}
      <Box aria-hidden="true" w={size} h={size} borderRadius="full" bg={color} position="relative" />
      <VisuallyHidden>{a11yLabel}</VisuallyHidden>
    </Box>
  );
}
