/**
 * AgentRunner — shared streaming component for all agent modes.
 * Left: live reasoning trace (thought → tool_call → tool_result)
 * Right: streaming final answer in markdown
 */
import { useRef, useState } from "react";
import { Box, Flex, Text, Badge, Grid, Spinner, HStack } from "@chakra-ui/react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import GlassCard from "../../shared/ui/GlassCard";

const MotionBox = motion.create(Box);

const TOOL_LABELS = {
  get_equipment_list:     { label: "Equipment List",    icon: "📋" },
  compute_efficiency:     { label: "Efficiency Calc",   icon: "⚡" },
  detect_anomalies:       { label: "Anomaly Scan",      icon: "🔍" },
  get_timeseries_summary: { label: "Timeseries Stats",  icon: "📊" },
  compare_equipment:      { label: "Compare",           icon: "⚖️" },
  get_anomaly_history:    { label: "History",           icon: "📜" },
};

function ThinkingDots() {
  return (
    <Flex gap={1} align="center">
      {[0, 1, 2].map((i) => (
        <MotionBox
          key={i} w="4px" h="4px" borderRadius="full" bg="brand.500"
          animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </Flex>
  );
}

function TraceStep({ frame, index }) {
  const [expanded, setExpanded] = useState(false);

  if (frame.type === "tool_call") {
    const meta = TOOL_LABELS[frame.tool] ?? { label: frame.tool, icon: "🔧" };
    return (
      <MotionBox
        initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
        mb={2}
      >
        <Box
          as="button"
          w="full"
          textAlign="left"
          onClick={() => setExpanded(!expanded)}
          bg="rgba(0,196,244,0.06)"
          border="1px solid rgba(0,196,244,0.2)"
          borderRadius="10px"
          px={3} py={2}
          _hover={{ bg: "rgba(0,196,244,0.1)" }}
          transition="all 0.15s"
        >
          <Flex align="center" gap={2}>
            <Text fontSize="sm">{meta.icon}</Text>
            <Text fontSize="xs" fontWeight={600} color="brand.400">{meta.label}</Text>
            <Badge fontSize="9px" bg="rgba(0,196,244,0.12)" color="brand.500" borderRadius="4px" px={1}>
              step {frame.step}
            </Badge>
            <Text ml="auto" fontSize="10px" color="text.muted">{expanded ? "▲" : "▼"}</Text>
          </Flex>
          <AnimatePresence>
            {expanded && (
              <MotionBox
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                overflow="hidden"
              >
                <Box
                  mt={2} p={2} bg="rgba(0,0,0,0.3)" borderRadius="8px"
                  fontSize="10px" fontFamily="mono" color="text.muted"
                >
                  {JSON.stringify(frame.args, null, 2)}
                </Box>
              </MotionBox>
            )}
          </AnimatePresence>
        </Box>
      </MotionBox>
    );
  }

  if (frame.type === "tool_result") {
    const meta = TOOL_LABELS[frame.tool] ?? { label: frame.tool, icon: "✓" };
    return (
      <MotionBox
        initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
        mb={2}
      >
        <Box
          as="button" w="full" textAlign="left"
          onClick={() => setExpanded(!expanded)}
          bg="rgba(16,185,129,0.05)"
          border="1px solid rgba(16,185,129,0.15)"
          borderRadius="10px" px={3} py={2}
          _hover={{ bg: "rgba(16,185,129,0.08)" }}
          transition="all 0.15s"
        >
          <Flex align="center" gap={2}>
            <Text fontSize="sm">✓</Text>
            <Text fontSize="xs" fontWeight={500} color="green.400">{meta.label} result</Text>
            <Text ml="auto" fontSize="10px" color="text.muted">{expanded ? "▲" : "▼"}</Text>
          </Flex>
          <AnimatePresence>
            {expanded && (
              <MotionBox
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                overflow="hidden"
              >
                <Box
                  mt={2} p={2} bg="rgba(0,0,0,0.3)" borderRadius="8px"
                  fontSize="10px" fontFamily="mono" color="text.muted"
                  maxH="120px" overflowY="auto"
                >
                  {JSON.stringify(frame.result, null, 2)}
                </Box>
              </MotionBox>
            )}
          </AnimatePresence>
        </Box>
      </MotionBox>
    );
  }

  return null;
}

function MarkdownOutput({ content }) {
  return (
    <Box sx={{
      "h2,h3":  { fontWeight: 700, mt: 4, mb: 2, color: "text.primary" },
      h2:       { fontSize: "md", borderBottom: "1px solid", borderColor: "border.subtle", pb: 2 },
      h3:       { fontSize: "sm", color: "accent.cyan" },
      p:        { mb: 3, lineHeight: 1.8, color: "text.primary", fontSize: "sm" },
      "ul,ol":  { pl: 5, mb: 3 },
      li:       { mb: 1, color: "text.primary", fontSize: "sm" },
      strong:   { color: "white", fontWeight: 600 },
      code:     { bg: "rgba(0,196,244,0.08)", px: "5px", py: "2px", borderRadius: "5px", fontSize: "0.82em", color: "brand.300", fontFamily: "mono" },
      pre:      { bg: "rgba(0,0,0,0.4)", border: "1px solid", borderColor: "border.subtle", p: 4, borderRadius: "10px", overflowX: "auto", mb: 3, fontSize: "xs" },
      table:    { width: "100%", borderCollapse: "collapse", mb: 3, fontSize: "sm" },
      "th,td":  { border: "1px solid", borderColor: "border.subtle", px: 3, py: "6px" },
      th:       { bg: "bg.elevated", fontWeight: 600, fontSize: "xs", color: "text.muted" },
    }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </Box>
  );
}

export function useAgentStream() {
  const [trace,      setTrace]      = useState([]);
  const [output,     setOutput]     = useState("");
  const [running,    setRunning]    = useState(false);
  const [done,       setDone]       = useState(false);
  const [meta,       setMeta]       = useState(null);
  const [error,      setError]      = useState(null);
  const abortRef = useRef(null);

  async function start(mode, goal, context = null) {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setTrace([]);
    setOutput("");
    setRunning(true);
    setDone(false);
    setMeta(null);
    setError(null);

    try {
      const res = await fetch("/api/v1/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, goal, context }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `HTTP ${res.status}`);

      const reader = res.body.getReader();
      const dec    = new TextDecoder();
      let buf      = "";

      while (true) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop();

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const frame = JSON.parse(line.slice(6));
            if (frame.type === "tool_call" || frame.type === "tool_result") {
              setTrace((p) => [...p, frame]);
            } else if (frame.type === "token") {
              setOutput((p) => p + frame.content);
            } else if (frame.type === "done") {
              setMeta(frame);
              setDone(true);
            } else if (frame.type === "error") {
              setError(frame.detail);
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (e) {
      if (e.name !== "AbortError") setError(e.message);
    } finally {
      setRunning(false);
    }
  }

  function stop() {
    abortRef.current?.abort();
    setRunning(false);
  }

  return { trace, output, running, done, meta, error, start, stop };
}

export default function AgentRunner({ trace, output, running, done, meta, error, onStop }) {
  const bottomRef = useRef(null);

  if (!running && !output && !error) return null;

  return (
    <MotionBox
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      mt={5}
    >
      <Grid templateColumns={{ base: "minmax(0, 1fr)", lg: "minmax(0, 280px) minmax(0, 1fr)" }} gap={4} alignItems="flex-start" w="100%" minW={0}>

        {/* Left: trace */}
        <Box>
          <Text fontSize="9px" fontWeight={700} color="text.muted" textTransform="uppercase"
            letterSpacing="0.12em" mb={3}>
            Reasoning trace
          </Text>
          <Box maxH="500px" overflowY="auto" pr={1}>
            {trace.map((f, i) => <TraceStep key={i} frame={f} index={i} />)}
            {running && trace.length > 0 && (
              <Flex align="center" gap={2} px={3} py={2}>
                <ThinkingDots />
                <Text fontSize="xs" color="text.muted">thinking…</Text>
              </Flex>
            )}
            {running && trace.length === 0 && (
              <Flex align="center" gap={2} px={3} py={2}>
                <Spinner size="xs" color="brand.500" />
                <Text fontSize="xs" color="text.muted">starting…</Text>
              </Flex>
            )}
          </Box>
        </Box>

        {/* Right: output */}
        <GlassCard p={0} overflow="hidden" glow={done}>
          <Flex
            px={5} py={3} bg="bg.elevated"
            borderBottom="1px solid" borderColor="border.subtle"
            align="center" justify="space-between" flexWrap="wrap" gap={2}
          >
            <Flex align="center" gap={2}>
              {running
                ? <ThinkingDots />
                : <Box w={2} h={2} borderRadius="full" bg="green.400" boxShadow="0 0 6px rgba(16,185,129,0.6)" />}
              <Text fontSize="xs" fontWeight={600} color="text.muted">
                {running ? "Agent is working…" : "Investigation complete"}
              </Text>
            </Flex>
            <HStack spacing={2}>
              {meta && (
                <>
                  <Badge fontSize="9px" bg="rgba(0,196,244,0.1)" color="brand.400"
                    border="1px solid rgba(0,196,244,0.2)" borderRadius="6px" px={2}>
                    {meta.model}
                  </Badge>
                  <Badge fontSize="9px" bg="bg.surface" color="text.muted"
                    border="1px solid" borderColor="border.subtle" borderRadius="6px" px={2}>
                    {meta.steps} steps · {(meta.total_ms / 1000).toFixed(1)}s
                  </Badge>
                </>
              )}
              {running && (
                <Box as="button" onClick={onStop}
                  fontSize="xs" color="red.400" px={2} py={1} borderRadius="6px"
                  border="1px solid rgba(239,68,68,0.3)" bg="rgba(239,68,68,0.08)"
                  _hover={{ bg: "rgba(239,68,68,0.15)" }} transition="all 0.15s">
                  Stop
                </Box>
              )}
            </HStack>
          </Flex>

          <Box px={{ base: 4, md: 6 }} py={5} minH="100px">
            {error
              ? <Text color="red.400" fontSize="sm">{error}</Text>
              : output
                ? <MarkdownOutput content={output} />
                : running
                  ? <Flex align="center" gap={2}><ThinkingDots /><Text fontSize="sm" color="text.muted">Gathering data…</Text></Flex>
                  : null
            }
            <div ref={bottomRef} />
          </Box>
        </GlassCard>
      </Grid>
    </MotionBox>
  );
}
