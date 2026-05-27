/**
 * CitationFootnotes — turn `[source: foo §3]` markers into clickable footnotes,
 * and render a list of cited chunks below the answer.
 */
import { useMemo, useState } from "react";
import {
  Box, Flex, Text, Badge, Drawer, DrawerOverlay, DrawerContent,
  DrawerCloseButton, DrawerHeader, DrawerBody, useDisclosure,
  Collapse, Button,
} from "@chakra-ui/react";
import { BookOpen, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
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
      out.push(whole);
    }
    last = m.index + whole.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.length ? out : text;
}

/**
 * Build stable markdown component overrides for ReactMarkdown.
 * Returns an object suitable for the `components` prop.
 * Memoize the result in the parent with useMemo(() => buildCitationMarkdownComponents(chunks, onOpen), [chunks]).
 */
export function buildCitationMarkdownComponents(chunks, onMarkerClick) {
  const byKey      = new Map();
  const indexByKey = new Map();
  (chunks || []).forEach((c, i) => {
    const k = citationKey(c);
    byKey.set(k, c);
    indexByKey.set(k, i);
  });

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
}

/** Collapsible citations list rendered below the answer. */
export function CitationsList({ chunks, onOpen }) {
  const [expanded, setExpanded] = useState(false);
  if (!chunks?.length) return null;

  return (
    <GlassCard mt={4} p={0} overflow="hidden">
      {/* Header row — always visible, click to toggle */}
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
        <BookOpen size={14} strokeWidth={2} color="#1F3FFE" />
        <Eyebrow>Sources cited</Eyebrow>
        <Badge ml={1} fontSize="9px" bg="bg.chip" color="text.muted" border="1px solid" borderColor="border.subtle" borderRadius="6px" px={2}>
          {chunks.length}
        </Badge>
        <Box ml="auto" color="text.muted">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </Box>
      </Flex>

      <Collapse in={expanded} animateOpacity>
        <Box px={2} py={2}>
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
              onClick={() => onOpen(c)}
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
                <Flex align="center" gap={2} flexWrap="wrap">
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
              <ExternalLink size={12} color="#94a3b8" style={{ flexShrink: 0 }} />
            </Flex>
          ))}
        </Box>
      </Collapse>
    </GlassCard>
  );
}

/** Side drawer that shows the full chunk text. */
export function CitationDrawer({ chunk, isOpen, onClose }) {
  return (
    <Drawer isOpen={isOpen} onClose={onClose} placement="right" size="md">
      <DrawerOverlay />
      <DrawerContent bg="bg.surface">
        <DrawerCloseButton />
        <DrawerHeader>
          <Flex align="center" gap={2}>
            <BookOpen size={16} strokeWidth={2} color="#1F3FFE" />
            <Text fontSize="md" fontWeight={700} color="text.primary">
              {chunk?.source_id || "Citation"}
            </Text>
          </Flex>
          {chunk && (
            <Flex gap={2} mt={2}>
              <Badge fontSize="9px" bg="bg.chip" color="text.muted" border="1px solid" borderColor="border.subtle" borderRadius="6px" px={2}>
                chunk §{chunk.chunk_idx}
              </Badge>
              {chunk.score != null && (
                <Badge fontSize="9px" bg="bg.chip" color="text.muted" border="1px solid" borderColor="border.subtle" borderRadius="6px" px={2}>
                  relevance {chunk.score.toFixed(3)}
                </Badge>
              )}
              {chunk.equipment_tags && (
                <Badge fontSize="9px" bg="rgba(124,58,237,0.10)" color="#a78bfa" border="1px solid rgba(124,58,237,0.25)" borderRadius="6px" px={2}>
                  {chunk.equipment_tags}
                </Badge>
              )}
            </Flex>
          )}
        </DrawerHeader>
        <DrawerBody>
          <Text fontSize="sm" color="text.primary" lineHeight={1.7} whiteSpace="pre-wrap">
            {chunk?.snippet || "(no content)"}
          </Text>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}

/** @deprecated Use CitationsList + CitationDrawer + buildCitationMarkdownComponents directly. */
export function CitationsPanel({ chunks }) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [active, setActive] = useState(null);

  const markdownComponents = useMemo(
    () => buildCitationMarkdownComponents(chunks, (c) => { setActive(c); onOpen(); }),
    [chunks, onOpen]
  );

  return {
    markdownComponents,
    List:   () => <CitationsList chunks={chunks} onOpen={(c) => { setActive(c); onOpen(); }} />,
    Drawer: () => <CitationDrawer chunk={active} isOpen={isOpen} onClose={onClose} />,
  };
}
