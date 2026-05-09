import { useEffect, useRef, useState } from "react";
import { Box, Text, Flex } from "@chakra-ui/react";
import { motion, animate } from "framer-motion";
import GlassCard from "./GlassCard";

const MotionBox = motion.create(Box);

function AnimatedNumber({ value, decimals = 0 }) {
  const [display, setDisplay] = useState("—");

  useEffect(() => {
    if (value == null) { setDisplay("—"); return; }
    const target = parseFloat(value);
    if (isNaN(target)) { setDisplay(String(value)); return; }
    const controls = animate(0, target, {
      duration: 1.1,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(v.toFixed(decimals)),
    });
    return controls.stop;
  }, [value, decimals]);

  return <span>{display}</span>;
}

export default function KpiCard({ label, value, unit, helpText, decimals = 0, accent = "accent.primary", trend, trendValue, icon }) {
  const trendColor = trend === "up" ? "status.good" : trend === "down" ? "status.bad" : "text.muted";
  const trendIcon  = trend === "up" ? "↑" : trend === "down" ? "↓" : "";

  return (
    <GlassCard glow={false} hover minW={0}>
      <Flex justify="space-between" align="flex-start">
        <Text fontSize="11px" fontWeight={700} color="text.muted"
          textTransform="uppercase" letterSpacing="0.08em" mb={3} lineHeight="1.25"
          wordBreak="break-word" noOfLines={2}>
          {label}
        </Text>
        {icon && <Box color="text.muted" opacity={0.45} flexShrink={0}>{icon}</Box>}
      </Flex>

      <Flex align="baseline" gap={1}>
        <MotionBox
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          display="inline-block"
        >
          <Text
            fontSize={{ base: "xl", sm: "2xl" }}
            fontWeight={800}
            color={accent}
            fontFamily="heading"
            sx={{ fontVariantNumeric: "tabular-nums" }}
            letterSpacing="-0.03em"
          >
            <AnimatedNumber value={value} decimals={decimals} />
          </Text>
        </MotionBox>
        {unit && <Text fontSize="sm" fontWeight={500} color="text.muted">{unit}</Text>}
      </Flex>

      {(helpText || trendValue) && (
        <Flex align="center" gap={2} mt={2}>
          {trendValue && (
            <Text fontSize="xs" fontWeight={600} color={trendColor}>
              {trendIcon} {trendValue}
            </Text>
          )}
          {helpText && <Text fontSize="xs" color="text.muted">{helpText}</Text>}
        </Flex>
      )}
    </GlassCard>
  );
}
