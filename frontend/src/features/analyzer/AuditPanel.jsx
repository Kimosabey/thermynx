/**
 * AuditPanel — renders the two post-generation checks under the answer:
 *
 *   1. `audit`        — regex-based postcheck (numeric / equipment / citation flags)
 *                       emitted as SSE `audit` frame by services/postcheck.py
 *   2. `verification` — LLM self-critique pass (services/critique.py) emitted
 *                       as SSE `verification` frame
 *
 * Both are collapsible. Default: closed when clean, open when flags present.
 */
import { useState } from "react";
import {
  Box, Flex, Text, Badge, Collapse, HStack,
} from "@chakra-ui/react";
import { ShieldCheck, ShieldAlert, ChevronDown, ChevronUp } from "lucide-react";
import GlassCard from "../../shared/ui/GlassCard";
import Eyebrow from "../../shared/ui/Eyebrow";

const TYPE_LABEL = {
  number:    "numeric",
  equipment: "equipment",
  citation:  "citation",
};

function FlagRow({ icon: Icon, label, items }) {
  if (!items || items.length === 0) return null;
  return (
    <Box>
      <HStack mb={1.5} spacing={2}>
        <Icon size={11} color="#ef4444" />
        <Text fontSize="10px" fontWeight={700} color="text.primary" textTransform="uppercase" letterSpacing="0.08em">
          {label} — {items.length}
        </Text>
      </HStack>
      <Box pl={4}>
        {items.map((f, i) => (
          <Text
            key={i}
            fontSize="11px"
            color="text.muted"
            lineHeight={1.55}
            mb={0.5}
          >
            <Text as="span" color="text.primary" fontWeight={600}>
              {f.claim || f.mention || `${f.source} §${f.chunk}`}
            </Text>
            {" — "}
            <Text as="span">{f.reason}</Text>
          </Text>
        ))}
      </Box>
    </Box>
  );
}

