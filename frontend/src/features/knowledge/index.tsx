import { useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import { Library, Search, Plus, Wrench, Loader2 } from "lucide-react";

import PageShell from "@/shared/ui/PageShell";
import PageHeader from "@/shared/ui/PageHeader";
import PageHeaderIcon from "@/shared/ui/PageHeaderIcon";
import Eyebrow from "@/shared/ui/Eyebrow";
import GlassCard from "@/shared/ui/GlassCard";
import EmptyState from "@/shared/ui/EmptyState";
import ErrorAlert from "@/shared/ui/ErrorAlert";
import { SkeletonListCard } from "@/shared/ui/SkeletonCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import useApi from "@/shared/hooks/useApi";
import { apiFetch } from "@/shared/api/client";

// ── API shapes ──────────────────────────────────────────────────────────────

interface KnowledgeFix {
  source_id: string;
  content: string;
  equipment_tags?: string | null;
  created_at?: string | null;
  score?: number;
}

interface IncidentsResponse {
  incidents?: KnowledgeFix[];
}

interface SearchResponse {
  results?: KnowledgeFix[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtWhen = (iso?: string | null): string => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return String(iso).slice(0, 19);
  }
};

// ── Sub-components ──────────────────────────────────────────────────────────────

function FixCard({ fix, score }: { fix: KnowledgeFix; score: number | null }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <GlassCard>
        <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Wrench size={14} strokeWidth={2} />
            <p className="line-clamp-1 text-sm font-bold">{fix.source_id}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {fix.equipment_tags && (
              <Badge
                className="rounded-[6px] border px-2 text-[10px]"
                style={
                  {
                    background: "rgba(124,58,237,0.1)",
                    color: "#a78bfa",
                    borderColor: "rgba(124,58,237,0.2)",
                  } as CSSProperties
                }
              >
                {fix.equipment_tags}
              </Badge>
            )}
            {score != null && (
              <Badge
                className="rounded-[6px] border px-2 text-[10px]"
                style={
                  {
                    background: "rgba(16,185,129,0.1)",
                    color: "#34d399",
                    borderColor: "rgba(16,185,129,0.2)",
                  } as CSSProperties
                }
              >
                match {(score * 100).toFixed(0)}%
              </Badge>
            )}
          </div>
        </div>
        <p className="text-sm whitespace-pre-wrap text-ink-secondary">{fix.content}</p>
        {fix.created_at && <p className="mt-2 text-xs text-ink-muted">{fmtWhen(fix.created_at)}</p>}
      </GlassCard>
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PastFixesPage() {
  const { data: recent, isLoading, error, refetch } = useApi<IncidentsResponse>(
    "/api/v1/knowledge/incidents?limit=25",
  );

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<KnowledgeFix[] | null>(null); // null = showing recent; array = showing search
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [showCapture, setShowCapture] = useState(false);
  const [capTitle, setCapTitle] = useState("");
  const [capContent, setCapContent] = useState("");
  const [capEq, setCapEq] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [capError, setCapError] = useState<string | null>(null);

  const incidents = recent?.incidents || [];

  async function runSearch() {
    const q = query.trim();
    if (q.length < 3) {
      setResults(null);
      return;
    }
    setSearching(true);
    setSearchError(null);
    try {
      const res = await apiFetch("/api/v1/knowledge/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, top_k: 8 }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { detail?: string };
        throw new Error(body.detail || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as SearchResponse;
      setResults(data.results || []);
    } catch (e) {
      setSearchError((e as Error).message || "Search failed");
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
        body: JSON.stringify({
          title: capTitle.trim(),
          content: capContent.trim(),
          equipment_id: capEq.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { detail?: string };
        throw new Error(body.detail || `HTTP ${res.status}`);
      }
      setCapTitle("");
      setCapContent("");
      setCapEq("");
      setShowCapture(false);
      await refetch();
    } catch (e) {
      setCapError((e as Error).message || "Capture failed");
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
          <Button
            size="sm"
            onClick={() => setShowCapture((s) => !s)}
            variant={showCapture ? "default" : "outline"}
          >
            <Plus size={15} strokeWidth={2} />
            Capture a fix
          </Button>
        }
      />

      {/* Capture form */}
      <Collapsible open={showCapture} onOpenChange={setShowCapture}>
        <CollapsibleContent>
          <GlassCard className="mb-5">
            <Eyebrow className="mb-3">Record a fix</Eyebrow>
            <ErrorAlert error={capError} onDismiss={() => setCapError(null)} />
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-3">
                <Input
                  placeholder="Short title (e.g. Chiller 2 high kW/TR)"
                  value={capTitle}
                  onChange={(e) => setCapTitle(e.target.value)}
                  className="max-w-[420px]"
                />
                <Input
                  placeholder="Equipment id (optional, e.g. chiller_2)"
                  value={capEq}
                  onChange={(e) => setCapEq(e.target.value)}
                  className="max-w-[260px]"
                />
              </div>
              <Textarea
                placeholder="What was wrong and how it was fixed…"
                value={capContent}
                onChange={(e) => setCapContent(e.target.value)}
                rows={4}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={captureFix}
                  disabled={
                    capturing || capTitle.trim().length < 3 || capContent.trim().length < 3
                  }
                >
                  {capturing ? <Loader2 className="animate-spin" /> : null}
                  {capturing ? "Embedding…" : "Save to knowledge"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowCapture(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </GlassCard>
        </CollapsibleContent>
      </Collapsible>

      {/* Search bar */}
      <div className="mb-5">
        <div className="relative">
          <Input
            placeholder="Search past fixes — e.g. 'chiller efficiency dropped' or 'high condenser approach'"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") runSearch();
              if (e.key === "Escape") {
                setQuery("");
                setResults(null);
              }
            }}
            className="h-12 bg-surface pr-12 text-base"
          />
          <div className="absolute inset-y-0 right-0 flex w-12 items-center justify-center">
            {searching ? (
              <Loader2 size={18} className="animate-spin text-ink-muted" />
            ) : (
              <Search
                size={18}
                strokeWidth={2}
                onClick={runSearch}
                style={{ cursor: "pointer" }}
              />
            )}
          </div>
        </div>
        {showingSearch && (
          <div className="mt-2 flex items-center gap-2">
            <p className="text-xs text-ink-muted">
              {results.length} match{results.length === 1 ? "" : "es"} for “{query.trim()}”
            </p>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => {
                setQuery("");
                setResults(null);
              }}
            >
              clear
            </Button>
          </div>
        )}
      </div>

      <ErrorAlert error={searchError} onDismiss={() => setSearchError(null)} />
      {!showingSearch && <ErrorAlert error={error} onRetry={refetch} />}

      {/* List */}
      {isLoading && !showingSearch ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonListCard key={i} rows={3} />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={<Library size={28} strokeWidth={1.6} />}
          title={showingSearch ? "No matching past fixes" : "No past fixes captured yet"}
          description={
            showingSearch
              ? "Nothing similar in the knowledge base yet. Resolve work orders or capture a fix to build it up."
              : "Resolve a work order (its diagnosis + resolution is captured automatically) or use “Capture a fix” to seed institutional memory."
          }
          action={
            showingSearch
              ? undefined
              : { label: "Capture a fix", onClick: () => setShowCapture(true) }
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {!showingSearch && <Eyebrow>Recent fixes</Eyebrow>}
          {list.map((fix, i) => (
            <FixCard
              key={`${fix.source_id}-${i}`}
              fix={fix}
              score={showingSearch ? (fix.score ?? null) : null}
            />
          ))}
        </div>
      )}
    </PageShell>
  );
}
