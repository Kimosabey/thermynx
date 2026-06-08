import { useEffect, useState } from "react";
import { useToast, Box, Flex, Text, Badge } from "@chakra-ui/react";
import { motion } from "framer-motion";
import { Cpu, X } from "lucide-react";
import { apiFetch } from "../api/client";

/**
 * Live model roster — which Ollama model powers each task (from /api/v1/models),
 * with maker / country / size / purpose. Module-level cache → one fetch shared.
 */
let _cache = null;
let _inflight = null;

export async function fetchModels() {
  if (_cache) return _cache;
  if (!_inflight) {
    _inflight = apiFetch("/api/v1/models")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { _cache = d; _inflight = null; return d; })
      .catch(() => { _inflight = null; return null; });
  }
  return _inflight;
}

export function useModelRoster() {
  const [roster, setRoster] = useState(_cache);
  useEffect(() => {
    let on = true;
    fetchModels().then((d) => { if (on) setRoster(d); });
    return () => { on = false; };
  }, []);
  return roster;
}

const MotionFlex = motion.create(Flex);

/** Modern glass toast card: gradient icon tile · model · purpose · maker chip. */
function ModelToastCard({ prefix, t, onClose }) {
  return (
    <MotionFlex
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      align="center"
      gap={3}
      role="status"
      bg="bg.glass"
      sx={{ backdropFilter: "blur(12px)" }}
      borderRadius="14px"
      pl="14px"
      pr={3}
      py={3}
      border="1px solid"
      borderColor="border.subtle"
      boxShadow="0 12px 40px rgba(0,0,0,0.28), 0 0 0 1px rgba(6,182,212,0.10)"
      minW="300px"
      maxW="380px"
      position="relative"
      overflow="hidden"
    >
      {/* accent rail */}
      <Box position="absolute" left={0} top={0} bottom={0} w="3px"
        bgGradient="linear(180deg, #1F3FFE, #06B6D4)" />

      {/* gradient icon tile */}
      <Flex align="center" justify="center" w="36px" h="36px" borderRadius="10px"
        flexShrink={0} color="white"
        bgGradient="linear(135deg, #1F3FFE, #06B6D4)"
        boxShadow="0 4px 14px rgba(6,182,212,0.35)">
        <Cpu size={18} strokeWidth={2} />
      </Flex>

      <Box flex={1} minW={0}>
        <Flex align="center" gap={2} mb="2px">
          {prefix && (
            <Text fontSize="10px" fontWeight={700} letterSpacing="0.08em"
              textTransform="uppercase" color="accent.cyan" flexShrink={0}>
              {prefix}
            </Text>
          )}
          <Text fontSize="13px" fontWeight={800} color="text.primary" noOfLines={1}
            sx={{ fontVariantNumeric: "tabular-nums" }}>
            {t.model}
          </Text>
        </Flex>
        <Text fontSize="11px" color="text.muted" noOfLines={1} lineHeight="1.3">
          {t.purpose || t.label}
        </Text>
        {t.maker && t.maker !== "—" && (
          <Flex align="center" gap={1.5} mt="4px">
            <Badge fontSize="9px" px={1.5} py="1px" borderRadius="full"
              bg="bg.chip" color="text.secondary" border="1px solid" borderColor="border.subtle">
              {t.flag ? `${t.flag} ` : ""}{t.maker}
            </Badge>
            {t.params && t.params !== "—" && (
              <Text fontSize="10px" color="text.faint">{t.params}</Text>
            )}
            {t.kind && t.kind !== "—" && (
              <Text fontSize="10px" color="text.faint">· {t.kind}</Text>
            )}
          </Flex>
        )}
      </Box>

      <Box as="button" aria-label="Dismiss" onClick={onClose} alignSelf="flex-start"
        color="text.faint" _hover={{ color: "text.primary" }} flexShrink={0} p={1}>
        <X size={13} strokeWidth={2.5} />
      </Box>
    </MotionFlex>
  );
}

/**
 * useModelToast() → notify(taskKey, { prefix })
 * Fires a modern bottom-right toast naming the model + maker handling a task.
 * Task keys: text | tool | sql | planner | auditor | rag | vision | embed.
 * Deduped per task via a stable id so rapid re-runs don't stack.
 */
export function useModelToast() {
  const toast = useToast();
  return async (taskKey, { prefix } = {}) => {
    const roster = await fetchModels();
    const t = roster?.tasks?.[taskKey];
    if (!t) return;
    const id = `model-${taskKey}`;
    if (toast.isActive(id)) toast.close(id);
    toast({
      id,
      duration: 2800,
      position: "bottom-right",
      render: ({ onClose }) => <ModelToastCard prefix={prefix} t={t} onClose={onClose} />,
    });
  };
}
