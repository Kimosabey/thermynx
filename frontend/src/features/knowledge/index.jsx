import { useState } from "react";
import {
  Box, Flex, Text, Button, Input, Textarea, Badge, Divider, Spinner, Collapse, InputGroup, InputRightElement,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import { Library, Search, Plus, Wrench } from "lucide-react";
import PageShell from "../../shared/ui/PageShell";
import PageHeader from "../../shared/ui/PageHeader";
import PageHeaderIcon from "../../shared/ui/PageHeaderIcon";
import Eyebrow from "../../shared/ui/Eyebrow";
import GlassCard from "../../shared/ui/GlassCard";
import EmptyState from "../../shared/ui/EmptyState";
import ErrorAlert from "../../shared/ui/ErrorAlert";
import { SkeletonListCard } from "../../shared/ui/SkeletonCard";
import useApi from "../../shared/hooks/useApi";
import { apiFetch } from "../../shared/api/client";

const MotionBox = motion.create(Box);

const fmtWhen = (iso) => {
  if (!iso) return "";
  try { return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); }
  catch { return String(iso).slice(0, 19); }
};

function FixCard({ fix, score }) {
  return (
    <MotionBox initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <GlassCard>
        <Flex justify="space-between" align="flex-start" gap={3} mb={2} wrap="wrap">
          <Flex align="center" gap={2} minW={0}>
            <Wrench size={14} strokeWidth={2} />
            <Text fontWeight={700} fontSize="sm" noOfLines={1}>{fix.source_id}</Text>
          </Flex>
          <Flex gap={2} align="center" flexShrink={0}>
            {fix.equipment_tags && (
              <Badge variant="subtle" colorScheme="purple" fontSize="10px">{fix.equipment_tags}</Badge>
            )}
            {score != null && (
              <Badge variant="subtle" colorScheme="green" fontSize="10px">match {(score * 100).toFixed(0)}%</Badge>
            )}
          </Flex>
        </Flex>
        <Text fontSize="sm" color="text.secondary" whiteSpace="pre-wrap">{fix.content}</Text>
        {fix.created_at && <Text fontSize="xs" color="text.muted" mt={2}>{fmtWhen(fix.created_at)}</Text>}
      </GlassCard>
    </MotionBox>
  );
}

