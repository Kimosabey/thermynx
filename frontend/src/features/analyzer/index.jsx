import { useState, useEffect, useRef } from "react";
import {
  Box, Flex, Heading, Text, Textarea, Button,
  HStack, Badge, Spinner, Select, Grid, useToast,
} from "@chakra-ui/react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import GlassCard from "../../shared/ui/GlassCard";
import TimeseriesChart from "./TimeseriesChart";

const MotionBox = motion(Box);

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
      sx={{
        "h2,h3":   { fontWeight: 700, mt: 5, mb: 2, color: "text.primary" },
        h2:        { fontSize: "md", borderBottom: "1px solid", borderColor: "border.subtle", pb: 2 },
        h3:        { fontSize: "sm", color: "accent.cyan" },
        p:         { mb: 3, lineHeight: 1.8, color: "text.primary", fontSize: "sm" },
        "ul,ol":   { pl: 5, mb: 3 },
        li:        { mb: 1, color: "text.primary", fontSize: "sm" },
        strong:    { color: "white", fontWeight: 600 },
        code:      { bg: "rgba(0,196,244,0.08)", px: "5px", py: "2px", borderRadius: "5px", fontSize: "0.82em", color: "brand.300", fontFamily: "mono" },
        pre:       { bg: "rgba(0,0,0,0.4)", border: "1px solid", borderColor: "border.subtle", p: 4, borderRadius: "10px", overflowX: "auto", mb: 3, fontSize: "xs" },
        table:     { width: "100%", borderCollapse: "collapse", mb: 3, fontSize: "sm" },
        "th,td":   { border: "1px solid", borderColor: "border.subtle", px: 3, py: "6px", textAlign: "left" },
        th:        { bg: "bg.elevated", fontWeight: 600, fontSize: "xs", color: "text.muted" },
        td:        { color: "text.primary" },
        blockquote:{ borderLeft: "2px solid", borderColor: "accent.cyan", pl: 4, ml: 0, color: "text.muted", fontStyle: "italic", opacity: 0.8 },
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

  const abortRef   = useRef(null);
  const bottomRef  = useRef(null);
  const toast      = useToast();

  useEffect(() => {
    fetch("/api/v1/equipment")
      .then((r) => r.json())
      .then(setEquipment)
      .catch(() => toast({ title: "Could not load equipment list", status: "error", duration: 3000 }));
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
        body: JSON.stringify({ question: question.trim(), equipment_id: selectedEq || null, hours }),
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
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.type === "token")  setStreamContent((p) => p + evt.content);
            if (evt.type === "done")  { setStreamMeta(evt); setStreamDone(true); }
            if (evt.type === "error") throw new Error(evt.detail);
          } catch { /* skip malformed */ }
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
    <Box p={{ base: 4, md: 8 }} maxW="1100px">

      {/* Header */}
      <Flex align="center" gap={3} mb={6}>
        <Box
          w="38px" h="38px" borderRadius="10px" flexShrink={0}
          bg="linear-gradient(135deg, #00c4f4, #7c3aed)"
          display="flex" alignItems="center" justifyContent="center"
          boxShadow="0 0 20px rgba(0,196,244,0.25)"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </Box>
        <Box>
          <Heading size="md" fontWeight={800} color="text.primary" letterSpacing="-0.02em">
            AI Analyzer
          </Heading>
          <Text color="text.muted" fontSize="xs">Ask anything about your HVAC plant — powered by local AI</Text>
        </Box>
      </Flex>

      {/* Equipment + Time selectors */}
      <Flex gap={3} mb={5} flexWrap="wrap">
        <Box flex="1" minW="180px">
          <Text fontSize="9px" fontWeight={700} color="text.muted" textTransform="uppercase" letterSpacing="0.12em" mb={2}>
            Equipment
          </Text>
          <Select
            placeholder="All equipment"
            value={selectedEq}
            onChange={(e) => setSelectedEq(e.target.value)}
            size="sm"
            bg="bg.surface"
            border="1px solid"
            borderColor="border.subtle"
            borderRadius="10px"
            color="text.primary"
            _hover={{ borderColor: "accent.cyan" }}
            _focus={{ borderColor: "accent.cyan", boxShadow: "0 0 0 1px var(--chakra-colors-brand-500)" }}
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
        </Box>

        <Box>
          <Text fontSize="9px" fontWeight={700} color="text.muted" textTransform="uppercase" letterSpacing="0.12em" mb={2}>
            Time window
          </Text>
          <Select
            size="sm" value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            bg="bg.surface" border="1px solid" borderColor="border.subtle"
            borderRadius="10px" color="text.primary" w="140px"
            _hover={{ borderColor: "accent.cyan" }}
          >
            <option value={6}>Last 6 hours</option>
            <option value={12}>Last 12 hours</option>
            <option value={24}>Last 24 hours</option>
            <option value={48}>Last 48 hours</option>
            <option value={168}>Last 7 days</option>
          </Select>
        </Box>
      </Flex>

      {/* Chart */}
      <Box mb={5}>
        <TimeseriesChart data={tsData} equipmentName={selectedEqObj?.name} loading={tsLoading} />
      </Box>

      {/* Quick prompts */}
      <Flex flexWrap="wrap" gap={2} mb={5}>
        {QUICK_PROMPTS.map((p, i) => (
          <MotionBox key={i} whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}>
            <Box
              as="button"
              onClick={() => setQuestion(p)}
              fontSize="xs" color="text.muted"
              bg="bg.surface" border="1px solid" borderColor="border.subtle"
              borderRadius="full" px={3} py="6px"
              _hover={{ borderColor: "accent.cyan", color: "accent.cyan", bg: "accent.glow" }}
              transition="all 0.15s"
              textAlign="left"
            >
              {p}
            </Box>
          </MotionBox>
        ))}
      </Flex>

      {/* Input */}
      <GlassCard p={4} mb={4}>
        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
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
        />
        <Flex justify="space-between" align="center" mt={3} pt={3} borderTop="1px solid" borderColor="border.subtle">
          <Text fontSize="xs" color="text.muted">Ctrl+Enter to send</Text>
          <HStack spacing={2}>
            {streaming && (
              <MotionBox whileTap={{ scale: 0.95 }}>
                <Button size="sm" variant="glass" onClick={() => abortRef.current?.abort()} borderRadius="9px" fontSize="xs">
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
              >
                Analyze
              </Button>
            </MotionBox>
          </HStack>
        </Flex>
      </GlassCard>

      {error && (
        <GlassCard mb={4} p={3}>
          <Text color="red.400" fontSize="sm">{error}</Text>
        </GlassCard>
      )}

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
                    <Badge fontSize="9px" bg="rgba(0,196,244,0.1)" color="brand.400" border="1px solid rgba(0,196,244,0.2)" borderRadius="6px" px={2}>
                      {streamMeta.model}
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
                  <Grid templateColumns="repeat(4, 1fr)" borderBottom="1px solid" borderColor="border.subtle">
                    {[
                      { l: `${selectedEqObj?.name} kW/TR`, v: avg?.toFixed(3), isEff: true, eff: avg },
                      { l: "Avg Load",    v: avgL ? `${avgL.toFixed(1)}%` : null },
                      { l: "Data points", v: tsData.count },
                      { l: "Window",      v: `${tsData.hours}h` },
                    ].map((item, i) => (
                      <Box key={i} px={4} py={3} borderRight={i < 3 ? "1px solid" : "none"} borderColor="border.subtle">
                        <Text fontSize="9px" color="text.muted" textTransform="uppercase" fontWeight={700} letterSpacing="0.1em">{item.l}</Text>
                        <Text fontSize="lg" fontWeight={700} fontVariantNumeric="tabular-nums"
                          color={item.isEff && item.eff ? (item.eff < 0.65 ? "green.400" : item.eff < 0.85 ? "yellow.400" : "red.400") : "text.primary"}>
                          {item.v ?? "—"}
                        </Text>
                      </Box>
                    ))}
                  </Grid>
                );
              })()}

              {/* Markdown content */}
              <Box px={{ base: 4, md: 6 }} py={5}>
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
    </Box>
  );
}
