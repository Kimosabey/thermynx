import { useState, useEffect, useRef } from "react";
import { Box, Flex, Text, Grid, Badge, Textarea, Button, Spinner } from "@chakra-ui/react";
import { Upload, Trash2, FileText, CheckCircle, AlertCircle, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import PageShell from "../../shared/ui/PageShell";
import PageHeader from "../../shared/ui/PageHeader";
import GlassCard from "../../shared/ui/GlassCard";
import { SkeletonEquipCard } from "../../shared/ui/SkeletonCard";

const MotionBox = motion.create(Box);
const fadeUp = { initial:{opacity:0,y:12}, animate:{opacity:1,y:0,transition:{duration:0.25}} };

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ ready }) {
  return (
    <Flex align="center" gap={2}
      bg={ready ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)"}
      border="1px solid" borderColor={ready ? "rgba(16,185,129,0.25)" : "rgba(245,158,11,0.25)"}
      borderRadius="full" px={3} py="4px">
      <Box w="6px" h="6px" borderRadius="full" bg={ready ? "green.400" : "yellow.400"} />
      <Text fontSize="xs" fontWeight={600} color={ready ? "green.400" : "yellow.400"}>
        {ready ? "Embeddings ready" : "No documents ingested"}
      </Text>
    </Flex>
  );
}

function SourceCard({ source, onDelete }) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await fetch(`/api/v1/rag/sources/${encodeURIComponent(source.source_id)}`, { method: "DELETE" });
      onDelete(source.source_id);
    } catch { /* ignore */ }
    setDeleting(false);
  }

  return (
    <GlassCard p={4}>
      <Flex justify="space-between" align="flex-start" mb={2}>
        <Flex align="center" gap={2} minW={0}>
          <FileText size={13} color="#64748b" style={{ flexShrink: 0 }} />
          <Text fontWeight={600} fontSize="sm" color="text.primary" noOfLines={1}>{source.source_id}</Text>
        </Flex>
        <Flex align="center" gap={2} flexShrink={0} ml={2}>
          <Badge fontSize="9px" bg="rgba(0,196,244,0.1)" color="brand.400"
            border="1px solid rgba(0,196,244,0.2)" borderRadius="6px" px={2}>
            {source.chunks} chunks
          </Badge>
          <Box as="button" onClick={handleDelete} disabled={deleting}
            color="text.muted" _hover={{ color: "red.400" }} transition="color 0.15s">
            {deleting ? <Spinner size="xs" /> : <Trash2 size={13} />}
          </Box>
        </Flex>
      </Flex>
      <Text fontSize="xs" color="text.muted">
        Last ingested: {source.last_ingested ? new Date(source.last_ingested).toLocaleString("en-IN") : "—"}
      </Text>
    </GlassCard>
  );
}

function ResultCard({ result, index }) {
  const [expanded, setExpanded] = useState(false);
  const score = result.score ?? 0;
  const scoreColor = score > 0.8 ? "#10b981" : score > 0.6 ? "#f59e0b" : "#64748b";
  return (
    <MotionBox variants={fadeUp}>
      <GlassCard p={4}>
        <Flex justify="space-between" align="center" mb={3}>
          <Flex align="center" gap={2}>
            <Text fontSize="9px" fontWeight={700} color="text.muted" bg="bg.elevated"
              px={2} py="2px" borderRadius="6px">#{index + 1}</Text>
            <Text fontWeight={600} fontSize="sm" color="text.primary">{result.source_id}</Text>
            <Text fontSize="xs" color="text.muted">§{result.chunk_idx}</Text>
          </Flex>
          <Flex align="center" gap={2}>
            {result.equipment_tags && (
              <Badge fontSize="9px" bg="rgba(124,58,237,0.1)" color="#a78bfa"
                border="1px solid rgba(124,58,237,0.2)" borderRadius="6px" px={2}>
                {result.equipment_tags}
              </Badge>
            )}
            <Box px={2} py="2px" borderRadius="6px" bg={`${scoreColor}18`}
              border={`1px solid ${scoreColor}40`}>
              <Text fontSize="9px" fontWeight={700} color={scoreColor}>
                {(score * 100).toFixed(0)}% match
              </Text>
            </Box>
          </Flex>
        </Flex>
        <Text fontSize="xs" color="text.muted" lineHeight={1.7}
          noOfLines={expanded ? undefined : 3}>
          {result.content}
        </Text>
        {result.content.length > 200 && (
          <Box as="button" onClick={() => setExpanded(!expanded)}
            fontSize="10px" color="accent.cyan" mt={2} _hover={{ opacity: 0.8 }}>
            {expanded ? "Show less ▲" : "Show more ▼"}
          </Box>
        )}
      </GlassCard>
    </MotionBox>
  );
}

// ── Upload section ─────────────────────────────────────────────────────────────

