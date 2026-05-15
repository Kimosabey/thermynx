import { useState, useEffect, useRef } from "react";
import {
  Box, Flex, Text, Textarea, Button, FormControl, FormLabel,
  HStack, Badge, Spinner, Select, Grid,
} from "@chakra-ui/react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import PageShell from "../../shared/ui/PageShell";
import PageHeader from "../../shared/ui/PageHeader";
import PageHeaderIcon from "../../shared/ui/PageHeaderIcon";
import Eyebrow from "../../shared/ui/Eyebrow";
import Chip from "../../shared/ui/Chip";
import PeriodSelect, { surfaceSelectProps } from "../../shared/ui/PeriodSelect";
import GlassCard from "../../shared/ui/GlassCard";
import ErrorAlert from "../../shared/ui/ErrorAlert";
import useAppToast from "../../shared/hooks/useAppToast";
import TimeseriesChart from "./TimeseriesChart";

const MotionBox = motion.create(Box);

const QUICK_PROMPTS = [
  "Analyze chiller efficiency and identify performance issues",
  "Why is kW/TR outside optimal range?",
  "Compare Chiller 1 vs Chiller 2 performance",
  "Are there any anomalies or alerts right now?",
  "Maintenance recommendations based on current data",
  "Summarize energy consumption and cooling output",
];

function MarkdownRenderer({ content }) {
  return (
    <Box
      overflow="hidden"
      maxW="100%"
      sx={{
        "h2,h3":   { fontWeight: 700, mt: 5, mb: 2, color: "text.primary" },
        h2:        { fontSize: "md", borderBottom: "1px solid", borderColor: "border.subtle", pb: 2 },
        h3:        { fontSize: "sm", color: "accent.cyan" },
        p:         { mb: 3, lineHeight: 1.8, color: "text.primary", fontSize: "sm", wordBreak: "break-word" },
        "ul,ol":   { pl: 5, mb: 3 },
        li:        { mb: 1, color: "text.primary", fontSize: "sm", wordBreak: "break-word" },
        strong:    { color: "text.primary", fontWeight: 600 },
        code:      { bg: "rgba(0,196,244,0.08)", px: "5px", py: "2px", borderRadius: "5px", fontSize: "0.82em", color: "brand.300", fontFamily: "mono", wordBreak: "break-all" },
        pre:       { bg: "rgba(0,0,0,0.4)", border: "1px solid", borderColor: "border.subtle", p: 4, borderRadius: "10px", overflowX: "auto", maxW: "100%", mb: 3, fontSize: "xs" },
        table:     { width: "100%", borderCollapse: "collapse", mb: 3, fontSize: "sm", display: "block", overflowX: "auto", maxW: "100%" },
        "th,td":   { border: "1px solid", borderColor: "border.subtle", px: 3, py: "6px", textAlign: "left" },
        th:        { bg: "bg.elevated", fontWeight: 600, fontSize: "xs", color: "text.muted" },
        td:        { color: "text.primary" },
        blockquote:{ borderLeft: "2px solid", borderColor: "accent.cyan", pl: 4, ml: 0, color: "text.muted", fontStyle: "italic", opacity: 0.8 },
        img:       { maxW: "100%", height: "auto" },
        a:         { color: "accent.cyan", wordBreak: "break-all" },
      }}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </Box>
  );
}

