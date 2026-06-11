import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  type CSSProperties,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

import {
  buildCitationMarkdownComponents,
  CitationsList,
  CitationDrawer,
  type CitationChunk,
} from "./CitationFootnotes";
import { AuditPanel, type AuditResult, type VerificationResult } from "./AuditPanel";
import { FeedbackBar } from "./FeedbackBar";
import TimeseriesChart, { type TimeseriesData } from "./TimeseriesChart";

import PageShell from "@/shared/ui/PageShell";
import PageHeader from "@/shared/ui/PageHeader";
import PageHeaderIcon from "@/shared/ui/PageHeaderIcon";
import GlassSelect from "@/shared/ui/GlassSelect";
import PeriodSelect from "@/shared/ui/PeriodSelect";
import GlassCard from "@/shared/ui/GlassCard";
import ErrorAlert from "@/shared/ui/ErrorAlert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import useAppToast from "@/shared/hooks/useAppToast";
import { useModelToast } from "@/shared/ai/useModels";
import { makeModelToaster } from "@/shared/ai/modelStreamToast";
import { buildAnalyzerPrompts } from "@/shared/ai/promptTemplates";
import type { Equipment } from "@/shared/types";

// `QUICK_PROMPTS` is now derived dynamically from the selected equipment via
// `buildAnalyzerPrompts(selectedEqObj)` — see render block below.

// ── API shapes ──────────────────────────────────────────────────────────────

interface Thread {
  id: string;
  title?: string | null;
}

interface ThreadMessage {
  id: string | number;
  role: "user" | "assistant";
  content: string;
}

interface StreamMeta {
  type: "done";
  model?: string;
  total_ms?: number;
  audit_id?: string | number | null;
  [key: string]: unknown;
}

// ── Markdown renderer ─────────────────────────────────────────────────────────

