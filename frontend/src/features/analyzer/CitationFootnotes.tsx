/**
 * CitationFootnotes — turn `[source: foo §3]` markers into clickable footnotes,
 * and render a list of cited chunks below the answer.
 */
import { useMemo, useState, type ReactNode, type CSSProperties } from "react";
import type { Components } from "react-markdown";
import { BookOpen, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import GlassCard from "@/shared/ui/GlassCard";
import Eyebrow from "@/shared/ui/Eyebrow";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

/** One retrieved RAG chunk surfaced as a citation. */
export interface CitationChunk {
  source_id: string;
  chunk_idx: number;
  score?: number | null;
  snippet?: string;
  equipment_tags?: string;
  [key: string]: unknown;
}

// Citation marker formats we recognise inside model output:
//   [source: filename.pdf §3]
//   [source: filename.pdf §3] (relevance: 0.81)
//   [filename.pdf §3]
const MARKER_RE = /\[(?:source:\s*)?([\w.\-/]+)\s*§\s*(\d+)\]/gi;

function citationKey(c: CitationChunk): string {
  return `${c.source_id}|${c.chunk_idx}`;
}

function FootnoteMarker({
  index,
  chunk,
  onClick,
}: {
  index: number;
  chunk: CitationChunk | undefined;
  onClick: (chunk: CitationChunk) => void;
}) {
  if (!chunk) return null;
  return (
    <button
      type="button"
      onClick={() => onClick(chunk)}
      className="ml-[2px] inline-flex h-[18px] min-w-[18px] cursor-pointer items-center rounded-full bg-[var(--glow)] px-[6px] align-baseline text-[10px] font-bold leading-[18px] text-brand tabular-nums transition-all hover:-translate-y-px hover:bg-[var(--glow-hover)]"
      title={`${chunk.source_id} §${chunk.chunk_idx} — click for source`}
      aria-label={`Citation ${index + 1}`}
    >
      {index + 1}
    </button>
  );
}

function renderWithFootnotes(
  text: string,
  byKey: Map<string, CitationChunk>,
  indexByKey: Map<string, number>,
  onMarkerClick: (chunk: CitationChunk) => void,
): ReactNode {
  if (!text) return text;
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  MARKER_RE.lastIndex = 0;
  while ((m = MARKER_RE.exec(text)) !== null) {
    const [whole, source, idx] = m;
    const key = `${source}|${idx}`;
    const chunk = byKey.get(key);
    if (m.index > last) out.push(text.slice(last, m.index));
    if (chunk) {
      const i = indexByKey.get(key) ?? 0;
      out.push(
        <FootnoteMarker key={`${m.index}-${key}`} index={i} chunk={chunk} onClick={onMarkerClick} />,
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
export function buildCitationMarkdownComponents(
  chunks: CitationChunk[] | null | undefined,
  onMarkerClick: (chunk: CitationChunk) => void,
): Components {
  const byKey = new Map<string, CitationChunk>();
  const indexByKey = new Map<string, number>();
  (chunks || []).forEach((c, i) => {
    const k = citationKey(c);
    byKey.set(k, c);
    indexByKey.set(k, i);
  });

  const transformChildren = (children: ReactNode): ReactNode => {
    if (children == null) return children;
    if (typeof children === "string") {
      return renderWithFootnotes(children, byKey, indexByKey, onMarkerClick);
    }
    if (Array.isArray(children)) {
      return children.flatMap((c, i) =>
        typeof c === "string"
          ? [<span key={i}>{renderWithFootnotes(c, byKey, indexByKey, onMarkerClick)}</span>]
          : [c],
      );
    }
    return children;
  };

  const wrap =
    (Tag: keyof React.JSX.IntrinsicElements) =>
    ({ children, node, ...rest }: { children?: ReactNode; node?: unknown }) => {
      void node; // `node` is injected by react-markdown; not forwarded to the DOM
      return <Tag {...rest}>{transformChildren(children)}</Tag>;
    };

  return {
    p: wrap("p"),
    li: wrap("li"),
    td: wrap("td"),
    strong: wrap("strong"),
    em: wrap("em"),
  };
}

/** Collapsible citations list rendered below the answer. */
export function CitationsList({
  chunks,
  onOpen,
}: {
  chunks: CitationChunk[] | null | undefined;
  onOpen: (chunk: CitationChunk) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!chunks?.length) return null;

  return (
    <GlassCard hover={false} className="mt-4 overflow-hidden p-0">
      {/* Header row — always visible, click to toggle */}
      <button
        type="button"
        onClick={() => setExpanded((x) => !x)}
        className={`flex w-full items-center gap-2 px-4 py-3 text-left transition-[background] duration-150 hover:bg-[rgba(31,63,254,0.04)] ${
          expanded ? "border-b border-border-subtle" : ""
        }`}
      >
        <BookOpen size={14} strokeWidth={2} color="#1F3FFE" />
        <Eyebrow>Sources cited</Eyebrow>
        <Badge className="ml-1 rounded-[6px] border border-border-subtle bg-chip px-2 text-[9px] text-ink-muted">
          {chunks.length}
        </Badge>
        <span className="ml-auto text-ink-muted">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-2 py-2">
              {chunks.map((c, i) => (
                <button
                  type="button"
                  key={citationKey(c)}
                  onClick={() => onOpen(c)}
                  className="flex w-full items-start gap-3 rounded-[8px] px-3 py-[10px] text-left transition-[background] duration-150 hover:bg-[rgba(31,63,254,0.04)]"
                >
                  <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-[var(--glow)] text-[10px] font-bold text-brand tabular-nums">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="line-clamp-1 text-xs font-bold text-ink">
                        {c.source_id} <span className="text-ink-muted">§{c.chunk_idx}</span>
                      </span>
                      {c.score != null && (
                        <Badge className="rounded-[6px] border border-border-subtle bg-chip px-2 text-[9px] text-ink-muted">
                          rel {c.score.toFixed(2)}
                        </Badge>
                      )}
                      {c.equipment_tags && (
                        <Badge
                          className="rounded-[6px] border px-2 text-[9px]"
                          style={
                            {
                              background: "rgba(124,58,237,0.10)",
                              color: "#a78bfa",
                              borderColor: "rgba(124,58,237,0.25)",
                            } as CSSProperties
                          }
                        >
                          {c.equipment_tags}
                        </Badge>
                      )}
                    </span>
                    <span className="mt-[2px] line-clamp-2 block text-[11px] leading-[1.45] text-ink-muted">
                      {c.snippet || ""}
                    </span>
                  </span>
                  <ExternalLink size={12} color="#94a3b8" style={{ flexShrink: 0 }} />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}

/** Side drawer that shows the full chunk text. */
export function CitationDrawer({
  chunk,
  isOpen,
  onClose,
}: {
  chunk: CitationChunk | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full bg-surface sm:max-w-md">
        <SheetHeader>
          <SheetTitle asChild>
            <div className="flex items-center gap-2">
              <BookOpen size={16} strokeWidth={2} color="#1F3FFE" />
              <span className="text-base font-bold text-ink">{chunk?.source_id || "Citation"}</span>
            </div>
          </SheetTitle>
          {chunk && (
            <div className="mt-2 flex gap-2">
              <Badge className="rounded-[6px] border border-border-subtle bg-chip px-2 text-[9px] text-ink-muted">
                chunk §{chunk.chunk_idx}
              </Badge>
              {chunk.score != null && (
                <Badge className="rounded-[6px] border border-border-subtle bg-chip px-2 text-[9px] text-ink-muted">
                  relevance {chunk.score.toFixed(3)}
                </Badge>
              )}
              {chunk.equipment_tags && (
                <Badge
                  className="rounded-[6px] border px-2 text-[9px]"
                  style={
                    {
                      background: "rgba(124,58,237,0.10)",
                      color: "#a78bfa",
                      borderColor: "rgba(124,58,237,0.25)",
                    } as CSSProperties
                  }
                >
                  {chunk.equipment_tags}
                </Badge>
              )}
            </div>
          )}
        </SheetHeader>
        <div className="overflow-y-auto px-4 pb-4">
          <p className="text-sm leading-[1.7] whitespace-pre-wrap text-ink">
            {chunk?.snippet || "(no content)"}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** @deprecated Use CitationsList + CitationDrawer + buildCitationMarkdownComponents directly. */
export function CitationsPanel({ chunks }: { chunks: CitationChunk[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [active, setActive] = useState<CitationChunk | null>(null);

  const markdownComponents = useMemo(
    () =>
      buildCitationMarkdownComponents(chunks, (c) => {
        setActive(c);
        setIsOpen(true);
      }),
    [chunks],
  );

  return {
    markdownComponents,
    List: () => (
      <CitationsList
        chunks={chunks}
        onOpen={(c) => {
          setActive(c);
          setIsOpen(true);
        }}
      />
    ),
    Drawer: () => <CitationDrawer chunk={active} isOpen={isOpen} onClose={() => setIsOpen(false)} />,
  };
}
