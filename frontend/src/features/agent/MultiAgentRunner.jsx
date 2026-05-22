/**
 * MultiAgentRunner — render the orchestrator's plan + per-specialist sub-streams + synthesis.
 *
 * Layout:
 *   1. Plan card (rationale + ordered list of subtasks)
 *   2. Per-specialist accordion (status chip + live token stream + collapsible tool trace)
 *   3. Synthesis card (final markdown answer)
 */
import { useState } from "react";
import {
  Box, Flex, Text, Badge, Grid, Spinner, Collapse, HStack,
} from "@chakra-ui/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Network, ScanSearch, Zap, Microscope, Wrench, ChevronDown, ChevronUp,
  CheckCircle2, AlertCircle, Sparkles,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import GlassCard from "../../shared/ui/GlassCard";
import Eyebrow from "../../shared/ui/Eyebrow";

const MotionBox = motion.create(Box);

const SPECIALIST_META = {
  investigator: { Icon: ScanSearch, color: "#1F3FFE", label: "Investigator" },
  optimizer:    { Icon: Zap,        color: "#10b981", label: "Optimizer" },
  root_cause:   { Icon: Microscope, color: "#f59e0b", label: "Root Cause" },
  maintenance:  { Icon: Wrench,     color: "#f97316", label: "Maintenance" },
};

const STATUS_META = {
  pending: { color: "text.muted",  bg: "bg.chip",                     label: "queued" },
  running: { color: "#0ea5e9",     bg: "rgba(14,165,233,0.12)",       label: "running" },
  done:    { color: "#10b981",     bg: "rgba(16,185,129,0.12)",       label: "done" },
  error:   { color: "#ef4444",     bg: "rgba(239,68,68,0.12)",        label: "error" },
};

function MarkdownBlock({ content }) {
  return (
    <Box sx={{
      "h2,h3": { fontWeight: 700, mt: 3, mb: 2, color: "text.primary" },
      h2:      { fontSize: "md", borderBottom: "1px solid", borderColor: "border.subtle", pb: 2 },
      h3:      { fontSize: "sm", color: "accent.primary" },
      p:       { mb: 2, lineHeight: 1.7, color: "text.primary", fontSize: "sm" },
      "ul,ol": { pl: 5, mb: 2 },
      li:      { mb: "2px", color: "text.primary", fontSize: "sm" },
      strong:  { color: "text.primary", fontWeight: 700 },
      code:    { bg: "bg.chip", px: "5px", py: "1px", borderRadius: "5px", fontSize: "0.82em", color: "accent.primary", fontFamily: "mono" },
    }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content || ""}</ReactMarkdown>
    </Box>
  );
}

function DelegationCard({ d }) {
  const [open, setOpen] = useState(d.status === "running");
  const meta   = SPECIALIST_META[d.specialist] || { Icon: Network, color: "#64748b", label: d.specialist };
  const status = STATUS_META[d.status] || STATUS_META.pending;
  const SIcon  = meta.Icon;

  return (
    <MotionBox initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <GlassCard p={0} overflow="hidden">
        <Flex
          as="button"
          w="full"
          textAlign="left"
          align="center" gap={3}
          px={4} py={3}
          onClick={() => setOpen(o => !o)}
          _hover={{ bg: "rgba(31,63,254,0.04)" }}
          transition="background 0.15s"
          borderBottom={open ? "1px solid" : "none"}
          borderColor="border.subtle"
        >
          <Box
            w="32px" h="32px" borderRadius="9px" flexShrink={0}
            display="flex" alignItems="center" justifyContent="center"
            bg={meta.color + "22"} border="1px solid" borderColor={meta.color + "55"} color={meta.color}
          >
            <SIcon size={15} strokeWidth={2} />
          </Box>
          <Box flex="1" minW={0}>
            <Flex align="center" gap={2}>
              <Text fontSize="sm" fontWeight={700} color="text.primary">{meta.label}</Text>
              <Badge fontSize="9px" px={2} py="2px" borderRadius="6px"
                bg={status.bg} color={status.color} border="1px solid" borderColor={status.color + "44"}
                textTransform="uppercase" letterSpacing="0.06em"
              >
                {d.status === "running" && <Spinner size="xs" mr="6px" />}
                {status.label}
              </Badge>
              {d.steps > 0 && (
                <Badge fontSize="9px" bg="bg.chip" color="text.muted" border="1px solid" borderColor="border.subtle" borderRadius="6px" px={2}>
                  {d.steps} step{d.steps === 1 ? "" : "s"}
                </Badge>
              )}
            </Flex>
            <Text fontSize="xs" color="text.muted" mt="2px" noOfLines={2}>{d.goal}</Text>
          </Box>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </Flex>

        <Collapse in={open} animateOpacity>
          <Box px={4} py={3}>
            {d.trace.length > 0 && (
              <Box mb={3}>
                <Eyebrow mb={2}>Tool calls</Eyebrow>
                {d.trace.map((f, i) => (
                  <Flex key={i} align="center" gap={2} py="3px" fontSize="11px">
                    {f.type === "tool_call"
                      ? <Box w="6px" h="6px" borderRadius="full" bg="accent.primary" />
                      : <CheckCircle2 size={11} strokeWidth={2.4} color="#10b981" />
                    }
                    <Text fontFamily="mono" color="text.muted">{f.tool}</Text>
                    {f.type === "tool_call" && f.args && Object.keys(f.args).length > 0 && (
                      <Text fontFamily="mono" color="text.faint" noOfLines={1}>
                        ({Object.entries(f.args).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(", ")})
                      </Text>
                    )}
                  </Flex>
                ))}
              </Box>
            )}
            {d.output && (
              <Box>
                <Eyebrow mb={2}>Specialist findings</Eyebrow>
                <MarkdownBlock content={d.output} />
              </Box>
            )}
            {d.error && (
              <Flex align="center" gap={2} mt={2}>
                <AlertCircle size={14} color="#ef4444" />
                <Text fontSize="xs" color="status.bad">{d.error}</Text>
              </Flex>
            )}
            {d.status === "pending" && (
              <Text fontSize="xs" color="text.muted">Waiting for previous specialist…</Text>
            )}
          </Box>
        </Collapse>
      </GlassCard>
    </MotionBox>
  );
}