function FileRow({ file, result }) {
  const isSuccess = result?.status === "ok";
  const isError   = result?.error;
  return (
    <Flex align="center" gap={3} py={2}
      borderBottom="1px solid" borderColor="border.subtle" _last={{ borderBottom: "none" }}>
      <FileText size={14} color="#64748b" style={{ flexShrink: 0 }} />
      <Box flex={1} minW={0}>
        <Text fontSize="xs" color="text.primary" fontWeight={500} noOfLines={1}>{file.name}</Text>
        <Text fontSize="10px" color="text.muted">{(file.size / 1024).toFixed(0)} KB</Text>
      </Box>
      {result ? (
        isSuccess ? (
          <Flex align="center" gap={1} color="green.400">
            <CheckCircle size={13} />
            <Text fontSize="10px" fontWeight={600}>{result.chunks_stored} chunks</Text>
          </Flex>
        ) : (
          <Flex align="center" gap={1} color="red.400">
            <AlertCircle size={13} />
            <Text fontSize="10px" fontWeight={600} noOfLines={1} maxW="120px">{result.error}</Text>
          </Flex>
        )
      ) : null}
    </Flex>
  );
}

function UploadSection({ onIngestComplete }) {
  const fileInputRef  = useRef(null);
  const [files,       setFiles]       = useState([]);
  const [ingesting,   setIngesting]   = useState(false);
  const [progress,    setProgress]    = useState("");   // "Embedding file 2 of 4…"
  const [results,     setResults]     = useState({});   // filename → {status,chunks_stored} | {error}
  const [isDragOver,  setIsDragOver]  = useState(false);

  function addFiles(newFiles) {
    const accepted = Array.from(newFiles).filter(f =>
      /\.(pdf|txt|md)$/i.test(f.name)
    );
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name));
      return [...prev, ...accepted.filter(f => !existing.has(f.name))];
    });
    setResults({});
  }

  function removeFile(name) {
    setFiles(prev => prev.filter(f => f.name !== name));
    setResults(prev => { const r = {...prev}; delete r[name]; return r; });
  }

  async function handleIngest() {
    if (!files.length) return;
    setIngesting(true);
    setResults({});
    const newResults = {};

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress(`Embedding ${file.name} (${i + 1} of ${files.length})…`);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const resp = await fetch("/api/v1/rag/ingest", { method: "POST", body: fd });
        const data = await resp.json();
        if (!resp.ok) {
          newResults[file.name] = { error: data.detail ?? `HTTP ${resp.status}` };
        } else {
          newResults[file.name] = { status: "ok", chunks_stored: data.chunks_stored };
        }
      } catch (e) {
        newResults[file.name] = { error: e.message ?? "Network error" };
      }
      setResults({ ...newResults });
    }

    setProgress("");
    setIngesting(false);
    onIngestComplete();
  }

  const allDone = files.length > 0 && files.every(f => results[f.name]);

  return (
    <GlassCard p={4} mb={6}>
      <Text fontSize="9px" fontWeight={700} color="text.muted" textTransform="uppercase"
        letterSpacing="0.12em" mb={3}>
        Upload Documents
      </Text>

      {/* Drop zone */}
      <Box
        border="1px dashed"
        borderColor={isDragOver ? "accent.cyan" : "border.subtle"}
        borderRadius="10px"
        bg={isDragOver ? "rgba(0,196,244,0.05)" : "rgba(0,0,0,0.15)"}
        p={6} mb={files.length ? 3 : 0} textAlign="center" cursor="pointer"
        transition="all 0.15s"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={e => { e.preventDefault(); setIsDragOver(false); addFiles(e.dataTransfer.files); }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.md"
          multiple
          style={{ display: "none" }}
          onChange={e => { addFiles(e.target.files); e.target.value = ""; }}
        />
        <Flex direction="column" align="center" gap={2}>
          <Upload size={20} color="#64748b" />
          <Text fontSize="xs" color="text.muted">
            Drag & drop files here, or{" "}
            <Text as="span" color="accent.cyan" fontWeight={600}>click to browse</Text>
          </Text>
          <Text fontSize="10px" color="text.muted">PDF, TXT, MD — up to 50 MB each</Text>
        </Flex>
      </Box>

      {/* File list */}
      <AnimatePresence>
        {files.length > 0 && (
          <MotionBox
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            overflow="hidden"
          >
            <Box border="1px solid" borderColor="border.subtle" borderRadius="10px" px={3} mb={3}>
              {files.map(f => (
                <Flex key={f.name} align="center" gap={2}>
                  <Box flex={1}>
                    <FileRow file={f} result={results[f.name]} />
                  </Box>
                  {!ingesting && !results[f.name] && (
                    <Box as="button" onClick={() => removeFile(f.name)}
                      color="text.muted" _hover={{ color: "red.400" }} ml={1} flexShrink={0}>
                      <X size={12} />
                    </Box>
                  )}
                </Flex>
              ))}
            </Box>

            <Flex justify="space-between" align="center">
              <Text fontSize="xs" color="text.muted">
                {ingesting ? progress : allDone ? `${files.filter(f => results[f.name]?.status === "ok").length} of ${files.length} ingested` : `${files.length} file${files.length > 1 ? "s" : ""} selected`}
              </Text>
              <Flex gap={2}>
                {!ingesting && (
                  <Button size="sm" variant="ghost" onClick={() => { setFiles([]); setResults({}); }}
                    borderRadius="9px" fontSize="xs" color="text.muted" px={3}>
                    Clear
                  </Button>
                )}
                <Button size="sm" onClick={handleIngest}
                  isLoading={ingesting} loadingText={progress || "Ingesting…"}
                  borderRadius="9px" fontWeight={600} px={5}
                  isDisabled={!files.length || allDone}>
                  Ingest
                </Button>
              </Flex>
            </Flex>
          </MotionBox>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RAGPage() {
  const [status,    setStatus]    = useState(null);
  const [query,     setQuery]     = useState("");
  const [results,   setResults]   = useState([]);
  const [searching, setSearching] = useState(false);
  const [searched,  setSearched]  = useState(false);

  function fetchStatus() {
    fetch("/api/v1/rag/status").then(r => r.json()).then(setStatus).catch(() => {});
  }

  useEffect(() => { fetchStatus(); }, []);

  function handleSourceDeleted(sourceId) {
    setStatus(prev => {
      if (!prev) return prev;
      const sources = prev.sources.filter(s => s.source_id !== sourceId);
      const total_chunks = sources.reduce((s, r) => s + r.chunks, 0);
      return { ...prev, sources, total_chunks, ready: total_chunks > 0 };
    });
  }

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setResults([]);
    try {
      const r = await fetch(`/api/v1/rag/search?q=${encodeURIComponent(query.trim())}&top_k=8`);
      const d = await r.json();
      setResults(d.results ?? []);
    } catch { /* ignore */ }
    setSearching(false);
    setSearched(true);
  }

  return (
    <PageShell>
      <PageHeader
        title="Knowledge Base"
        subtitle="Upload equipment manuals, ASHRAE guides, or incident reports — ground AI answers in your documents"
        actions={status && <StatusBadge ready={status.ready} />}
      />

      {/* Upload section */}
      <UploadSection onIngestComplete={fetchStatus} />

      {/* Corpus sources */}
      {status === null && (
        <Grid templateColumns={{ base:"1fr", md:"repeat(3,1fr)" }} gap={3} mb={6}>
          {[0,1,2].map(i => <SkeletonEquipCard key={i} />)}
        </Grid>
      )}

      {status?.sources?.length > 0 && (
        <Box mb={6}>
          <Text fontSize="9px" fontWeight={700} color="text.muted" textTransform="uppercase"
            letterSpacing="0.12em" mb={3}>
            Ingested sources — {status.total_chunks} chunks total
          </Text>
          <Grid templateColumns={{ base:"1fr", md:"repeat(2,1fr)", lg:"repeat(3,1fr)" }} gap={3}>
            {status.sources.map(s => (
              <SourceCard key={s.source_id} source={s} onDelete={handleSourceDeleted} />
            ))}
          </Grid>
        </Box>
      )}

      {/* Search */}
      <GlassCard p={4} mb={5}>
        <Text fontSize="9px" fontWeight={700} color="text.muted" textTransform="uppercase"
          letterSpacing="0.12em" mb={3}>
          Semantic search
        </Text>
        <Textarea
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSearch(); }}
          placeholder="e.g. What is the maintenance interval for condenser tube cleaning?"
          rows={3} resize="vertical" bg="bg.elevated"
          border="1px solid" borderColor="border.subtle" borderRadius="10px"
          _focus={{ borderColor: "accent.cyan", boxShadow: "none" }}
          fontSize="sm" color="text.primary" _placeholder={{ color: "text.muted" }} mb={3}
        />
        <Flex justify="space-between" align="center">
          <Text fontSize="xs" color="text.muted">Ctrl+Enter to search</Text>
          <MotionBox whileTap={{ scale: 0.95 }}>
            <Button size="sm" onClick={handleSearch} isLoading={searching}
              loadingText="Searching…" borderRadius="9px" fontWeight={600} px={5}
              isDisabled={!status?.ready}>
              Search
            </Button>
          </MotionBox>
        </Flex>
      </GlassCard>

      {/* Results */}
      {searched && !searching && results.length === 0 && (
        <GlassCard p={8} display="flex" alignItems="center" justifyContent="center" flexDir="column" gap={2}>
          <Text fontSize="sm" color="text.muted">No relevant chunks found for that query.</Text>
          <Text fontSize="xs" color="text.muted">Try broader terms, or ingest more documents.</Text>
        </GlassCard>
      )}

      {results.length > 0 && (
        <Box>
          <Text fontSize="9px" fontWeight={700} color="text.muted" textTransform="uppercase"
            letterSpacing="0.12em" mb={3}>
            {results.length} results for "{query}"
          </Text>
          <Flex flexDir="column" gap={3}>
            {results.map((r, i) => (
              <ResultCard key={`${r.source_id}-${r.chunk_idx}`} result={r} index={i} />
            ))}
          </Flex>
        </Box>
      )}
    </PageShell>
  );
}