export function AuditPanel({ audit, verification }) {
  // Default open if either has flags
  const auditFlags = audit?.flag_count || 0;
  const verdictOverall = verification?.overall;
  const verdictDirty = verdictOverall && verdictOverall !== "ok";
  const isDirty = auditFlags > 0 || verdictDirty;

  const [expanded, setExpanded] = useState(isDirty);

  if (!audit && !verification) return null;
  // Skip "skipped" verifications with nothing else to show
  if (!audit && verification?.status === "skipped") return null;

  const tone = isDirty ? "warn" : "ok";
  const Icon = isDirty ? ShieldAlert : ShieldCheck;
  const iconColor = isDirty ? "#ef4444" : "#10b981";

  return (
    <GlassCard mt={3} p={0} overflow="hidden">
      <Flex
        as="button"
        w="full"
        align="center"
        gap={2}
        px={4}
        py={3}
        onClick={() => setExpanded((x) => !x)}
        _hover={{ bg: "rgba(31,63,254,0.04)" }}
        transition="background 0.15s"
        borderBottom={expanded ? "1px solid" : "none"}
        borderColor="border.subtle"
      >
        <Icon size={14} strokeWidth={2} color={iconColor} />
        <Eyebrow>{isDirty ? "Fact-check flagged" : "Fact-check clean"}</Eyebrow>

        {auditFlags > 0 && (
          <Badge
            ml={1}
            fontSize="9px"
            bg="rgba(239,68,68,0.12)"
            color="#ef4444"
            border="1px solid rgba(239,68,68,0.3)"
            borderRadius="6px"
            px={2}
          >
            {auditFlags} regex flag{auditFlags === 1 ? "" : "s"}
          </Badge>
        )}
        {verdictOverall && verdictOverall !== "ok" && (
          <Badge
            ml={1}
            fontSize="9px"
            bg={verdictOverall === "fail" ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.12)"}
            color={verdictOverall === "fail" ? "#ef4444" : "#f59e0b"}
            border="1px solid"
            borderColor={verdictOverall === "fail" ? "rgba(239,68,68,0.3)" : "rgba(245,158,11,0.3)"}
            borderRadius="6px"
            px={2}
          >
            critique: {verdictOverall}
          </Badge>
        )}
        {!isDirty && (
          <Badge
            ml={1}
            fontSize="9px"
            bg="rgba(16,185,129,0.10)"
            color="#10b981"
            border="1px solid rgba(16,185,129,0.3)"
            borderRadius="6px"
            px={2}
          >
            all good
          </Badge>
        )}
        <Box ml="auto" color="text.muted">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </Box>
      </Flex>

      <Collapse in={expanded} animateOpacity>
        <Box px={4} py={3}>
          {/* Regex postcheck flags */}
          {audit && audit.flag_count > 0 && (
            <Box mb={verification ? 4 : 0}>
              <Text fontSize="10px" color="text.muted" mb={2}>
                Regex-based audit (no LLM) — values that don't appear in the source data.
              </Text>
              <FlagRow icon={ShieldAlert} label="Numeric claims" items={audit.numeric_flags} />
              {audit.equipment_flags?.length > 0 && (
                <Box mt={3}>
                  <FlagRow icon={ShieldAlert} label="Equipment names" items={audit.equipment_flags} />
                </Box>
              )}
              {audit.citation_flags?.length > 0 && (
                <Box mt={3}>
                  <FlagRow icon={ShieldAlert} label="Citations" items={audit.citation_flags} />
                </Box>
              )}
            </Box>
          )}

          {audit && audit.flag_count === 0 && (
            <Text fontSize="11px" color="text.muted">
              Regex audit found no orphan numbers, fabricated equipment names, or unmatched citations.
            </Text>
          )}

          {/* Uncited chunks — informational, not a flag */}
          {audit?.uncited_chunks?.length > 0 && (
            <Box mt={3}>
              <Text fontSize="10px" color="text.muted" fontWeight={600} mb={1}
                textTransform="uppercase" letterSpacing="0.08em">
                Uncited sources ({audit.uncited_chunks.length})
              </Text>
              <Text fontSize="10px" color="text.muted" mb={2}>
                These documents were retrieved but not referenced in the answer.
              </Text>
              {audit.uncited_chunks.slice(0, 4).map((c, i) => (
                <Text key={i} fontSize="11px" color="text.muted" mb="2px">
                  • {c.source_id} §{c.chunk_idx}
                  {c.score ? <Text as="span" color="text.muted"> (rel {parseFloat(c.score).toFixed(2)})</Text> : null}
                </Text>
              ))}
            </Box>
          )}

          {/* LLM critique */}
          {verification && verification.status === "ok" && (
            <Box mt={audit?.flag_count > 0 ? 4 : 0}>
              <Text fontSize="10px" color="text.muted" mb={2}>
                LLM critique pass{verification.model ? ` (${verification.model})` : ""} — semantic claim-vs-data check.
              </Text>
              {verification.summary && (
                <Text fontSize="11px" color="text.primary" mb={2} fontStyle="italic">
                  "{verification.summary}"
                </Text>
              )}
              {verification.suspicious?.length > 0 && (
                <Box mb={2}>
                  <Text fontSize="10px" color="#ef4444" fontWeight={700} mb={1}>
                    SUSPICIOUS ({verification.suspicious.length})
                  </Text>
                  {verification.suspicious.slice(0, 5).map((s, i) => (
                    <Text key={i} fontSize="11px" color="text.muted" mb={0.5} pl={2}>
                      • {s.claim} {s.expected ? `(expected ${s.expected})` : ""}
                    </Text>
                  ))}
                </Box>
              )}
              {verification.unverified?.length > 0 && (
                <Box mb={2}>
                  <Text fontSize="10px" color="#f59e0b" fontWeight={700} mb={1}>
                    UNVERIFIED ({verification.unverified.length})
                  </Text>
                  {verification.unverified.slice(0, 5).map((u, i) => (
                    <Text key={i} fontSize="11px" color="text.muted" mb={0.5} pl={2}>
                      • {u.claim}
                    </Text>
                  ))}
                </Box>
              )}
              {verification.verified?.length > 0 && verification.suspicious?.length === 0 && (
                <Text fontSize="11px" color="#10b981">
                  ✓ {verification.verified.length} claim{verification.verified.length === 1 ? "" : "s"} verified against source data
                </Text>
              )}
            </Box>
          )}

          {verification && verification.status === "skipped" && audit?.flag_count > 0 && (
            <Text fontSize="10px" color="text.muted" mt={3} fontStyle="italic">
              LLM critique skipped: {verification.reason || "auditor unavailable"}
            </Text>
          )}
        </Box>
      </Collapse>
    </GlassCard>
  );
}
