import { useRef, useEffect, useState, useCallback } from "react";
import { Box, Flex, Text, Badge, Grid, Spinner, HStack, Button, useToast } from "@chakra-ui/react";
import { motion, AnimatePresence } from "framer-motion";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import {
  List, Zap, ScanSearch, BarChart2, Columns2,
  History, Wrench, CheckCircle2, ClipboardList, CheckCheck, X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import GlassCard from "../../shared/ui/GlassCard";
import Eyebrow from "../../shared/ui/Eyebrow";
import TraceStepDS from "../../shared/ui/TraceStep";
import { AuditPanel } from "../analyzer/AuditPanel";

// Thin wrapper that maps agent audit shape → AuditPanel (which expects analyzer shape)
function AgentAuditPanel({ audit }) {
  if (!audit) return null;
  return <AuditPanel audit={audit} verification={null} />;
}

const MotionBox = motion.create(Box);
const ICON_SIZE = 13;

const TOOL_LABELS = {
  get_equipment_list:     { label: "Equipment List",   Icon: List },
  compute_efficiency:     { label: "Efficiency Calc",  Icon: Zap },
  propose_work_order:     { label: "Work Order Draft", Icon: ClipboardList },
  detect_anomalies:       { label: "Anomaly Scan",     Icon: ScanSearch },
  get_timeseries_summary: { label: "Timeseries Stats", Icon: BarChart2 },
  compare_equipment:      { label: "Compare",          Icon: Columns2 },
  get_anomaly_history:    { label: "History",          Icon: History },
  retrieve_manual:        { label: "Manual Lookup",    Icon: List },
  search_knowledge_base:  { label: "Knowledge Search", Icon: ScanSearch },
};

// Strip citation artefacts that qwen2.5 emits but shouldn't appear in the UI.
// Handles: <citation>…</citation>, [^N], 【N†source】, bare [N] refs at end of sentences.
function stripCitations(text) {
  return text
    .replace(/<citation[^>]*>[\s\S]*?<\/citation>/gi, "")   // <citation> XML tags
    .replace(/【\d+†[^】]*】/g, "")                           // 【1†source】 style
    .replace(/\[\^[\w\d]+\]/g, "")                           // [^1] footnote refs
    .replace(/\s*\[\d+(?:,\s*\d+)*\](?=\s|[.,;!?]|$)/g, "") // inline [1] [1,2,3]
    .replace(/\n{3,}/g, "\n\n")                              // collapse triple+ blank lines
    .trim();
}

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

// ── Work-order proposal card ─────────────────────────────────────────────────
// Rendered when a tool_result frame has result.status === "proposed".
// The agent called propose_work_order — now a human must Approve or Dismiss.
function WorkOrderProposalCard({ proposal }) {
  const [state, setState] = useState("pending"); // pending | creating | created | dismissed | error
  const [wo, setWo]       = useState(null);
  const toast = useToast();

  const handleApprove = useCallback(async () => {
    setState("creating");
    try {
      const r = await fetch("/api/v1/work-orders", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:               proposal.title,
          description:         proposal.diagnosis,
          equipment_id:        proposal.equipment_id,
          priority:            proposal.priority || "normal",
          source:              "agent",
          diagnosis:           proposal.diagnosis,
          recommended_actions: proposal.recommended_actions,
        }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || `HTTP ${r.status}`);
      const d = await r.json();
      setWo(d);
      setState("created");
      toast({ title: `Work order created (#${d.id?.slice(0,8)})`, status: "success", duration: 3000, position: "bottom-right" });
    } catch (e) {
      setState("error");
      toast({ title: `Failed: ${e.message}`, status: "error", duration: 5000, position: "bottom-right" });
    }
  }, [proposal, toast]);

  return (
    <GlassCard mt={3} p={4} border="1px solid" borderColor="rgba(245,158,11,0.35)"
      bg="rgba(245,158,11,0.04)" borderRadius="12px">
      <Flex align="center" gap={2} mb={3}>
        <ClipboardList size={14} strokeWidth={2} color="#f59e0b" />
        <Eyebrow color="#f59e0b">Work order proposal — human review required</Eyebrow>
        {state === "created" && (
          <Badge ml="auto" fontSize="9px" bg="rgba(16,185,129,0.15)" color="#10b981"
            border="1px solid rgba(16,185,129,0.3)" borderRadius="6px" px={2}>
            Created
          </Badge>
        )}
        {state === "dismissed" && (
          <Badge ml="auto" fontSize="9px" bg="bg.chip" color="text.muted"
            border="1px solid" borderColor="border.subtle" borderRadius="6px" px={2}>
            Dismissed
          </Badge>
        )}
      </Flex>

      <Box mb={3}>
        <Text fontSize="sm" fontWeight={700} color="text.primary" mb={1}>{proposal.title}</Text>
        {proposal.equipment_name && (
          <Badge fontSize="9px" bg="bg.chip" color="text.muted"
            border="1px solid" borderColor="border.subtle" borderRadius="6px" px={2} mr={2}>
            {proposal.equipment_name}
          </Badge>
        )}
        <Badge fontSize="9px"
          bg={proposal.priority === "critical" ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.12)"}
          color={proposal.priority === "critical" ? "#ef4444" : "#f59e0b"}
          border="1px solid" borderColor="border.subtle" borderRadius="6px" px={2}>
          {proposal.priority || "normal"}
        </Badge>
      </Box>

      {proposal.diagnosis && (
        <Box mb={2}>
          <Text fontSize="10px" color="text.muted" fontWeight={600} mb={1} textTransform="uppercase" letterSpacing="0.08em">Diagnosis</Text>
          <Text fontSize="xs" color="text.primary">{proposal.diagnosis}</Text>
        </Box>
      )}
      {proposal.recommended_actions && (
        <Box mb={3}>
          <Text fontSize="10px" color="text.muted" fontWeight={600} mb={1} textTransform="uppercase" letterSpacing="0.08em">Recommended actions</Text>
          <Text fontSize="xs" color="text.primary">{proposal.recommended_actions}</Text>
        </Box>
      )}

      {state === "created" && wo && (
        <Text fontSize="10px" color="#10b981" mt={2}>
          Work order created successfully — view it on the Work Orders page.
        </Text>
      )}
      {state === "error" && (
        <Text fontSize="10px" color="#ef4444" mt={2}>
          Failed to create. Check the Work Orders page or try again.
        </Text>
      )}

      {state === "pending" && (
        <HStack mt={3} spacing={2}>
          <Button size="xs" colorScheme="yellow" variant="solid"
            leftIcon={<CheckCheck size={11} />}
            onClick={handleApprove} isLoading={state === "creating"}>
            Approve &amp; Create
          </Button>
          <Button size="xs" variant="ghost" leftIcon={<X size={11} />}
            onClick={() => setState("dismissed")}>
            Dismiss
          </Button>
        </HStack>
      )}
    </GlassCard>
  );
}


