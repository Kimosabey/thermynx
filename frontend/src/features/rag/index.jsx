import { useState, useEffect } from "react";
import { Box, Flex, Text, Grid, Badge, Textarea, Button } from "@chakra-ui/react";
import { motion } from "framer-motion";
import PageShell from "../../shared/ui/PageShell";
import PageHeader from "../../shared/ui/PageHeader";
import GlassCard from "../../shared/ui/GlassCard";
import { SkeletonEquipCard } from "../../shared/ui/SkeletonCard";

const MotionBox = motion(Box);
const fadeUp = { initial:{opacity:0,y:12}, animate:{opacity:1,y:0,transition:{duration:0.25}} };

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

function SourceCard({ source }) {
  return (
    <GlassCard p={4}>
      <Flex justify="space-between" align="flex-start" mb={2}>
        <Text fontWeight={600} fontSize="sm" color="text.primary" noOfLines={1}>{source.source_id}</Text>
        <Badge fontSize="9px" bg="rgba(0,196,244,0.1)" color="brand.400"
          border="1px solid rgba(0,196,244,0.2)" borderRadius="6px" px={2}>
          {source.chunks} chunks
        </Badge>
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
            fontSize="10px" color="accent.cyan" mt={2}
            _hover={{ opacity: 0.8 }}>
            {expanded ? "Show less ▲" : "Show more ▼"}
          </Box>
        )}
      </GlassCard>
    </MotionBox>
  );
}

export default function RAGPage() {
  const [status,    setStatus]    = useState(null);
  const [query,     setQuery]     = useState("");
  const [results,   setResults]   = useState([]);
  const [searching, setSearching] = useState(false);
  const [searched,  setSearched]  = useState(false);

  useEffect(() => {
    fetch("/api/v1/rag/status").then(r=>r.json()).then(setStatus).catch(()=>{});
  }, []);

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
        title="Knowledge Base (RAG)"
        subtitle="Semantic search over ingested equipment manuals, ASHRAE guides, and incident reports"
        actions={status && <StatusBadge ready={status.ready} />}
      />

      {/* Ingestion instructions */}
      {status && !status.ready && (
        <MotionBox initial={{ opacity: 0 }} animate={{ opacity: 1 }} mb={6}>
          <GlassCard p={5}>
            <Text fontWeight={700} fontSize="sm" color="yellow.400" mb={3}>
              No documents ingested yet
            </Text>
            <Text fontSize="xs" color="text.muted" lineHeight={1.8} mb={4}>
              Place PDF, TXT, or MD files in <Text as="span" color="white" fontFamily="mono">docs/manuals/</Text> then run:
            </Text>
            <Box bg="rgba(0,0,0,0.4)" border="1px solid" borderColor="border.subtle"
              borderRadius="10px" p={4} fontFamily="mono" fontSize="xs" color="green.300">
              cd backend<br />
              python scripts/ingest_docs.py --dir ../docs/manuals<br />
              <Text as="span" color="text.muted"># add --clear to re-ingest existing sources</Text>
            </Box>
            <Text fontSize="xs" color="text.muted" mt={3}>
              Requires: Ollama reachable with <Text as="span" color="white">nomic-embed-text</Text> pulled (274 MB — already installed on your Ollama server).
            </Text>
          </GlassCard>
        </MotionBox>
      )}

      {/* Corpus status */}
      {status?.sources?.length > 0 && (
        <Box mb={6}>
          <Text fontSize="9px" fontWeight={700} color="text.muted" textTransform="uppercase"
            letterSpacing="0.12em" mb={3}>
            Ingested sources — {status.total_chunks} chunks total
          </Text>
          <Grid templateColumns={{ base:"1fr", md:"repeat(2,1fr)", lg:"repeat(3,1fr)" }} gap={3}>
            {status.sources.map(s => <SourceCard key={s.source_id} source={s} />)}
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
            {results.map((r, i) => <ResultCard key={`${r.source_id}-${r.chunk_idx}`} result={r} index={i} />)}
          </Flex>
        </Box>
      )}
    </PageShell>
  );
}