function ThinkingDots() {
  return (
    <Flex gap={1} align="center" py={1}>
      {[0, 1, 2].map((i) => (
        <MotionBox
          key={i}
          w="5px" h="5px"
          borderRadius="full"
          bg="brand.500"
          animate={{ y: [0, -5, 0], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </Flex>
  );
}

export default function AIAnalyzer() {
  const [equipment,    setEquipment]    = useState([]);
  const [selectedEq,   setSelectedEq]   = useState("");
  const [hours,        setHours]        = useState(24);
  const [question,     setQuestion]     = useState("");
  const [tsData,       setTsData]       = useState(null);
  const [tsLoading,    setTsLoading]    = useState(false);
  const [streamContent,setStreamContent]= useState("");
  const [streaming,    setStreaming]    = useState(false);
  const [streamDone,   setStreamDone]   = useState(false);
  const [streamMeta,   setStreamMeta]   = useState(null);
  const [error,        setError]        = useState(null);

  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState("");
  const [threadMessages, setThreadMessages] = useState([]);

  const abortRef   = useRef(null);
  const bottomRef  = useRef(null);
  const threadRef  = useRef("");
  const toast      = useAppToast();

  useEffect(() => { threadRef.current = activeThreadId; }, [activeThreadId]);

  async function refreshThreads() {
    try {
      const r = await fetch("/api/v1/threads");
      const j = await r.json();
      setThreads(j.threads || []);
    } catch { /* ignore */ }
  }

  async function handleNewThread() {
    try {
      const r = await fetch("/api/v1/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const j = await r.json();
      await refreshThreads();
      setActiveThreadId(j.id);
      setThreadMessages([]);
      toast.success("New conversation started");
    } catch {
      toast.error("Could not create thread", "Check the backend connection");
    }
  }

  useEffect(() => { refreshThreads(); }, []);

  useEffect(() => {
    if (!activeThreadId) {
      setThreadMessages([]);
      return;
    }
    fetch(`/api/v1/threads/${activeThreadId}/messages`)
      .then((r) => r.json())
      .then((d) => setThreadMessages(d.messages || []))
      .catch(() => setThreadMessages([]));
  }, [activeThreadId]);

  useEffect(() => {
    fetch("/api/v1/equipment")
      .then((r) => r.json())
      .then(setEquipment)
      .catch(() => toast.error("Could not load equipment list"));
  }, []);

  useEffect(() => {
    if (!selectedEq) return;
    setTsData(null);
    setTsLoading(true);
    fetch(`/api/v1/equipment/${selectedEq}/timeseries?hours=${hours}&resolution=15m`)
      .then((r) => r.json())
      .then((d) => { setTsData(d); setTsLoading(false); })
      .catch(() => setTsLoading(false));
  }, [selectedEq, hours]);

  // Auto-scroll while streaming
  useEffect(() => {
    if (streaming) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [streamContent]);

  async function handleAnalyze() {
    if (!question.trim()) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setStreaming(true);
    setStreamDone(false);
    setStreamContent("");
    setStreamMeta(null);
    setError(null);

    try {
      const res = await fetch("/api/v1/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          equipment_id: selectedEq || null,
          hours,
          thread_id: activeThreadId || null,
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `HTTP ${res.status}`);

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let evt;
          try {
            evt = JSON.parse(line.slice(6));
          } catch {
            continue;
          }
          if (evt.type === "token") setStreamContent((p) => p + evt.content);
          if (evt.type === "done") {
            setStreamMeta(evt);
            setStreamDone(true);
            const tid = threadRef.current;
            if (tid) {
              fetch(`/api/v1/threads/${tid}/messages`)
                .then((r) => r.json())
                .then((d) => setThreadMessages(d.messages || []))
                .catch(() => {});
              refreshThreads();
            }
          }
          if (evt.type === "error") throw new Error(evt.detail || "Stream error");
        }
      }
    } catch (e) {
      if (e.name !== "AbortError") setError(e.message);
    } finally {
      setStreaming(false);
    }
  }

  const selectedEqObj = equipment.find((e) => e.id === selectedEq);

  return (
    <PageShell maxW="1100px">
      <PageHeader
        title="AI Analyzer"
        subtitle="Ask anything about your HVAC plant — powered by local AI"
        mb={6}
        icon={
          <PageHeaderIcon
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            }
            gradient="linear-gradient(135deg, #00c4f4, #7c3aed)"
          />
        }
      />

      {/* Equipment + Time + Thread */}
      <Flex gap={3} mb={5} flexWrap="wrap">
        <FormControl flex="1" minW="180px">
          <FormLabel htmlFor="analyzer-equipment" fontSize="10px" letterSpacing="0.10em" textTransform="uppercase" color="text.muted" fontWeight={700} mb={2}>
            Equipment
          </FormLabel>
          <Select
            id="analyzer-equipment"
            placeholder="All equipment"
            value={selectedEq}
            onChange={(e) => setSelectedEq(e.target.value)}
            {...surfaceSelectProps}
            _hover={{ borderColor: "accent.cyan" }}
          >
            {["chiller", "cooling_tower", "pump"].map((type) => {
              const group = equipment.filter((e) => e.type === type);
              if (!group.length) return null;
              return (
                <optgroup key={type} label={type === "chiller" ? "Chillers" : type === "cooling_tower" ? "Cooling Towers" : "Pumps"}>
                  {group.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </optgroup>
              );
            })}
          </Select>
        </FormControl>

        <FormControl w="auto">
          <FormLabel htmlFor="analyzer-period" fontSize="10px" letterSpacing="0.10em" textTransform="uppercase" color="text.muted" fontWeight={700} mb={2}>
            Time window
          </FormLabel>
          <PeriodSelect id="analyzer-period" value={hours} onChange={setHours} width="140px" />
        </FormControl>

        <FormControl flex="1" minW="220px">
          <FormLabel htmlFor="analyzer-thread" fontSize="10px" letterSpacing="0.10em" textTransform="uppercase" color="text.muted" fontWeight={700} mb={2}>
            Conversation thread
          </FormLabel>
          <Flex gap={2} flexWrap="wrap">
            <Select
              id="analyzer-thread"
              placeholder="Memory off"
              value={activeThreadId}
              onChange={(e) => setActiveThreadId(e.target.value)}
              flex={1}
              minW="160px"
              {...surfaceSelectProps}
            >
              <option value="">Memory off</option>
              {threads.map((t) => (
                <option key={t.id} value={t.id}>{t.title || t.id.slice(0, 8)}</option>
              ))}
            </Select>
            <Button size="sm" variant="outline" borderRadius="10px" fontSize="xs" onClick={handleNewThread} minH="40px">
              New thread
            </Button>
          </Flex>
        </FormControl>
      </Flex>

      {threadMessages.length > 0 && (
        <GlassCard mb={5} p={4} maxH="220px" overflowY="auto">
          <Text fontSize="9px" fontWeight={700} color="text.muted" mb={3}>Thread history</Text>
          {threadMessages.map((m) => (
            <Box key={m.id} mb={3} pb={3} borderBottom="1px solid" borderColor="border.subtle">
              <Text fontSize="9px" color="accent.cyan" fontWeight={700} mb={1}>{m.role}</Text>
              <Text fontSize="xs" color="text.primary" whiteSpace="pre-wrap">
                {m.content.slice(0, 4000)}{m.content.length > 4000 ? "…" : ""}
              </Text>
            </Box>
          ))}
        </GlassCard>
      )}

      {/* Chart */}
      <Box mb={5}>
        <TimeseriesChart data={tsData} equipmentName={selectedEqObj?.name} loading={tsLoading} />
      </Box>

      {/* Quick prompts */}
      <Flex flexWrap="wrap" gap={2} mb={5}>
        {QUICK_PROMPTS.map((p, i) => (
          <Chip key={i} onClick={() => setQuestion(p)}>{p}</Chip>
        ))}
      </Flex>

      {/* Input */}
      <GlassCard p={4} mb={4}>
        <FormControl>
          <FormLabel htmlFor="analyzer-question" srOnly>Your question about HVAC operations</FormLabel>
          <Textarea
            id="analyzer-question"
            value={question}
            onChange={(e) => setQuestion(e.target.value.slice(0, 2000))}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleAnalyze(); }}
            placeholder="Ask about chiller efficiency, energy consumption, anomalies, maintenance…"
            rows={3}
            resize="vertical"
            border="none"
            bg="transparent"
            _focus={{ outline: "none", boxShadow: "none" }}
            fontSize="sm"
            color="text.primary"
            p={0}
            _placeholder={{ color: "text.muted" }}
            aria-describedby="analyzer-question-count"
            maxLength={2000}
          />
        </FormControl>
        <Flex justify="space-between" align="center" mt={3} pt={3} borderTop="1px solid" borderColor="border.subtle" flexWrap="wrap" gap={2}>
          <HStack spacing={3}>
            <Text fontSize="xs" color="text.muted">Ctrl+Enter to send</Text>
            <Text
              id="analyzer-question-count"
              fontSize="10px"
              fontWeight={600}
              color={question.length >= 2000 ? "status.bad" : question.length > 1700 ? "status.warn" : "text.faint"}
              sx={{ fontVariantNumeric: "tabular-nums" }}
              aria-live="polite"
            >
              {question.length} / 2000
            </Text>
          </HStack>
          <HStack spacing={2}>
            {streaming && (
              <MotionBox whileTap={{ scale: 0.95 }}>
                <Button
                  size="sm" variant="glass"
                  onClick={() => abortRef.current?.abort()}
                  borderRadius="9px" fontSize="xs"
                  aria-label="Stop generation"
                  minH="40px"
                >
                  Stop
                </Button>
              </MotionBox>
            )}
            <MotionBox whileTap={{ scale: 0.95 }}>
              <Button
                size="sm" onClick={handleAnalyze}
                isLoading={streaming} loadingText="Analyzing…"
                borderRadius="9px" fontSize="xs" fontWeight={600}
                px={5}
                minH="40px"
                isDisabled={!question.trim()}
              >
                Analyze
              </Button>
            </MotionBox>
          </HStack>
        </Flex>
      </GlassCard>

      <ErrorAlert
        error={error}
        onDismiss={() => setError(null)}
        onRetry={() => { setError(null); handleAnalyze(); }}
        mb={4}
      />

      {/* Streaming response — chat bubble */}
      <AnimatePresence>
        {(streaming || streamContent) && (
          <MotionBox
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
          >
            <GlassCard p={0} overflow="hidden" glow={streamDone}>
              {/* Response header */}
              <Flex
                px={5} py={3}
                borderBottom="1px solid" borderColor="border.subtle"
                align="center" justify="space-between"
                flexWrap="wrap" gap={2}
                bg="bg.elevated"
              >
                <Flex align="center" gap={2}>
                  {streaming
                    ? <ThinkingDots />
                    : <Box w={2} h={2} borderRadius="full" bg="green.400" boxShadow="0 0 6px rgba(16,185,129,0.6)" />
                  }
                  <Text fontSize="xs" fontWeight={600} color="text.muted">
                    {streaming ? "Generating analysis…" : "Analysis complete"}
                  </Text>
                </Flex>
                {streamMeta && (
                  <HStack spacing={2}>
                    <Badge fontSize="9px" bg="rgba(0,196,244,0.1)" color="brand.400" border="1px solid rgba(0,196,244,0.2)" borderRadius="6px" px={2} maxW={{ base: "140px", md: "240px" }} title={streamMeta.model}>
                      <Text as="span" fontSize="inherit" noOfLines={1}>{streamMeta.model}</Text>
                    </Badge>
                    <Badge fontSize="9px" bg="bg.surface" color="text.muted" border="1px solid" borderColor="border.subtle" borderRadius="6px" px={2}>
                      {(streamMeta.total_ms / 1000).toFixed(1)}s
                    </Badge>
                  </HStack>
                )}
              </Flex>

              {/* kW/TR mini stats if chiller selected */}
              {tsData?.type === "chiller" && tsData.points?.length > 0 && (() => {
                const pts  = tsData.points.filter((p) => p.kw_per_tr != null);
                const avg  = pts.length ? pts.reduce((s, p) => s + p.kw_per_tr, 0) / pts.length : null;
                const load = tsData.points.filter((p) => p.chiller_load != null);
                const avgL = load.length ? load.reduce((s, p) => s + p.chiller_load, 0) / load.length : null;
                return (
                  <Grid
                    templateColumns={{ base: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" }}
                    borderBottom="1px solid"
                    borderColor="border.subtle"
                  >
                    {[
                      { l: `${selectedEqObj?.name} kW/TR`, v: avg?.toFixed(3), isEff: true, eff: avg },
                      { l: "Avg Load",    v: avgL ? `${avgL.toFixed(1)}%` : null },
                      { l: "Data points", v: tsData.count },
                      { l: "Window",      v: `${tsData.hours}h` },
                    ].map((item, i) => (
                      <Box
                        key={i}
                        px={{ base: 3, md: 4 }}
                        py={3}
                        borderRight={{ lg: i < 3 ? "1px solid" : "none" }}
                        borderColor="border.subtle"
                        minW={0}
                      >
                        <Text fontSize="9px" color="text.muted" textTransform="uppercase" fontWeight={700} letterSpacing="0.1em">{item.l}</Text>
                        <Text fontSize="lg" fontWeight={700} sx={{ fontVariantNumeric: "tabular-nums" }}
                          color={item.isEff && item.eff ? (item.eff < 0.65 ? "green.400" : item.eff < 0.85 ? "yellow.400" : "red.400") : "text.primary"}>
                          {item.v ?? "—"}
                        </Text>
                      </Box>
                    ))}
                  </Grid>
                );
              })()}

              {/* Markdown content — live region so screen readers hear streaming output */}
              <Box
                px={{ base: 4, md: 6 }}
                py={5}
                role="log"
                aria-live="polite"
                aria-atomic="false"
                aria-relevant="additions text"
                aria-busy={streaming}
                aria-label="AI analysis response"
              >
                {streamContent
                  ? <MarkdownRenderer content={streamContent} />
                  : streaming && <ThinkingDots />
                }
                <div ref={bottomRef} />
              </Box>
            </GlassCard>
          </MotionBox>
        )}
      </AnimatePresence>
    </PageShell>
  );
}
