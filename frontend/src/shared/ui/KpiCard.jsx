import { useEffect, useRef, useState } from "react";
import { Box, Text, Flex } from "@chakra-ui/react";
import { motion, animate } from "framer-motion";
import GlassCard from "./GlassCard";

function AnimatedNumber({ value, decimals = 0 }) {
  const [display, setDisplay] = useState("—");
  const nodeRef = useRef(null);

  useEffect(() => {
    if (value == null) { setDisplay("—"); return; }
    const target = parseFloat(value);
    if (isNaN(target)) { setDisplay(String(value)); return; }

    const controls = animate(0, target, {
      duration: 1.2,
      ease: [0.25, 0.46, 0.45, 0.94],
      onUpdate: (v) => setDisplay(v.toFixed(decimals)),
    });
    return controls.stop;
  }, [value, decimals]);

  return <span ref={nodeRef}>{display}</span>;
}

export default function KpiCard({
  label,
  value,
  unit,
  helpText,
  decimals = 0,
  accent = "accent.cyan",
  trend,        // "up" | "down" | null
  trendValue,   // "+2.3%"
  icon,
}) {
  const trendColor = trend === "up" ? "green.400" : trend === "down" ? "red.400" : "gray.400";
  const trendIcon  = trend === "up" ? "↑" : trend === "down" ? "↓" : "";

  return (
    <GlassCard glow minW={0}>
      <Flex justify="space-between" align="flex-start">
        <Text
          fontSize="10px"
          fontWeight={700}
          color="text.muted"
          textTransform="uppercase"
          letterSpacing="0.08em"
          mb={3}
          lineHeight="1.25"
          wordBreak="break-word"
          noOfLines={3}
        >
          {label}
        </Text>
        {icon && <Box color="text.muted" opacity={0.5}>{icon}</Box>}
      </Flex>

      <Flex align="baseline" gap={1}>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          style={{ display: "inline-block" }}
        >
          <Text
            fontSize={{ base: "xl", sm: "2xl" }}
            fontWeight={700}
            color={accent}
            sx={{ fontVariantNumeric: "tabular-nums" }}
          >
            <AnimatedNumber value={value} decimals={decimals} />
          </Text>
        </motion.div>
        {unit && (
          <Text fontSize="sm" fontWeight={400} color="text.muted">{unit}</Text>
        )}
      </Flex>

      {(helpText || trendValue) && (
        <Flex align="center" gap={2} mt={2}>
          {trendValue && (
            <Text fontSize="xs" fontWeight={600} color={trendColor}>
              {trendIcon} {trendValue}
            </Text>
          )}
          {helpText && (
            <Text fontSize="xs" color="text.muted">{helpText}</Text>
          )}
        </Flex>
      )}
    </GlassCard>
  );
}
