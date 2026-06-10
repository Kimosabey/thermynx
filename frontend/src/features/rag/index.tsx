import { useState, useEffect, useRef, type CSSProperties } from "react";
import { Upload, Trash2, FileText, CheckCircle, AlertCircle, X, BookOpen, Loader2 } from "lucide-react";
import { motion, AnimatePresence, type Variants } from "framer-motion";

import PageShell from "@/shared/ui/PageShell";
import PageHeader from "@/shared/ui/PageHeader";
import PageHeaderIcon from "@/shared/ui/PageHeaderIcon";
import Eyebrow from "@/shared/ui/Eyebrow";
import GlassCard from "@/shared/ui/GlassCard";
import { SkeletonEquipCard } from "@/shared/ui/SkeletonCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useModelToast } from "@/shared/ai/useModels";
import { apiFetch } from "@/shared/api/client";

// ── API shapes ──────────────────────────────────────────────────────────────

interface RagSource {
  source_id: string;
  chunks: number;
  last_ingested?: string | null;
}

interface RagStatus {
  ready: boolean;
  total_chunks: number;
  sources: RagSource[];
}

interface RagResult {
  source_id: string;
  chunk_idx: number;
  content: string;
  score?: number;
  equipment_tags?: string | null;
}

interface RagSearchResponse {
  results?: RagResult[];
}

interface IngestSuccess {
  status: "ok";
  chunks_stored: number;
}
interface IngestError {
  error: string;
}
type IngestResult = IngestSuccess | IngestError;

const fadeUp: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ ready }: { ready: boolean }) {
  return (
    <div
      className="flex items-center gap-2 rounded-full border px-3 py-[4px]"
      style={
        {
          background: ready ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)",
          borderColor: ready ? "rgba(16,185,129,0.25)" : "rgba(245,158,11,0.25)",
        } as CSSProperties
      }
    >
      <div
        className="size-[6px] rounded-full"
        style={{ background: ready ? "#4ade80" : "#facc15" }}
      />
      <p
        className="text-xs font-semibold"
        style={{ color: ready ? "#4ade80" : "#facc15" }}
      >
        {ready ? "Embeddings ready" : "No documents ingested"}
      </p>
    </div>
  );
}