function TraceStep({ frame }) {
  const [expanded, setExpanded] = useState(false);

  if (frame.type === "tool_call") {
    const meta = TOOL_LABELS[frame.tool] ?? { label: frame.tool, Icon: Wrench };
    const MetaIcon = meta.Icon;
    return (
      <MotionBox initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }} mb={2}>
        <Box as="button" w="full" textAlign="left" onClick={() => setExpanded(!expanded)}
          bg="rgba(31,63,254,0.05)" border="1px solid rgba(31,63,254,0.15)"
          borderRadius="10px" px={3} py={2}
          _hover={{ bg: "rgba(31,63,254,0.09)", borderColor: "rgba(31,63,254,0.25)" }}
          transition="all 0.15s">
          <Flex align="center" gap={2}>
            <Box color="accent.primary" flexShrink={0}><MetaIcon size={ICON_SIZE} strokeWidth={2} /></Box>
            <Text fontSize="xs" fontWeight={600} color="accent.primary">{meta.label}</Text>
            <Badge fontSize="9px" bg="rgba(31,63,254,0.1)" color="accent.primary" borderRadius="4px" px={1}>
              step {frame.step}
            </Badge>
            <Text ml="auto" fontSize="10px" color="text.muted">{expanded ? "▲" : "▼"}</Text>
          </Flex>
          <AnimatePresence>
            {expanded && (
              <MotionBox initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} overflow="hidden">
                <Box mt={2} p={2} bg="bg.elevated" borderRadius="8px"
                  fontSize="10px" fontFamily="mono" color="text.muted">
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
    // Special rendering: work-order proposals get an Approve/Dismiss card
    const proposal = frame.result?.proposal;
    if (frame.tool === "propose_work_order" && frame.result?.status === "proposed" && proposal) {
      return (
        <MotionBox initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }} mb={2}>
          <WorkOrderProposalCard proposal={proposal} />
        </MotionBox>
      );
    }

    const meta = TOOL_LABELS[frame.tool] ?? { label: frame.tool, Icon: CheckCircle2 };
    return (
      <MotionBox initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }} mb={2}>
        <Box as="button" w="full" textAlign="left" onClick={() => setExpanded(!expanded)}
          bg="rgba(5,150,105,0.05)" border="1px solid rgba(5,150,105,0.15)"
          borderRadius="10px" px={3} py={2}
          _hover={{ bg: "rgba(5,150,105,0.09)" }} transition="all 0.15s">
          <Flex align="center" gap={2}>
            <Box color="status.good" flexShrink={0}><CheckCircle2 size={ICON_SIZE} strokeWidth={2} /></Box>
            <Text fontSize="xs" fontWeight={500} color="status.good">{meta.label} result</Text>
            <Text ml="auto" fontSize="10px" color="text.muted">{expanded ? "▲" : "▼"}</Text>
          </Flex>
          <AnimatePresence>
            {expanded && (
              <MotionBox initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} overflow="hidden">
                <Box mt={2} p={2} bg="bg.elevated" borderRadius="8px"
                  fontSize="10px" fontFamily="mono" color="text.muted"
                  maxH="120px" overflowY="auto">
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
  const cleaned = stripCitations(content);
  return (
    <Box overflow="hidden" maxW="100%" sx={{
      "h2,h3":  { fontWeight: 700, mt: 4, mb: 2, color: "text.primary" },
      h2:       { fontSize: "md", borderBottom: "1px solid", borderColor: "border.subtle", pb: 2 },
      h3:       { fontSize: "sm", color: "accent.primary" },
      p:        { mb: 3, lineHeight: 1.8, color: "text.primary", fontSize: "sm", wordBreak: "break-word" },
      "ul,ol":  { pl: 5, mb: 3 },
      li:       { mb: 1, color: "text.primary", fontSize: "sm", wordBreak: "break-word" },
      strong:   { color: "text.primary", fontWeight: 700 },
      code:     { bg: "rgba(31,63,254,0.06)", px: "5px", py: "2px", borderRadius: "5px", fontSize: "0.82em", color: "accent.primary", fontFamily: "mono", wordBreak: "break-all" },
      pre:      { bg: "bg.elevated", border: "1px solid", borderColor: "border.subtle", p: 4, borderRadius: "10px", overflowX: "auto", maxW: "100%", mb: 3, fontSize: "xs" },
      table:    { width: "100%", borderCollapse: "collapse", mb: 3, fontSize: "sm", display: "block", overflowX: "auto", maxW: "100%" },
      "th,td":  { border: "1px solid", borderColor: "border.subtle", px: 3, py: "6px" },
      th:       { bg: "bg.elevated", fontWeight: 600, fontSize: "xs", color: "text.muted" },
      img:      { maxW: "100%", height: "auto" },
      a:        { color: "accent.primary", wordBreak: "break-all" },
    }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{cleaned}</ReactMarkdown>
    </Box>
  );
}

export default function AgentRunner({ trace, output, running, done, meta, error, agentAudit }) {
  const [timelineRef] = useAutoAnimate({ duration: 220, easing: "ease-out" });
  const outputScrollRef = useRef(null);
  const bottomRef      = useRef(null);

  // Auto-scroll output pane to bottom as tokens stream in
  useEffect(() => {
    if (!outputScrollRef.current) return;
    const el = outputScrollRef.current;
    // Only auto-scroll if user is within 80px of the bottom (don't hijack manual scroll)
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [output, running]);

  if (!running && !output && !error) return null;

  const PANEL_H = { base: "none", lg: "min(64vh, 580px)" };

  return (
    <MotionBox
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      mt={5}
    >
      <Grid
        templateColumns={{
          base: "minmax(0, 1fr)",
          lg:   "minmax(300px, 0.4fr) minmax(0, 1fr)",
          xl:   "minmax(340px, 0.38fr) minmax(0, 1fr)",
        }}
        gap={{ base: 4, lg: 5 }}
        alignItems="stretch"
        w="100%"
        minW={0}
      >

        {/* ── Left: reasoning trace ── */}
        <Box minW={0}>
          <Eyebrow mb={3}>Reasoning Trace</Eyebrow>
          <GlassCard
            p={4}
            maxH={PANEL_H}
            overflowY="auto"
            role="log"
            aria-live="polite"
            aria-atomic="false"
            aria-relevant="additions"
            aria-label="Agent reasoning steps"
            sx={{
              "&::-webkit-scrollbar": { width: "4px" },
              "&::-webkit-scrollbar-thumb": { bg: "rgba(31,63,254,0.25)", borderRadius: "full" },
            }}
          >
            <Box position="relative" pl="24px" pr={1} ref={timelineRef}>
              {trace.length > 0 && (
                <Box
                  position="absolute" left="8px" top="16px" bottom="16px" w="2px"
                  borderRadius="full"
                  bg={`linear-gradient(180deg, #1F3FFE 0%, #1F3FFE ${running ? "67%" : "100%"}, rgba(199,201,255,0.3) ${running ? "67%" : "100%"}, rgba(199,201,255,0.3) 100%)`}
                />
              )}
              {trace.map((f, i) => (
                <TraceStepDS key={i} frame={f} status="done" />
              ))}
              {running && (
                <TraceStepDS
                  frame={{ type: "tool_call", tool: "__thinking__", runningLabel: "Thinking…", step: trace.length + 1 }}
                  status="running"
                />
              )}
              {!running && trace.length === 0 && (
                <Flex align="center" gap={2} px={3} py={2}>
                  <Spinner size="xs" color="brand.500" />
                  <Text fontSize="xs" color="text.muted">starting…</Text>
                </Flex>
              )}
            </Box>
          </GlassCard>
        </Box>

        {/* ── Right: streaming output ── */}
        <Box minW={0} display="flex" flexDirection="column">
          <Eyebrow mb={3} opacity={0}>Output</Eyebrow>{/* spacer to align with left Eyebrow */}
          <GlassCard
            p={0}
            glow={done}
            minW={0}
            display="flex"
            flexDirection="column"
            overflow="hidden"
            h={PANEL_H}
            minH={{ base: "320px", lg: "unset" }}
            flex={1}
          >
            {/* Header bar */}
            <Flex
              px={5} py={3}
              bg="bg.elevated"
              borderBottom="1px solid" borderColor="border.subtle"
              align="center" justify="space-between"
              flexWrap="wrap" gap={2}
              flexShrink={0}
            >
              <Flex align="center" gap={2}>
                {running
                  ? <ThinkingDots />
                  : <Box w={2} h={2} borderRadius="full" bg="green.400" boxShadow="0 0 6px rgba(16,185,129,0.6)" />}
                <Text fontSize="xs" fontWeight={600} color="text.muted">
                  {running ? "Agent is working…" : done ? "Complete" : "Output"}
                </Text>
              </Flex>
              <HStack spacing={2}>
                {meta && (
                  <>
                    <Box px={2} py="3px" borderRadius="6px" fontSize="9px" fontWeight={700}
                      bg="rgba(31,63,254,0.1)" color="accent.primary"
                      border="1px solid rgba(31,63,254,0.2)">
                      {meta.model}
                    </Box>
                    <Box px={2} py="3px" borderRadius="6px" fontSize="9px" fontWeight={600}
                      bg="bg.surface" color="text.muted"
                      border="1px solid" borderColor="border.subtle">
                      {meta.steps} steps · {(meta.total_ms / 1000).toFixed(1)}s
                    </Box>
                  </>
                )}
              </HStack>
            </Flex>

            {/* Scrollable content */}
            <Box
              ref={outputScrollRef}
              flex={1}
              overflowY="auto"
              px={{ base: 4, md: 6 }}
              py={5}
              role="log"
              aria-live="polite"
              aria-atomic="false"
              aria-relevant="additions text"
              aria-busy={running}
              aria-label="Agent final answer"
              sx={{
                "&::-webkit-scrollbar": { width: "4px" },
                "&::-webkit-scrollbar-thumb": { bg: "rgba(31,63,254,0.25)", borderRadius: "full" },
              }}
            >
              {error
                ? <Text role="alert" color="red.400" fontSize="sm">{error}</Text>
                : output
                  ? <MarkdownOutput content={output} />
                  : running
                    ? <Flex align="center" gap={3} pt={2}>
                        <ThinkingDots />
                        <Text fontSize="xs" color="text.muted">Waiting for first token…</Text>
                      </Flex>
                    : null
              }
              <Box ref={bottomRef} h="1px" />
            </Box>
            {/* Agent audit panel — parity with analyzer page */}
            {!running && agentAudit && (
              <Box px={{ base: 3, md: 4 }} pt={2} pb={3}>
                <AgentAuditPanel audit={agentAudit} />
              </Box>
            )}
          </GlassCard>
        </Box>

      </Grid>
    </MotionBox>
  );
}
