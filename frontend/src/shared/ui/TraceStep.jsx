import { useState } from "react";
import { Box, Flex, Text } from "@chakra-ui/react";
import { Check, Wrench, List, Zap, ScanSearch, BarChart2, Columns2, History } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const MotionBox = motion.create(Box);

const TOOL_META = {
  get_equipment_list:     { label: "Equipment List",    Icon: List },
  compute_efficiency:     { label: "Efficiency Calc",   Icon: Zap },
  detect_anomalies:       { label: "Anomaly Scan",      Icon: ScanSearch },
  get_timeseries_summary: { label: "Timeseries Stats",  Icon: BarChart2 },
  compare_equipment:      { label: "Compare",           Icon: Columns2 },
  get_anomaly_history:    { label: "History",           Icon: History },
  retrieve_manual:        { label: "Manual Lookup",     Icon: List },
};

// Shimmer text for running state (Claude-style sweep)
function ShimmerLabel({ children }) {
  return (
    <Box
      as="span"
      sx={{
        backgroundImage:
          "linear-gradient(90deg, var(--chakra-colors-text-primary) 0%, var(--chakra-colors-text-primary) 35%, #6671FF 45%, #1F3FFE 50%, #6671FF 55%, var(--chakra-colors-text-primary) 65%, var(--chakra-colors-text-primary) 100%)",
        backgroundSize: "200% 100%",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        WebkitTextFillColor: "transparent",
        color: "transparent",
        animation: "shimmer-text 2.1s linear infinite",
        fontSize: "12px",
        fontWeight: 600,
      }}
    >
      {children}
    </Box>
  );
}

/**
 * Reasoning trace step — design system spec.
 *
 * status: "done" | "running" | "pending"
 * frame: SSE frame from agent (type: tool_call | tool_result)
 * step: step number
 */
export default function TraceStep({ frame, status = "done" }) {
  const [expanded, setExpanded] = useState(false);

  const isTool   = frame.type === "tool_call" || frame.type === "tool_result";
  const meta     = TOOL_META[frame.tool] ?? { label: frame.tool ?? "Unknown", Icon: Wrench };
  const MetaIcon = meta.Icon;

  // Dot styles
  const dot = {
    done:    { bg: "accent.primary", border: "accent.primary", color: "white" },
    running: { bg: "bg.surface",     border: "accent.primary", color: "accent.primary" },
    pending: { bg: "bg.surface",     border: "border.subtle",  color: "border.subtle" },
  }[status] ?? { bg: "accent.primary", border: "accent.primary", color: "white" };

  // Row styles
  const row = {
    done:    { bg: "rgba(31,63,254,0.04)", border: "rgba(31,63,254,0.18)", shadow: "none" },
    running: { bg: "bg.surface",           border: "rgba(31,63,254,0.30)", shadow: "0 4px 14px rgba(31,63,254,0.08)" },
    pending: { bg: "bg.elevated",          border: "border.subtle",        shadow: "none" },
  }[status] ?? { bg: "rgba(31,63,254,0.04)", border: "rgba(31,63,254,0.18)", shadow: "none" };

  const toolIconBg = status === "pending" ? "bg.elevated" : "rgba(31,63,254,0.10)";
  const toolIconColor = status === "pending" ? "text.faint" : "accent.primary";

  const hasExpandable = (frame.args && Object.keys(frame.args).length > 0) ||
                        (frame.result && typeof frame.result === "object");
  const expandData    = frame.type === "tool_call" ? frame.args : frame.result;

  return (
    <MotionBox
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      position="relative"
      py={1}
    >
      {/* Step dot */}
      <Box
        position="absolute" left="-22px" top="14px"
        w="18px" h="18px" borderRadius="full"
        bg={dot.bg} border="1.5px solid" borderColor={dot.border}
        display="flex" alignItems="center" justifyContent="center"
        zIndex={2}
        animation={status === "running" ? "pulse-halo 1.6s ease-out infinite" : undefined}
      >
        {status === "done" && <Check size={10} strokeWidth={3} color="white" />}
        {status === "running" && (
          <Box w="7px" h="7px" borderRadius="full" bg="accent.primary" />
        )}
      </Box>

      {/* Row */}
      <Box
        as={hasExpandable ? "button" : "div"}
        w="full"
        textAlign="left"
        onClick={hasExpandable ? () => setExpanded(!expanded) : undefined}
        bg={row.bg}
        border="1px solid"
        borderColor={row.border}
        boxShadow={row.shadow}
        borderRadius="12px"
        px={3} py="9px"
        mb={2}
        transition="all 0.18s ease"
        cursor={hasExpandable ? "pointer" : "default"}
        _hover={hasExpandable ? { opacity: 0.9 } : {}}
      >
        <Flex align="center" gap="10px">
          {/* Tool icon */}
          <Box
            w="22px" h="22px" borderRadius="7px" flexShrink={0}
            display="flex" alignItems="center" justifyContent="center"
            bg={toolIconBg} color={toolIconColor}
          >
            <MetaIcon size={13} strokeWidth={2} />
          </Box>

          {/* Label */}
          {status === "running"
            ? <ShimmerLabel>{frame.runningLabel ?? `${meta.label}…`}</ShimmerLabel>
            : <Text fontSize="12px" fontWeight={status === "pending" ? 500 : 600}
                color={status === "pending" ? "text.faint" : "text.primary"}>
                {frame.type === "tool_result" ? `${meta.label} result` : meta.label}
              </Text>
          }

          {/* Right meta */}
          <Flex ml="auto" align="center" gap={2} flexShrink={0}>
            {frame.step != null && (
              <Box
                px="6px" py="2px" borderRadius="5px" fontSize="9px" fontWeight={700}
                letterSpacing="0.04em" fontFamily="body"
                bg={status === "pending" ? "bg.elevated" : "rgba(31,63,254,0.10)"}
                color={status === "pending" ? "text.faint" : "accent.primary"}
              >
                step {frame.step}
              </Box>
            )}
            {hasExpandable && (
              <Text fontSize="10px" color="text.muted">{expanded ? "▲" : "▼"}</Text>
            )}
          </Flex>
        </Flex>

        {/* Expandable JSON */}
        <AnimatePresence>
          {expanded && expandData && (
            <MotionBox
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              overflow="hidden"
            >
              <Box
                mt={2} p={2}
                bg="bg.elevated" borderRadius="8px"
                fontSize="10px" fontFamily="mono" color="text.muted"
                maxH="120px" overflowY="auto"
                textAlign="left"
              >
                {JSON.stringify(expandData, null, 2)}
              </Box>
            </MotionBox>
          )}
        </AnimatePresence>
      </Box>
    </MotionBox>
  );
}
