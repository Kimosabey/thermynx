/**
 * CitationFootnotes — turn `[source: foo §3]` markers into clickable footnotes,
 * and render a list of cited chunks below the answer.
 *
 * The analyzer backend emits a `citations` SSE frame with the chunks it gave
 * the LLM as context. The LLM is instructed (via prompt) to cite them as
 * `[source: <source_id> §<chunk_idx>]`. Here we:
 *
 *   1. expose `citationMarkdownComponents` to be spread into <ReactMarkdown />
 *      `components` prop — it replaces matching markers with footnote links.
 *   2. render <CitationsList /> below the answer with the chunk metadata.
 *   3. open a popover with the chunk snippet when a footnote is clicked.
 */
import { useMemo, useState } from "react";
import {
  Box, Flex, Text, Badge, Drawer, DrawerOverlay, DrawerContent,
  DrawerCloseButton, DrawerHeader, DrawerBody, useDisclosure,
} from "@chakra-ui/react";
import { BookOpen, ExternalLink } from "lucide-react";
import GlassCard from "../../shared/ui/GlassCard";
import Eyebrow from "../../shared/ui/Eyebrow";

// Citation marker formats we recognise inside model output:
//   [source: filename.pdf §3]
//   [source: filename.pdf §3] (relevance: 0.81)
//   [filename.pdf §3]
const MARKER_RE = /\[(?:source:\s*)?([\w.\-/]+)\s*§\s*(\d+)\]/gi;

function citationKey(c) {
  return `${c.source_id}|${c.chunk_idx}`;
}

function FootnoteMarker({ index, chunk, onClick }) {
  if (!chunk) return null;
  return (
    <Text
      as="button"
      onClick={() => onClick(chunk)}
      display="inline-flex"
      alignItems="center"
      verticalAlign="baseline"
      ml="2px"
      px="6px"
      h="18px"
      minW="18px"
      borderRadius="full"
      bg="accent.glow"
      color="accent.primary"
      fontSize="10px"
      fontWeight={700}
      lineHeight="18px"
      cursor="pointer"
      transition="all 0.15s"
      _hover={{ bg: "accent.glowHover", transform: "translateY(-1px)" }}
      sx={{ fontVariantNumeric: "tabular-nums" }}
      title={`${chunk.source_id} §${chunk.chunk_idx} — click for source`}
      aria-label={`Citation ${index + 1}`}
    >
      {index + 1}
    </Text>
  );
}