function MarkdownRenderer({ content, components }: { content: string; components: Components }) {
  return (
    <div
      className={
        "max-w-full overflow-hidden " +
        "[&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:border-b [&_h2]:border-border-subtle [&_h2]:pb-2 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-ink " +
        "[&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-sm [&_h3]:font-bold [&_h3]:text-cyan " +
        "[&_p]:mb-3 [&_p]:text-sm [&_p]:leading-[1.8] [&_p]:break-words [&_p]:text-ink " +
        "[&_ul]:mb-3 [&_ul]:pl-5 [&_ol]:mb-3 [&_ol]:pl-5 " +
        "[&_li]:mb-1 [&_li]:break-words [&_li]:text-sm [&_li]:text-ink " +
        "[&_strong]:font-semibold [&_strong]:text-ink " +
        "[&_code]:break-all [&_code]:rounded-[5px] [&_code]:bg-[rgba(0,196,244,0.08)] [&_code]:px-[5px] [&_code]:py-[2px] [&_code]:font-mono [&_code]:text-[0.82em] [&_code]:text-[#6671FF] " +
        "[&_pre]:mb-3 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded-[10px] [&_pre]:border [&_pre]:border-border-subtle [&_pre]:bg-[rgba(0,0,0,0.4)] [&_pre]:p-4 [&_pre]:text-xs " +
        "[&_table]:mb-3 [&_table]:block [&_table]:max-w-full [&_table]:w-full [&_table]:overflow-x-auto [&_table]:border-collapse [&_table]:font-mono [&_table]:text-sm " +
        "[&_th]:border [&_th]:border-border-subtle [&_th]:bg-elevated [&_th]:px-3 [&_th]:py-[6px] [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:text-ink-muted " +
        "[&_td]:border [&_td]:border-border-subtle [&_td]:px-3 [&_td]:py-[6px] [&_td]:text-left [&_td]:text-ink " +
        "[&_blockquote]:ml-0 [&_blockquote]:border-l-2 [&_blockquote]:border-cyan [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-ink-muted [&_blockquote]:opacity-80 " +
        "[&_img]:h-auto [&_img]:max-w-full " +
        "[&_a]:break-all [&_a]:text-cyan"
      }
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="size-[5px] rounded-full bg-brand"
          animate={{ y: [0, -5, 0], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </div>
  );
}

export default function AIAnalyzer() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [selectedEq, setSelectedEq] = useState("");
  const [hours, setHours] = useState(24);
  const [question, setQuestion] = useState("");
  const [tsData, setTsData] = useState<TimeseriesData | null>(null);
  const [tsLoading, setTsLoading] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [citations, setCitations] = useState<CitationChunk[]>([]);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [activeCitation, setActiveCitation] = useState<CitationChunk | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [, setStreamDone] = useState(false);
  const [streamMeta, setStreamMeta] = useState<StreamMeta | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState("");
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([]);

  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef("");
  const toast = useAppToast();
  const notifyModel = useModelToast();

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  useEffect(() => {
    threadRef.current = activeThreadId;
  }, [activeThreadId]);

  // Stable markdown components — only rebuilt when citations list changes.
  // Must NOT be recomputed every render (causes ReactMarkdown to remount the tree,
  // breaking mid-stream bold/italic rendering).
  const openCitation = useCallback(
    (c: CitationChunk) => {
      setActiveCitation(c);
      openDrawer();
    },
    [openDrawer],
  );
  const markdownComponents = useMemo<Components>(
    () => (citations.length ? buildCitationMarkdownComponents(citations, openCitation) : {}),
    [citations, openCitation],
  );

  async function refreshThreads() {
    try {
      const r = await fetch("/api/v1/threads");
      const j = (await r.json()) as { threads?: Thread[] };
      setThreads(j.threads || []);
    } catch {
      /* ignore */
    }
  }

  async function handleNewThread() {
    try {
      const r = await fetch("/api/v1/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const j = (await r.json()) as { id: string };
      await refreshThreads();
      setActiveThreadId(j.id);
      setThreadMessages([]);
      toast.success("New conversation started");
    } catch {
      toast.error("Could not create thread", "Check the backend connection");
    }
  }

  useEffect(() => {
    refreshThreads();
  }, []);

  useEffect(() => {
    if (!activeThreadId) {
      setThreadMessages([]);
      return;
    }
    fetch(`/api/v1/threads/${activeThreadId}/messages`)
      .then((r) => r.json())
      .then((d: { messages?: ThreadMessage[] }) => setThreadMessages(d.messages || []))
      .catch(() => setThreadMessages([]));
  }, [activeThreadId]);

  useEffect(() => {
    fetch("/api/v1/equipment")
      .then((r) => r.json())
      .then((d: Equipment[]) => setEquipment(d))
      .catch(() => toast.error("Could not load equipment list"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedEq) return;
    setTsData(null);
    setTsLoading(true);
    fetch(`/api/v1/equipment/${selectedEq}/timeseries?hours=${hours}&resolution=15m`)
      .then((r) => r.json())
      .then((d: TimeseriesData) => {
        setTsData(d);
        setTsLoading(false);
      })
      .catch(() => setTsLoading(false));
  }, [selectedEq, hours]);

  // Auto-scroll while streaming — only if user hasn't manually scrolled up.
  // Scroll ONLY this pane (direct scrollTop); scrollIntoView bubbles to the
  // page's <main> scroll and jumps the whole page on every token.
  useEffect(() => {
    if (!streaming || !scrollAreaRef.current) return;
    const el = scrollAreaRef.current;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [streamContent, streaming]);

  async function handleAnalyze(forcedQuestion: string | null = null) {
    const q = typeof forcedQuestion === "string" ? forcedQuestion : question;
    if (q.trim().length === 0) return;
    notifyModel("text", { prefix: "Analyzing" });
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setStreaming(true);
    setStreamDone(false);
    setStreamContent("");
    setStreamMeta(null);
    setError(null);
    setCitations([]);
    setAuditResult(null);
    setVerification(null);

    try {
      const res = await fetch("/api/v1/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q.trim(),
          equipment_id: selectedEq || null,
          hours,
          thread_id: activeThreadId || null,
        }),
        signal: ctrl.signal,
      });
      if (!res.ok)
        throw new Error(
          ((await res.json().catch(() => ({}))) as { detail?: string }).detail || `HTTP ${res.status}`,
        );
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      const mt = makeModelToaster(notifyModel, "Analyzer"); // toast each model as the stream engages it

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          // SSE frames are server-defined; parse loosely and dispatch on `type`.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let evt: any;
          try {
            evt = JSON.parse(line.slice(6));
          } catch (e) {
            if (import.meta.env.DEV) console.error("[analyzer] SSE parse error:", line.slice(0, 120), e);
            continue;
          }
          mt.frame(evt.type); // toast each model the moment it's engaged (deduped)
          if (evt.type === "token") setStreamContent((p) => p + evt.content);
          if (evt.type === "citations") setCitations(evt.chunks || []);
          if (evt.type === "audit") setAuditResult(evt.audit || null);
          if (evt.type === "verification") setVerification(evt.verdict || null);
          if (evt.type === "done") {
            setStreamMeta(evt);
            setStreamDone(true);
            const tid = threadRef.current;
            if (tid) {
              fetch(`/api/v1/threads/${tid}/messages`)
                .then((r) => r.json())
                .then((d: { messages?: ThreadMessage[] }) => setThreadMessages(d.messages || []))
                .catch(() => {});
              refreshThreads();
            }
          }
          if (evt.type === "error") throw new Error(evt.detail || "Stream error");
        }
      }
    } catch (e) {
      const err = e as { name?: string; message?: string };
      if (err.name !== "AbortError") setError(err.message ?? "Stream failed");
    } finally {
      setStreaming(false);
    }
  }

  const selectedEqObj = equipment.find((e) => e.id === selectedEq);

  return (
    <PageShell
      className="flex h-[calc(100vh-80px)] max-w-[1400px] flex-col overflow-hidden"
    >
      <div className="shrink-0">
        <PageHeader
          title="AI Analyzer"
          subtitle="Ask anything about your HVAC plant — powered by local AI"
          className="mb-6"
          icon={
            <PageHeaderIcon
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              }
              gradient="linear-gradient(135deg, #00c4f4, #7c3aed)"
            />
          }
        />
      </div>

      {/* Main Scrollable History/Content Area */}
      <div
        ref={scrollAreaRef}
        className="flex-1 overflow-y-auto px-2 pb-8 [&::-webkit-scrollbar]:w-[6px] [&::-webkit-scrollbar-thumb]:rounded-[6px] [&::-webkit-scrollbar-thumb]:bg-[rgba(100,100,120,0.3)]"
      >
        <div className="mx-auto max-w-screen-md pt-4">
          {/* Empty State / Welcome Screen */}
          {threadMessages.length === 0 && !streaming && !streamContent && (
            <div className="mx-auto flex min-h-[50vh] max-w-screen-md flex-col items-center justify-center pt-10 pb-20">
              <div className="mb-6 rounded-full bg-[rgba(0,196,244,0.1)] p-4">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#00c4f4" strokeWidth="1.5">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p className="mb-2 text-2xl font-bold text-ink">How can I help you today?</p>
              <p className="mb-8 text-center text-sm text-ink-muted">
                Ask questions, generate reports, or investigate anomalies. Select equipment below to tailor your analysis.
              </p>

              {/* Quick Prompts */}
              {(() => {
                const prompts = buildAnalyzerPrompts(selectedEqObj || null);
                return (
                  <div className="w-full">
                    <div className="flex flex-wrap justify-center gap-3">
                      {prompts.map((p, i) => (
                        <button
                          type="button"
                          key={`${selectedEqObj?.id || "all"}-${i}`}
                          onClick={() => {
                            setQuestion(p);
                            handleAnalyze(p);
                          }}
                          className="w-full rounded-[12px] border border-border-subtle bg-elevated p-3 text-left transition-all hover:border-brand hover:bg-surface md:w-[calc(50%-12px)]"
                        >
                          <p className="text-xs font-medium text-ink">{p}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Historical Thread Messages */}
          {threadMessages.length > 0 && (
            <div className="mb-6">
              {threadMessages.map((m) => (
                <div
                  key={m.id}
                  className={`mb-6 flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-[16px] p-4 shadow-sm ${
                      m.role === "user"
                        ? "rounded-br-[4px] bg-brand text-white"
                        : "rounded-bl-[4px] border border-border-subtle bg-elevated text-ink"
                    }`}
                  >
                    {m.role === "assistant" ? (
                      <MarkdownRenderer content={m.content} components={markdownComponents} />
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Current Streaming Message */}
          <AnimatePresence>
            {(streaming || streamContent) && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25 }}
                className="mb-6"
              >
                <div className="flex justify-start">
                  <div className="w-full max-w-[95%] overflow-hidden rounded-[16px] rounded-bl-[4px] border border-border-subtle bg-elevated shadow-sm">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-border-subtle bg-[rgba(0,0,0,0.1)] px-5 py-3">
                      <div className="flex items-center gap-2">
                        {streaming ? (
                          <ThinkingDots />
                        ) : (
                          <div
                            className="size-2 rounded-full"
                            style={{ background: "#34d399", boxShadow: "0 0 6px rgba(16,185,129,0.6)" }}
                          />
                        )}
                        <p className="text-xs font-semibold text-ink-muted">
                          {streaming ? "Generating analysis…" : "Analysis complete"}
                        </p>
                      </div>
                      {streamMeta && (
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-flex items-center rounded-[6px] border px-2 text-[9px]"
                            style={{
                              background: "rgba(0,196,244,0.1)",
                              color: "#6671FF",
                              borderColor: "rgba(0,196,244,0.2)",
                            }}
                          >
                            {streamMeta.model}
                          </span>
                          <span className="inline-flex items-center rounded-[6px] border border-border-subtle bg-surface px-2 text-[9px] text-ink-muted">
                            {((streamMeta.total_ms ?? 0) / 1000).toFixed(1)}s
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Chart (Context) */}
                    {tsData && tsData.points && tsData.points.length > 0 && (
                      <div className="border-b border-border-subtle bg-canvas p-4">
                        <TimeseriesChart data={tsData} equipmentName={selectedEqObj?.name} loading={tsLoading} />
                      </div>
                    )}

                    {/* Markdown Content */}
                    <div className="px-5 py-5">
                      {streamContent ? (
                        <MarkdownRenderer content={streamContent} components={markdownComponents} />
                      ) : (
                        streaming && <ThinkingDots />
                      )}
                    </div>

                    {/* Verification Panel */}
                    {!streaming && (auditResult || verification) && (
                      <div className="px-5 pt-2">
                        <AuditPanel audit={auditResult} verification={verification} />
                      </div>
                    )}

                    {/* Citations & Feedback */}
                    {!streaming && citations.length > 0 && (
                      <div className={`px-5 pb-5 ${auditResult || verification ? "pt-2" : "pt-0"}`}>
                        <CitationsList chunks={citations} onOpen={openCitation} />
                      </div>
                    )}
                    {!streaming && streamMeta?.audit_id && (
                      <div className="px-5 pb-3">
                        <FeedbackBar auditId={streamMeta.audit_id} />
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Scroll Anchor */}
          <div ref={bottomRef} />
        </div>
      </div>
      {/* End Main Scrollable Area */}

      {/* Pinned Input Area */}
      <div className="mx-auto w-full max-w-screen-md shrink-0 pt-2">
        <ErrorAlert
          error={error}
          onDismiss={() => setError(null)}
          onRetry={() => {
            setError(null);
            handleAnalyze();
          }}
          mb={4}
        />

        {/* Context Pills Toolbar */}
        <div className="mb-3 flex gap-2 overflow-x-auto px-1 [&::-webkit-scrollbar]:hidden">
          <div className="min-w-[150px]">
            <GlassSelect
              value={selectedEq}
              onChange={(v) => setSelectedEq(String(v))}
              placeholder="All equipment"
              className="rounded-full bg-surface"
              options={[
                { value: "", label: "All equipment" },
                ...["chiller", "cooling_tower", "pump"].flatMap((type) =>
                  equipment.filter((e) => e.type === type).map((e) => ({ value: e.id, label: e.name })),
                ),
              ]}
            />
          </div>
          <div className="w-[130px]">
            <PeriodSelect value={hours} onChange={setHours} width="130px" />
          </div>
          <div className="min-w-[140px]">
            <GlassSelect
              value={activeThreadId}
              onChange={(v) => setActiveThreadId(String(v))}
              placeholder="Memory off"
              className="rounded-full bg-surface"
              options={[
                { value: "", label: "Memory off" },
                ...threads.map((t) => ({ value: t.id, label: t.title || t.id.slice(0, 8) })),
              ]}
            />
          </div>
          {activeThreadId && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleNewThread}
              className="shrink-0 rounded-full text-xs"
            >
              + New Chat
            </Button>
          )}
        </div>

        <GlassCard
          hover={false}
          className="rounded-[16px] p-3"
          style={{ boxShadow: "0 -4px 30px rgba(0,0,0,0.1)" } as CSSProperties}
        >
          <div>
            <Label htmlFor="analyzer-question" className="sr-only">
              Your question
            </Label>
            <Textarea
              id="analyzer-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value.slice(0, 2000))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleAnalyze();
              }}
              placeholder="Message AI Analyzer..."
              rows={1}
              maxLength={2000}
              className="max-h-[150px] min-h-[40px] resize-y border-none bg-transparent p-1 text-sm text-ink placeholder:text-ink-muted focus-visible:shadow-none focus-visible:ring-0"
            />
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-border-subtle pt-2">
            <p className="text-[10px] font-semibold text-ink-faint tabular-nums">
              {question.length} / 2000
            </p>

            <div className="flex items-center gap-2">
              {streaming && (
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => abortRef.current?.abort()}
                  className="min-h-[32px] rounded-[8px]"
                >
                  Stop
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => handleAnalyze()}
                disabled={streaming || question.trim().length === 0}
                className="min-h-[32px] rounded-[10px] px-4 text-xs font-semibold"
              >
                Send
              </Button>
            </div>
          </div>
        </GlassCard>
      </div>

      <CitationDrawer chunk={activeCitation} isOpen={drawerOpen} onClose={closeDrawer} />
    </PageShell>
  );
}