function SourceCard({
  source,
  onDelete,
}: {
  source: RagSource;
  onDelete: (sourceId: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await apiFetch(`/api/v1/rag/sources/${encodeURIComponent(source.source_id)}`, {
        method: "DELETE",
      });
      onDelete(source.source_id);
    } catch {
      /* ignore */
    }
    setDeleting(false);
  }

  return (
    <GlassCard className="p-4">
      <div className="mb-2 flex items-start justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <FileText size={13} color="#64748b" style={{ flexShrink: 0 }} />
          <p className="line-clamp-1 text-sm font-semibold text-ink">{source.source_id}</p>
        </div>
        <div className="ml-2 flex shrink-0 items-center gap-2">
          <Badge
            className="rounded-[6px] border px-2 text-[9px]"
            style={
              {
                background: "rgba(0,196,244,0.1)",
                color: "#38bdf8",
                borderColor: "rgba(0,196,244,0.2)",
              } as CSSProperties
            }
          >
            {source.chunks} chunks
          </Badge>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="text-ink-muted transition-colors hover:text-red-400"
          >
            {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
          </button>
        </div>
      </div>
      <p className="text-xs text-ink-muted">
        Last ingested:{" "}
        {source.last_ingested ? new Date(source.last_ingested).toLocaleString("en-IN") : "—"}
      </p>
    </GlassCard>
  );
}

function ResultCard({ result, index }: { result: RagResult; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const score = result.score ?? 0;
  const scoreColor = score > 0.8 ? "#10b981" : score > 0.6 ? "#f59e0b" : "#64748b";
  return (
    <motion.div variants={fadeUp}>
      <GlassCard className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="rounded-[6px] bg-elevated px-2 py-[2px] text-[9px] font-bold text-ink-muted">
              #{index + 1}
            </p>
            <p className="text-sm font-semibold text-ink">{result.source_id}</p>
            <p className="text-xs text-ink-muted">§{result.chunk_idx}</p>
          </div>
          <div className="flex items-center gap-2">
            {result.equipment_tags && (
              <Badge
                className="rounded-[6px] border px-2 text-[9px]"
                style={
                  {
                    background: "rgba(124,58,237,0.1)",
                    color: "#a78bfa",
                    borderColor: "rgba(124,58,237,0.2)",
                  } as CSSProperties
                }
              >
                {result.equipment_tags}
              </Badge>
            )}
            <div
              className="rounded-[6px] border px-2 py-[2px]"
              style={
                {
                  background: `${scoreColor}18`,
                  borderColor: `${scoreColor}40`,
                } as CSSProperties
              }
            >
              <p className="text-[9px] font-bold" style={{ color: scoreColor }}>
                {(score * 100).toFixed(0)}% match
              </p>
            </div>
          </div>
        </div>
        <p
          className={`text-xs leading-[1.7] text-ink-muted ${expanded ? "" : "line-clamp-3"}`}
        >
          {result.content}
        </p>
        {result.content.length > 200 && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="mt-2 text-[10px] text-cyan transition-opacity hover:opacity-80"
          >
            {expanded ? "Show less ▲" : "Show more ▼"}
          </button>
        )}
      </GlassCard>
    </motion.div>
  );
}

// ── Upload section ─────────────────────────────────────────────────────────────

function FileRow({ file, result }: { file: File; result?: IngestResult }) {
  const isSuccess = result && "status" in result && result.status === "ok";
  const errorMsg = result && "error" in result ? result.error : undefined;
  return (
    <div className="flex items-center gap-3 border-b border-border-subtle py-2 last:border-b-0">
      <FileText size={14} color="#64748b" style={{ flexShrink: 0 }} />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-xs font-medium text-ink">{file.name}</p>
        <p className="text-[10px] text-ink-muted">{(file.size / 1024).toFixed(0)} KB</p>
      </div>
      {result ? (
        isSuccess ? (
          <div className="flex items-center gap-1 text-green-400">
            <CheckCircle size={13} />
            <p className="text-[10px] font-semibold">
              {(result as IngestSuccess).chunks_stored} chunks
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-red-400">
            <AlertCircle size={13} />
            <p className="line-clamp-1 max-w-[120px] text-[10px] font-semibold">{errorMsg}</p>
          </div>
        )
      ) : null}
    </div>
  );
}

function UploadSection({ onIngestComplete }: { onIngestComplete: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [ingesting, setIngesting] = useState(false);
  const [progress, setProgress] = useState(""); // "Embedding file 2 of 4…"
  const [results, setResults] = useState<Record<string, IngestResult>>({}); // filename → result
  const [isDragOver, setIsDragOver] = useState(false);

  function addFiles(newFiles: FileList | null) {
    if (!newFiles) return;
    const accepted = Array.from(newFiles).filter((f) => /\.(pdf|txt|md)$/i.test(f.name));
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name));
      return [...prev, ...accepted.filter((f) => !existing.has(f.name))];
    });
    setResults({});
  }

  function removeFile(name: string) {
    setFiles((prev) => prev.filter((f) => f.name !== name));
    setResults((prev) => {
      const r = { ...prev };
      delete r[name];
      return r;
    });
  }

  async function handleIngest() {
    if (!files.length) return;
    setIngesting(true);
    setResults({});
    const newResults: Record<string, IngestResult> = {};

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress(`Embedding ${file.name} (${i + 1} of ${files.length})…`);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const resp = await apiFetch("/api/v1/rag/ingest", { method: "POST", body: fd });
        const data = (await resp.json()) as { detail?: string; chunks_stored?: number };
        if (!resp.ok) {
          newResults[file.name] = { error: data.detail ?? `HTTP ${resp.status}` };
        } else {
          newResults[file.name] = { status: "ok", chunks_stored: data.chunks_stored ?? 0 };
        }
      } catch (e) {
        newResults[file.name] = { error: (e as Error).message ?? "Network error" };
      }
      setResults({ ...newResults });
    }

    setProgress("");
    setIngesting(false);
    onIngestComplete();
  }

  const allDone = files.length > 0 && files.every((f) => results[f.name]);

  return (
    <GlassCard className="mb-6 p-4">
      <Eyebrow className="mb-3">Upload Documents</Eyebrow>

      {/* Drop zone */}
      <div
        className="cursor-pointer rounded-[10px] border border-dashed p-6 text-center transition-all"
        style={
          {
            borderColor: isDragOver ? "var(--cyan)" : "var(--border-subtle)",
            background: isDragOver ? "rgba(0,196,244,0.05)" : "rgba(0,0,0,0.15)",
            marginBottom: files.length ? 12 : 0,
          } as CSSProperties
        }
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.md"
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <div className="flex flex-col items-center gap-2">
          <Upload size={20} color="#64748b" />
          <p className="text-xs text-ink-muted">
            Drag &amp; drop files here, or{" "}
            <span className="font-semibold text-cyan">click to browse</span>
          </p>
          <p className="text-[10px] text-ink-muted">PDF, TXT, MD — up to 50 MB each</p>
        </div>
      </div>

      {/* File list */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mb-3 rounded-[10px] border border-border-subtle px-3">
              {files.map((f) => (
                <div key={f.name} className="flex items-center gap-2">
                  <div className="flex-1">
                    <FileRow file={f} result={results[f.name]} />
                  </div>
                  {!ingesting && !results[f.name] && (
                    <button
                      type="button"
                      onClick={() => removeFile(f.name)}
                      className="ml-1 shrink-0 text-ink-muted transition-colors hover:text-red-400"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-ink-muted">
                {ingesting
                  ? progress
                  : allDone
                    ? `${files.filter((f) => {
                        const r = results[f.name];
                        return r && "status" in r && r.status === "ok";
                      }).length} of ${files.length} ingested`
                    : `${files.length} file${files.length > 1 ? "s" : ""} selected`}
              </p>
              <div className="flex gap-2">
                {!ingesting && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setFiles([]);
                      setResults({});
                    }}
                    className="rounded-[9px] px-3 text-xs text-ink-muted"
                  >
                    Clear
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={handleIngest}
                  disabled={!files.length || allDone || ingesting}
                  className="rounded-[9px] px-5 font-semibold"
                >
                  {ingesting ? (
                    <>
                      <Loader2 className="animate-spin" />
                      {progress || "Ingesting…"}
                    </>
                  ) : (
                    "Ingest"
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RAGPage() {
  const [status, setStatus] = useState<RagStatus | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RagResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const notifyModel = useModelToast();

  function fetchStatus() {
    apiFetch("/api/v1/rag/status")
      .then((r) => r.json())
      .then((d: RagStatus) => setStatus(d))
      .catch(() => {});
  }

  useEffect(() => {
    fetchStatus();
  }, []);

  function handleSourceDeleted(sourceId: string) {
    setStatus((prev) => {
      if (!prev) return prev;
      const sources = prev.sources.filter((s) => s.source_id !== sourceId);
      const total_chunks = sources.reduce((s, r) => s + r.chunks, 0);
      return { ...prev, sources, total_chunks, ready: total_chunks > 0 };
    });
  }

  async function handleSearch() {
    if (!query.trim()) return;
    notifyModel("embed", { prefix: "Search" });
    setSearching(true);
    setResults([]);
    try {
      const r = await apiFetch(
        `/api/v1/rag/search?q=${encodeURIComponent(query.trim())}&top_k=8`,
      );
      const d = (await r.json()) as RagSearchResponse;
      setResults(d.results ?? []);
    } catch {
      /* ignore */
    }
    setSearching(false);
    setSearched(true);
  }

  return (
    <PageShell>
      <PageHeader
        title="Knowledge Base"
        subtitle="Upload equipment manuals, ASHRAE guides, or incident reports — ground AI answers in your documents"
        icon={<PageHeaderIcon icon={<BookOpen size={20} strokeWidth={1.85} />} />}
        actions={status ? <StatusBadge ready={status.ready} /> : undefined}
      />

      {/* Upload section */}
      <UploadSection onIngestComplete={fetchStatus} />

      {/* Corpus sources */}
      {status === null && (
        <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <SkeletonEquipCard key={i} />
          ))}
        </div>
      )}

      {status?.sources && status.sources.length > 0 && (
        <div className="mb-6">
          <Eyebrow className="mb-3">Ingested sources — {status.total_chunks} chunks total</Eyebrow>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {status.sources.map((s) => (
              <SourceCard key={s.source_id} source={s} onDelete={handleSourceDeleted} />
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <GlassCard className="mb-5 p-4">
        <Eyebrow className="mb-3">Semantic search</Eyebrow>
        <Textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSearch();
          }}
          placeholder="e.g. What is the maintenance interval for condenser tube cleaning?"
          rows={3}
          className="mb-3 resize-y rounded-[10px] border-border-subtle bg-elevated text-sm text-ink placeholder:text-ink-muted focus-visible:border-cyan focus-visible:ring-0"
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-ink-muted">Ctrl+Enter to search</p>
          <motion.div whileTap={{ scale: 0.95 }}>
            <Button
              size="sm"
              onClick={handleSearch}
              disabled={!status?.ready || searching}
              className="rounded-[9px] px-5 font-semibold"
            >
              {searching ? (
                <>
                  <Loader2 className="animate-spin" />
                  Searching…
                </>
              ) : (
                "Search"
              )}
            </Button>
          </motion.div>
        </div>
      </GlassCard>

      {/* Results */}
      {searched && !searching && results.length === 0 && (
        <GlassCard className="flex flex-col items-center justify-center gap-2 p-8">
          <p className="text-sm text-ink-muted">No relevant chunks found for that query.</p>
          <p className="text-xs text-ink-muted">Try broader terms, or ingest more documents.</p>
        </GlassCard>
      )}

      {results.length > 0 && (
        <div>
          <Eyebrow className="mb-3">
            {results.length} results for &quot;{query}&quot;
          </Eyebrow>
          <div className="flex flex-col gap-3">
            {results.map((r, i) => (
              <ResultCard key={`${r.source_id}-${r.chunk_idx}`} result={r} index={i} />
            ))}
          </div>
        </div>
      )}
    </PageShell>
  );
}
