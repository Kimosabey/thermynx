/**
 * Unified AI page — single sidebar entry for both interaction depths:
 *   Quick Ask  → /api/v1/analyze  (single LLM call + RAG + chart + threads)
 *   Agents     → /api/v1/agent/*  (ReAct loop, tool calls, 6 specialist modes)
 *
 * URL state: /ai?mode=quick (default) | /ai?mode=agent
 * Old routes /analyzer and /agent redirect here (see App.jsx).
 */
import { useSearchParams } from "react-router-dom";
import { Box, Flex, Text } from "@chakra-ui/react";
import { motion } from "framer-motion";
import { MessageSquareText, Bot } from "lucide-react";
import { lazy, Suspense } from "react";
import { Spinner } from "@chakra-ui/react";

// Re-use the existing pages unchanged — just render them below the switcher
const AIAnalyzer = lazy(() => import("../analyzer"));
const AgentHub   = lazy(() => import("../agent"));

const MotionBox = motion.create(Box);

const MODES = [
  {
    id:       "quick",
    label:    "Quick Ask",
    Icon:     MessageSquareText,
    color:    "#00c4f4",
    tagline:  "Instant answer — RAG context, chart, conversation memory",
  },
  {
    id:       "agent",
    label:    "Autonomous Agents",
    Icon:     Bot,
    color:    "#1F3FFE",
    tagline:  "Deep investigation — ReAct loop, tool calls, 6 specialist modes",
  },
];

function ModeSwitcher({ active, onChange }) {
  return (
    <Flex
      gap={2}
      p="3px"
      bg="rgba(255,255,255,0.04)"
      border="1px solid rgba(255,255,255,0.08)"
      borderRadius="14px"
      w="fit-content"
      mb={6}
      role="tablist"
      aria-label="AI mode"
    >
      {MODES.map((m) => {
        const selected = active === m.id;
        return (
          <MotionBox
            key={m.id}
            as="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`ai-panel-${m.id}`}
            onClick={() => onChange(m.id)}
            position="relative"
            display="flex"
            alignItems="center"
            gap="8px"
            px={4}
            py="8px"
            borderRadius="11px"
            border="1px solid"
            borderColor={selected ? `${m.color}44` : "transparent"}
            bg={selected ? `${m.color}14` : "transparent"}
            color={selected ? m.color : "rgba(255,255,255,0.45)"}
            cursor="pointer"
            whileHover={{ color: selected ? m.color : "rgba(255,255,255,0.75)" }}
            transition={{ duration: 0.15 }}
            minH="40px"
          >
            <m.Icon size={15} strokeWidth={selected ? 2.2 : 1.8} />
            <Box textAlign="left">
              <Text fontSize="13px" fontWeight={selected ? 700 : 500} letterSpacing="-0.01em" lineHeight={1.2}>
                {m.label}
              </Text>
              <Text fontSize="10px" color={selected ? `${m.color}BB` : "rgba(255,255,255,0.28)"} lineHeight={1.3} mt="1px">
                {m.tagline}
              </Text>
            </Box>
          </MotionBox>
        );
      })}
    </Flex>
  );
}

function Fallback() {
  return (
    <Flex h="40vh" align="center" justify="center">
      <Spinner size="lg" color="accent.primary" thickness="3px" speed="0.7s" />
    </Flex>
  );
}

export default function AIPage() {
  const [params, setParams] = useSearchParams();
  const mode = params.get("mode") === "agent" ? "agent" : "quick";

  function switchMode(id) {
    setParams(id === "quick" ? {} : { mode: id }, { replace: true });
  }

  return (
    <Box>
      {/* Mode switcher sits above whichever page is rendered */}
      <Box px={{ base: 4, md: 6 }} pt={5}>
        <ModeSwitcher active={mode} onChange={switchMode} />
      </Box>

      {/* Render the existing page component — they own their own PageShell/header */}
      <Box
        id={`ai-panel-${mode}`}
        role="tabpanel"
        aria-label={mode === "quick" ? "Quick Ask" : "Autonomous Agents"}
      >
        <Suspense fallback={<Fallback />}>
          {mode === "quick" ? <AIAnalyzer /> : <AgentHub />}
        </Suspense>
      </Box>
    </Box>
  );
}
