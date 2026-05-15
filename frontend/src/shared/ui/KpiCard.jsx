import { useEffect, useRef, useState } from "react";
import { Box, Text, Flex } from "@chakra-ui/react";
import { motion, animate, useReducedMotion } from "framer-motion";
import GlassCard from "./GlassCard";

const MotionBox = motion.create(Box);

/**
 * Animated number that counts from the previous value to the new value.
 * On first mount, animates from 0. On subsequent updates, animates from the
 * prior displayed value — so a refresh of 87 → 88 does NOT reset to 0.
 *
 * Respects `prefers-reduced-motion` — sets value instantly.
 */
function AnimatedNumber({ value, decimals = 0 }) {
  const [display, setDisplay] = useState("—");
  const prevRef = useRef(null);
  const isMount = useRef(true);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (value == null) { setDisplay("—"); prevRef.current = null; return; }
    const target = parseFloat(value);
    if (isNaN(target)) { setDisplay(String(value)); return; }

    // Reduced motion or first mount with no previous value → snap
    if (shouldReduceMotion) {
      setDisplay(target.toFixed(decimals));
      prevRef.current = target;
      isMount.current = false;
      return;
    }

    const from = isMount.current ? 0 : (prevRef.current ?? 0);
    isMount.current = false;

    // Skip animation if change is < 1% of base (noise filter)
    const base = Math.abs(from) || Math.abs(target) || 1;
    if (Math.abs(target - from) / base < 0.01) {
      setDisplay(target.toFixed(decimals));
      prevRef.current = target;
      return;
    }

    const controls = animate(from, target, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(v.toFixed(decimals)),
      onComplete: () => { prevRef.current = target; },
    });
    return controls.stop;
  }, [value, decimals, shouldReduceMotion]);

  return <span>{display}</span>;
}

export default function KpiCard({ label, value, unit, helpText, decimals = 0, accent = "accent.primary", trend, trendValue, icon }) {
  const trendColor = trend === "up" ? "status.good" : trend === "down" ? "status.bad" : "text.muted";
  const trendIcon  = trend === "up" ? "↑" : trend === "down" ? "↓" : "";
  const shouldReduceMotion = useReducedMotion();

  return (
    <GlassCard glow={false} hover minW={0}>
      <Flex justify="space-between" align="flex-start">
        <Text fontSize="11px" fontWeight={700} color="text.muted"
          textTransform="uppercase" letterSpacing="0.08em" mb={3} lineHeight="1.25"
          wordBreak="break-word" noOfLines={2}>
          {label}
        </Text>
        {icon && <Box color="text.muted" opacity={0.45} flexShrink={0} aria-hidden="true">{icon}</Box>}
      </Flex>

      <Flex align="baseline" gap={1}>
        <MotionBox
          initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
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
            aria-label={value != null ? `${label}: ${value}${unit ? " " + unit : ""}` : undefined}
          >
            <AnimatedNumber value={value} decimals={decimals} />
          </Text>
        </MotionBox>
        {unit && <Text fontSize="sm" fontWeight={500} color="text.muted" aria-hidden="true">{unit}</Text>}
      </Flex>

      {(helpText || trendValue) && (
        <Flex align="center" gap={2} mt={2}>
          {trendValue && (
            <Text fontSize="xs" fontWeight={600} color={trendColor}>
              <span aria-hidden="true">{trendIcon}</span> {trendValue}
            </Text>
          )}
          {helpText && <Text fontSize="xs" color="text.muted">{helpText}</Text>}
        </Flex>
      )}
    </GlassCard>
  );
}