function renderWithFootnotes(text, byKey, indexByKey, onMarkerClick) {
  if (!text) return text;
  const out = [];
  let last = 0;
  let m;
  MARKER_RE.lastIndex = 0;
  while ((m = MARKER_RE.exec(text)) !== null) {
    const [whole, source, idx] = m;
    const key = `${source}|${idx}`;
    const chunk = byKey.get(key);
    if (m.index > last) out.push(text.slice(last, m.index));
    if (chunk) {
      const i = indexByKey.get(key);
      out.push(
        <FootnoteMarker key={`${m.index}-${key}`} index={i} chunk={chunk} onClick={onMarkerClick} />
      );
    } else {
      // Unknown citation — keep the original text so nothing is silently lost
      out.push(whole);
    }
    last = m.index + whole.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.length ? out : text;
}

/**
 * Build the markdown `components` overrides that swap citation markers
 * inside paragraphs / list items / table cells / strong / em.
 */
export function buildCitationMarkdownComponents(chunks) {
  const byKey      = new Map();
  const indexByKey = new Map();
  (chunks || []).forEach((c, i) => {
    const k = citationKey(c);
    byKey.set(k, c);
    indexByKey.set(k, i);
  });

  return ({ onMarkerClick }) => {
    const transformChildren = (children) => {
      if (children == null) return children;
      if (typeof children === "string") {
        return renderWithFootnotes(children, byKey, indexByKey, onMarkerClick);
      }
      if (Array.isArray(children)) {
        return children.flatMap((c, i) =>
          typeof c === "string"
            ? [<span key={i}>{renderWithFootnotes(c, byKey, indexByKey, onMarkerClick)}</span>]
            : [c]
        );
      }
      return children;
    };

    const wrap = (Tag) => ({ children, ...rest }) => (
      <Tag {...rest}>{transformChildren(children)}</Tag>
    );

    return {
      p:      wrap("p"),
      li:     wrap("li"),
      td:     wrap("td"),
      strong: wrap("strong"),
      em:     wrap("em"),
    };
  };
}

export function CitationsPanel({ chunks }) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [active, setActive] = useState(null);

  const componentsBuilder = useMemo(() => buildCitationMarkdownComponents(chunks), [chunks]);

  function open(chunk) {
    setActive(chunk);
    onOpen();
  }

  return {
    /** Spread onto <ReactMarkdown components={...} /> */
    markdownComponents: componentsBuilder({ onMarkerClick: open }),

    /** Render below the answer */
    List: () => {
      if (!chunks?.length) return null;
      return (
        <GlassCard mt={4} p={4}>
          <Flex align="center" gap={2} mb={3}>
            <BookOpen size={14} strokeWidth={2} color="#1F3FFE" />
            <Eyebrow>Sources cited</Eyebrow>
            <Badge ml="auto" fontSize="9px" bg="bg.chip" color="text.muted" border="1px solid" borderColor="border.subtle" borderRadius="6px" px={2}>
              {chunks.length}
            </Badge>
          </Flex>
          <Box>
            {chunks.map((c, i) => (
              <Flex
                key={citationKey(c)}
                as="button"
                w="full"
                textAlign="left"
                align="flex-start"
                gap={3}
                px={3}
                py="10px"
                borderRadius="8px"
                _hover={{ bg: "rgba(31,63,254,0.04)" }}
                onClick={() => open(c)}
                transition="background 0.15s"
              >
                <Box
                  w="22px" h="22px" borderRadius="full" flexShrink={0}
                  bg="accent.glow" color="accent.primary"
                  display="flex" alignItems="center" justifyContent="center"
                  fontSize="10px" fontWeight={700}
                  sx={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {i + 1}
                </Box>
                <Box flex="1" minW={0}>
                  <Flex align="center" gap={2}>
                    <Text fontSize="xs" fontWeight={700} color="text.primary" noOfLines={1}>
                      {c.source_id} <Text as="span" color="text.muted">§{c.chunk_idx}</Text>
                    </Text>
                    {c.score != null && (
                      <Badge fontSize="9px" bg="bg.chip" color="text.muted" border="1px solid" borderColor="border.subtle" borderRadius="6px" px={2}>
                        rel {c.score.toFixed(2)}
                      </Badge>
                    )}
                    {c.equipment_tags && (
                      <Badge fontSize="9px" bg="rgba(124,58,237,0.10)" color="#a78bfa" border="1px solid rgba(124,58,237,0.25)" borderRadius="6px" px={2}>
                        {c.equipment_tags}
                      </Badge>
                    )}
                  </Flex>
                  <Text fontSize="11px" color="text.muted" mt="2px" noOfLines={2} lineHeight={1.45}>
                    {c.snippet || ""}
                  </Text>
                </Box>
                <ExternalLink size={12} color="#94a3b8" />
              </Flex>
            ))}
          </Box>
        </GlassCard>
      );
    },

    /** Drawer rendered at page level */
    Drawer: () => (
      <Drawer isOpen={isOpen} onClose={onClose} placement="right" size="md">
        <DrawerOverlay />
        <DrawerContent bg="bg.surface">
          <DrawerCloseButton />
          <DrawerHeader>
            <Flex align="center" gap={2}>
              <BookOpen size={16} strokeWidth={2} color="#1F3FFE" />
              <Text fontSize="md" fontWeight={700} color="text.primary">
                {active?.source_id || "Citation"}
              </Text>
            </Flex>
            {active && (
              <Flex gap={2} mt={2}>
                <Badge fontSize="9px" bg="bg.chip" color="text.muted" border="1px solid" borderColor="border.subtle" borderRadius="6px" px={2}>
                  chunk §{active.chunk_idx}
                </Badge>
                {active.score != null && (
                  <Badge fontSize="9px" bg="bg.chip" color="text.muted" border="1px solid" borderColor="border.subtle" borderRadius="6px" px={2}>
                    relevance {active.score.toFixed(3)}
                  </Badge>
                )}
                {active.equipment_tags && (
                  <Badge fontSize="9px" bg="rgba(124,58,237,0.10)" color="#a78bfa" border="1px solid rgba(124,58,237,0.25)" borderRadius="6px" px={2}>
                    {active.equipment_tags}
                  </Badge>
                )}
              </Flex>
            )}
          </DrawerHeader>
          <DrawerBody>
            <Text fontSize="sm" color="text.primary" lineHeight={1.7} whiteSpace="pre-wrap">
              {active?.snippet || "(no content)"}
            </Text>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    ),
  };
}