export default function PastFixesPage() {
  const { data: recent, isLoading, error, refetch } = useApi("/api/v1/knowledge/incidents?limit=25");

  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);   // null = showing recent; array = showing search
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);

  const [showCapture, setShowCapture] = useState(false);
  const [capTitle, setCapTitle] = useState("");
  const [capContent, setCapContent] = useState("");
  const [capEq, setCapEq] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [capError, setCapError] = useState(null);

  const incidents = recent?.incidents || [];

  async function runSearch() {
    const q = query.trim();
    if (q.length < 3) { setResults(null); return; }
    setSearching(true);
    setSearchError(null);
    try {
      const res = await apiFetch("/api/v1/knowledge/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, top_k: 8 }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `HTTP ${res.status}`);
      setResults((await res.json()).results || []);
    } catch (e) {
      setSearchError(e.message || "Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function captureFix() {
    setCapturing(true);
    setCapError(null);
    try {
      const res = await apiFetch("/api/v1/knowledge/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: capTitle.trim(), content: capContent.trim(), equipment_id: capEq.trim() || null }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `HTTP ${res.status}`);
      setCapTitle(""); setCapContent(""); setCapEq(""); setShowCapture(false);
      await refetch();
    } catch (e) {
      setCapError(e.message || "Capture failed");
    } finally {
      setCapturing(false);
    }
  }

  const showingSearch = results !== null;
  const list = showingSearch ? results : incidents;

  return (
    <PageShell>
      <PageHeader
        title="Past Fixes"
        subtitle="Institutional memory — resolved work orders + captured fixes, searchable and reused by the AI"
        icon={<PageHeaderIcon icon={<Library size={20} strokeWidth={1.85} />} />}
        actions={
          <Button size="sm" leftIcon={<Plus size={15} strokeWidth={2} />} onClick={() => setShowCapture((s) => !s)} variant={showCapture ? "solid" : "outline"}>
            Capture a fix
          </Button>
        }
      />

      {/* Capture form */}
      <Collapse in={showCapture} animateOpacity>
        <GlassCard mb={5}>
          <Eyebrow mb={3}>Record a fix</Eyebrow>
          <ErrorAlert error={capError} onDismiss={() => setCapError(null)} />
          <Flex direction="column" gap={3}>
            <Flex gap={3} wrap="wrap">
              <Input placeholder="Short title (e.g. Chiller 2 high kW/TR)" value={capTitle} onChange={(e) => setCapTitle(e.target.value)} maxW="420px" />
              <Input placeholder="Equipment id (optional, e.g. chiller_2)" value={capEq} onChange={(e) => setCapEq(e.target.value)} maxW="260px" />
            </Flex>
            <Textarea placeholder="What was wrong and how it was fixed…" value={capContent} onChange={(e) => setCapContent(e.target.value)} rows={4} />
            <Flex gap={2}>
              <Button size="sm" colorScheme="blue" onClick={captureFix} isDisabled={capturing || capTitle.trim().length < 3 || capContent.trim().length < 3} leftIcon={capturing ? <Spinner size="xs" /> : null}>
                {capturing ? "Embedding…" : "Save to knowledge"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowCapture(false)}>Cancel</Button>
            </Flex>
          </Flex>
        </GlassCard>
      </Collapse>

      {/* Search bar */}
      <Box mb={5}>
        <InputGroup size="lg">
          <Input
            placeholder="Search past fixes — e.g. 'chiller efficiency dropped' or 'high condenser approach'"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") runSearch(); if (e.key === "Escape") { setQuery(""); setResults(null); } }}
            bg="bg.surface"
            borderColor="border.subtle"
          />
          <InputRightElement width="3rem">
            {searching ? <Spinner size="sm" /> : <Search size={18} strokeWidth={2} onClick={runSearch} style={{ cursor: "pointer" }} />}
          </InputRightElement>
        </InputGroup>
        {showingSearch && (
          <Flex mt={2} align="center" gap={2}>
            <Text fontSize="xs" color="text.muted">{results.length} match{results.length === 1 ? "" : "es"} for “{query.trim()}”</Text>
            <Button size="xs" variant="ghost" onClick={() => { setQuery(""); setResults(null); }}>clear</Button>
          </Flex>
        )}
      </Box>

      <ErrorAlert error={searchError} onDismiss={() => setSearchError(null)} />
      {!showingSearch && <ErrorAlert error={error} onRetry={refetch} />}

      {/* List */}
      {isLoading && !showingSearch ? (
        <Flex direction="column" gap={3}>
          {Array.from({ length: 3 }).map((_, i) => <SkeletonListCard key={i} rows={3} />)}
        </Flex>
      ) : list.length === 0 ? (
        <EmptyState
          icon={<Library size={28} strokeWidth={1.6} />}
          title={showingSearch ? "No matching past fixes" : "No past fixes captured yet"}
          description={
            showingSearch
              ? "Nothing similar in the knowledge base yet. Resolve work orders or capture a fix to build it up."
              : "Resolve a work order (its diagnosis + resolution is captured automatically) or use “Capture a fix” to seed institutional memory."
          }
          action={showingSearch ? undefined : { label: "Capture a fix", onClick: () => setShowCapture(true) }}
        />
      ) : (
        <Flex direction="column" gap={3}>
          {!showingSearch && <Eyebrow>Recent fixes</Eyebrow>}
          {list.map((fix, i) => (
            <FixCard key={`${fix.source_id}-${i}`} fix={fix} score={showingSearch ? fix.score : null} />
          ))}
        </Flex>
      )}
    </PageShell>
  );
}