export default function MultiAgentRunner({ plan, delegations, synthesis, running, done, meta, error }) {
  if (!plan && !running && !delegations.length && !error) return null;

  return (
    <MotionBox
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
      mt={5}
    >
      {/* Plan card */}
      {plan && (
        <GlassCard p={5} mb={4}>
          <Flex align="center" gap={2} mb={3}>
            <Network size={16} strokeWidth={2} color="#1F3FFE" />
            <Eyebrow>Orchestrator plan</Eyebrow>
            <Badge ml="auto" fontSize="9px" bg="bg.chip" color="text.muted" border="1px solid" borderColor="border.subtle" borderRadius="6px" px={2}>
              {plan.subtasks.length} subtask{plan.subtasks.length === 1 ? "" : "s"}
            </Badge>
          </Flex>
          {plan.rationale && (
            <Text fontSize="sm" color="text.primary" mb={3}>{plan.rationale}</Text>
          )}
          <Flex direction="column" gap={2}>
            {plan.subtasks.map((s, i) => {
              const m = SPECIALIST_META[s.specialist] || { color: "#64748b", label: s.specialist };
              return (
                <Flex key={i} align="center" gap={3} px={3} py={2}
                  bg="bg.chip" borderRadius="8px" border="1px solid" borderColor="border.subtle"
                >
                  <Text fontSize="11px" fontWeight={700} color="text.muted" w="18px" sx={{ fontVariantNumeric: "tabular-nums" }}>{i + 1}</Text>
                  <Badge fontSize="9px" px={2} py="2px" borderRadius="6px"
                    bg={m.color + "22"} color={m.color} border="1px solid" borderColor={m.color + "44"}
                    textTransform="uppercase" letterSpacing="0.06em"
                  >
                    {m.label}
                  </Badge>
                  <Text fontSize="xs" color="text.primary" flex="1">{s.goal}</Text>
                </Flex>
              );
            })}
          </Flex>
        </GlassCard>
      )}

      {/* Per-specialist accordion */}
      {delegations.length > 0 && (
        <Box mb={4}>
          <Eyebrow mb={3}>Specialists at work</Eyebrow>
          <Flex direction="column" gap={3}>
            {delegations.map(d => <DelegationCard key={d.idx} d={d} />)}
          </Flex>
        </Box>
      )}

      {/* Synthesis */}
      {(synthesis || (running && delegations.every(d => d.status === "done") && delegations.length > 0)) && (
        <GlassCard p={0} overflow="hidden" glow={done}>
          <Flex
            px={5} py={3} bg="bg.elevated"
            borderBottom="1px solid" borderColor="border.subtle"
            align="center" justify="space-between"
          >
            <Flex align="center" gap={2}>
              <Sparkles size={14} strokeWidth={2} color="#1F3FFE" />
              <Text fontSize="xs" fontWeight={700} color="text.primary">Synthesised Answer</Text>
            </Flex>
            <HStack spacing={2}>
              {meta && (
                <>
                  <Box px={2} py="3px" borderRadius="6px" fontSize="9px" fontWeight={700}
                    bg="accent.glow" color="accent.primary" border="1px solid" borderColor="border.brand">
                    {meta.model}
                  </Box>
                  <Box px={2} py="3px" borderRadius="6px" fontSize="9px" fontWeight={600}
                    bg="bg.chip" color="text.muted" border="1px solid" borderColor="border.subtle">
                    {meta.subtasks} subtasks · {(meta.total_ms / 1000).toFixed(1)}s
                  </Box>
                </>
              )}
            </HStack>
          </Flex>
          <Box px={{ base: 4, md: 6 }} py={5} minH="100px">
            {error
              ? <Text role="alert" color="red.400" fontSize="sm">{error}</Text>
              : synthesis
                ? <MarkdownBlock content={synthesis} />
                : <Flex align="center" gap={2}><Spinner size="xs" /><Text fontSize="xs" color="text.muted">Composing final answer…</Text></Flex>
            }
          </Box>
        </GlassCard>
      )}
    </MotionBox>
  );
}
