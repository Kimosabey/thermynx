import { useState, useMemo, useRef, useEffect } from "react";
import {
  Box, Flex, Text, Textarea, Button, Grid, Badge, Spinner,
  useColorMode, useToast,
} from "@chakra-ui/react";
import { Sparkles, Play, Database, AlertCircle, BarChart3, Table as TableIcon, X, Zap, Layers, Flame } from "lucide-react";
import { motion } from "framer-motion";
import ReactECharts from "echarts-for-react";
import PageShell from "../../shared/ui/PageShell";
import PageHeader from "../../shared/ui/PageHeader";
import PageHeaderIcon from "../../shared/ui/PageHeaderIcon";
import GlassCard from "../../shared/ui/GlassCard";
import Eyebrow from "../../shared/ui/Eyebrow";

const MotionBox = motion.create(Box);

function buildExamples(equipment) {
  // Examples are derived from the real equipment list so they always match
  // what's actually queryable. Time phrasing avoids "now" because the
  // dataset's latest slot may be days/weeks old.
  if (!equipment?.length) return { simple: [], medium: [], complex: [] };

  const chillers = equipment.filter(e => e.type === "chiller");
  const towers   = equipment.filter(e => e.type === "cooling_tower");
  const pumps    = equipment.filter(e => e.type === "pump");
  const ch1 = chillers[0];
  const ch2 = chillers[1];
  const tw1 = towers[0];
  const tw2 = towers[1];
  const pp1 = pumps[0];

  const simple = [];
  const medium = [];
  const complex = [];

  // ── Simple — single equipment, single metric, no aggregation ────────────────
  if (ch1)        simple.push(`Show the most recent 50 kW/TR readings for ${ch1.name}`);
  if (ch1)        simple.push(`What was the latest evaporator leaving temperature for ${ch1.name}?`);
  if (tw1)        simple.push(`Show the last 24 hours of kW for ${tw1.name}`);
  if (pp1)        simple.push(`Latest 100 power readings for ${pp1.name}`);
  if (ch2)        simple.push(`Show all readings where ${ch2.name} kW/TR is above 1.0 in the last week`);
  if (ch1)        simple.push(`How many hours of data do we have for ${ch1.name} in the last 30 days?`);

  // ── Medium — aggregation, grouping, or filtering ────────────────────────────
  if (ch1 && ch2) medium.push(`Compare average kW for ${ch1.name} and ${ch2.name} over the last 7 days of data`);
  if (tw1)        medium.push(`What is the run percentage of ${tw1.name} over the latest 7 days in the dataset?`);
  if (ch1)        medium.push(`Top 10 hours of highest energy use for ${ch1.name} from the available data`);
  if (pp1)        medium.push(`Average kW for ${pp1.name} grouped by hour-of-day over the last 30 days of data`);
  if (ch2)        medium.push(`How many hours did ${ch2.name} spend in the poor efficiency band (kW/TR > 0.75)?`);
  if (ch1)        medium.push(`Average chilled water delta-T per day for ${ch1.name} over the last 14 days`);
  if (tw1)        medium.push(`Daily total kWh for ${tw1.name} over the last 30 days`);
  if (ch1)        medium.push(`What hour of the day has the highest average kW for ${ch1.name} over the last month?`);

  // ── Complex — multi-equipment, multi-metric, joins, window-style logic ──────
  if (ch1 && ch2) complex.push(`Which chiller — ${ch1.name} or ${ch2.name} — had better average efficiency over the last 30 days, and by how much?`);
  if (ch1)        complex.push(`For ${ch1.name}, show daily average kW/TR alongside daily average chiller load over the last 14 days`);
  if (tw1 && tw2) complex.push(`Daily total kWh for ${tw1.name} and ${tw2.name} side by side for the last 7 days`);
  if (ch1 && tw1) complex.push(`On hours where ${ch1.name} was running, what was the average ${tw1.name} kW over the last 7 days?`);
  if (ch1)        complex.push(`For ${ch1.name}, find the hours where condenser approach (cond_leaving - cond_entering) exceeded 5°C in the last 14 days`);
  if (ch1 && ch2) complex.push(`How many hours in the last 7 days did both ${ch1.name} and ${ch2.name} run simultaneously?`);
  if (ch1)        complex.push(`Show the worst-performing 20 hours by kW/TR for ${ch1.name}, with timestamp, kW, TR, and load percentage, in the last 30 days`);
  if (pp1 && tw1) complex.push(`Average kW for ${pp1.name} versus ${tw1.name} grouped by day-of-week over the last 30 days`);
  if (ch1)        complex.push(`Count anomalous hours where ${ch1.name} kW/TR was more than 1.5x its 7-day moving average (last 14 days)`);

  return { simple, medium, complex };
}

function pickSeries(rows, columns) {
  if (!rows.length || columns.length < 2) return null;
  // Try to detect a time column + a numeric column
  const timeCol = columns.find(c => /time|date|slot|hour|day/i.test(c)) || columns[0];
  const numericCol = columns.find(c => c !== timeCol && typeof rows[0][c] === "number");
  if (!numericCol) return null;
  return { timeCol, numericCol };
}

export default function NLQueryPage() {
  const { colorMode } = useColorMode();
  const isDark = colorMode === "dark";
  const toast  = useToast();
  const taRef  = useRef(null);

  const [question, setQuestion] = useState("");
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState(null);
  const [equipment, setEquipment] = useState([]);

  useEffect(() => {
    fetch("/api/v1/equipment").then(r => r.ok ? r.json() : []).then(setEquipment).catch(() => setEquipment([]));
  }, []);

  const examples = useMemo(() => buildExamples(equipment), [equipment]);

  function handleClear() {
    setQuestion("");
    setResult(null);
    setError(null);
    taRef.current?.focus();
  }

  async function run(q) {
    const text = (q ?? question).trim();
    if (text.length < 3) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const r = await fetch("/api/v1/nl-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ question: text }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data?.detail || `HTTP ${r.status}`);
      }
      const data = await r.json();
      setResult(data);
      toast({
        title: `Returned ${data.row_count} row${data.row_count === 1 ? "" : "s"} in ${data.elapsed_ms}ms`,
        status: "success", duration: 2500, isClosable: true, position: "bottom-right",
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const chartOption = useMemo(() => {
    if (!result?.rows?.length) return null;
    const meta = pickSeries(result.rows, result.columns);
    if (!meta) return null;
    const xData = result.rows.map(r => r[meta.timeCol]);
    const yData = result.rows.map(r => r[meta.numericCol]);
    return {
      animation: true, animationDuration: 600,
      grid: { top: 16, right: 16, bottom: 28, left: 50 },
      xAxis: {
        type: "category", data: xData,
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { fontSize: 10, color: isDark ? "#9D9DAA" : "#334155", hideOverlap: true },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { fontSize: 10, color: isDark ? "#9D9DAA" : "#334155" },
        splitLine: { lineStyle: { color: isDark ? "rgba(255,255,255,0.05)" : "rgba(31,63,254,0.06)", type: "dashed" } },
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: isDark ? "#0d1526" : "#fff",
        borderColor:     isDark ? "#1e2d4a" : "#E0E7FF",
        borderRadius: 10, padding: [8, 12],
        textStyle: { fontSize: 11, color: isDark ? "#fff" : "#0D0D0D" },
      },
      series: [{
        name: meta.numericCol, type: "line", data: yData,
        smooth: true, symbol: "none",
        lineStyle: { color: "#1F3FFE", width: 2 },
        areaStyle: {
          color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0.05, color: "rgba(31,63,254,0.20)" },
              { offset: 0.95, color: "rgba(31,63,254,0)" },
            ],
          },
        },
      }],
    };
  }, [result, isDark]);

  return (
    <PageShell>
      <PageHeader
        title="Natural Language Query"
        icon={<PageHeaderIcon icon={<Sparkles size={20} strokeWidth={1.85} />} />}
        subtitle="Ask the plant in plain English — agent generates safe read-only SQL and returns results"
      />

      <GlassCard p={5} mb={6}>
        <Eyebrow mb={2}>Your question</Eyebrow>
        <Textarea
          ref={taRef}
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") run();
          }}
          placeholder="e.g. Show average kW/TR for chiller 1 in the last 6 hours"
          rows={2}
          resize="vertical"
          mb={3}
        />
        <Flex justify="space-between" gap={3} align="center" wrap="wrap">
          <Text fontSize="11px" color="text.muted">
            ⌘/Ctrl+Enter to run · Only SELECT against telemetry tables · Hard 10s query timeout · Max 1000 rows
          </Text>
          <Flex gap={2}>
            <Button
              leftIcon={<X size={14} strokeWidth={2.2} />}
              onClick={handleClear}
              isDisabled={loading || (!question && !result && !error)}
              variant="outline"
              size="sm"
            >
              Clear
            </Button>
            <Button
              leftIcon={loading ? <Spinner size="xs" /> : <Play size={14} strokeWidth={2.2} />}
              onClick={() => run()}
              isDisabled={loading || question.trim().length < 3}
              colorScheme="brand"
              size="sm"
            >
              {loading ? "Generating…" : "Run query"}
            </Button>
          </Flex>
        </Flex>
      </GlassCard>

      {/* Templates — grouped by complexity, generated from the real equipment list */}
      {!result && !error && (examples.simple.length + examples.medium.length + examples.complex.length) > 0 && (
        <Box mb={6}>
          <Eyebrow mb={3}>Templates — generated from the {equipment.length} assets in your plant</Eyebrow>

          {[
            { key: "simple",  label: "Simple",  Icon: Zap,    color: "#10b981", desc: "Single equipment · one metric · no aggregation",  items: examples.simple },
            { key: "medium",  label: "Medium",  Icon: Layers, color: "#1F3FFE", desc: "Aggregation · grouping · filters",                items: examples.medium },
            { key: "complex", label: "Complex", Icon: Flame,  color: "#a855f7", desc: "Multi-equipment · multi-metric · joins · windows", items: examples.complex },
          ].map(group => group.items.length > 0 && (
            <Box key={group.key} mb={5}>
              <Flex align="center" gap={2} mb={3}>
                <group.Icon size={14} strokeWidth={2.2} color={group.color} />
                <Text fontSize="xs" fontWeight={700} color="text.primary" textTransform="uppercase" letterSpacing="0.08em">
                  {group.label}
                </Text>
                <Text fontSize="11px" color="text.muted">— {group.desc}</Text>
                <Badge ml="auto" fontSize="9px" bg="bg.chip" color="text.muted" border="1px solid" borderColor="border.subtle" borderRadius="6px" px={2}>
                  {group.items.length}
                </Badge>
              </Flex>
              <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }} gap={3}>
                {group.items.map((ex, i) => (
                  <MotionBox
                    key={ex}
                    whileHover={{ y: -1 }}
                    transition={{ duration: 0.15 }}
                  >
                    <GlassCard
                      as="button"
                      textAlign="left"
                      p={4}
                      w="100%"
                      cursor="pointer"
                      _hover={{ borderColor: "border.brand" }}
                      onClick={() => { setQuestion(ex); taRef.current?.focus(); }}
                    >
                      <Flex align="center" gap={2} mb={1}>
                        <group.Icon size={11} strokeWidth={2} color={group.color} />
                        <Eyebrow>{group.label} · Example {i + 1}</Eyebrow>
                      </Flex>
                      <Text fontSize="sm" color="text.primary">{ex}</Text>
                    </GlassCard>
                  </MotionBox>
                ))}
              </Grid>
            </Box>
          ))}
        </Box>
      )}

      {/* Error */}
      {error && (
        <MotionBox initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard p={4} mb={4} borderColor="rgba(239,68,68,0.32)" border="1px solid">
            <Flex align="center" gap={3}>
              <Box color="status.bad"><AlertCircle size={18} /></Box>
              <Box>
                <Eyebrow color="#ef4444">Query refused</Eyebrow>
                <Text fontSize="sm" color="text.primary" mt={1}>{error}</Text>
              </Box>
            </Flex>
          </GlassCard>
        </MotionBox>
      )}

      {/* Result */}
      {result && (
        <MotionBox initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          {/* Generated SQL */}
          <GlassCard p={4} mb={4}>
            <Flex align="center" gap={2} mb={2}>
              <Database size={14} strokeWidth={2} color="#1F3FFE" />
              <Eyebrow>Generated SQL</Eyebrow>
              <Badge ml="auto" fontSize="9px" bg="bg.chip" color="text.muted" border="1px solid" borderColor="border.subtle" borderRadius="6px" px={2}>
                {result.row_count} rows · {result.elapsed_ms}ms
              </Badge>
            </Flex>
            <Box
              as="pre"
              bg="bg.chip"
              border="1px solid"
              borderColor="border.subtle"
              borderRadius="8px"
              p={3}
              fontSize="12px"
              fontFamily="mono"
              color="text.primary"
              overflowX="auto"
              whiteSpace="pre-wrap"
            >
              {result.sql}
            </Box>
            {result.warnings?.length > 0 && (
              <Text mt={2} fontSize="10px" color="status.warn">
                ⚠ {result.warnings.join(" · ")}
              </Text>
            )}
          </GlassCard>

          {/* Chart */}
          {chartOption && (
            <GlassCard p={0} overflow="hidden" mb={4}>
              <Flex px={5} pt={4} pb={3} align="center" gap={2}>
                <BarChart3 size={14} strokeWidth={2} color="#1F3FFE" />
                <Eyebrow>Auto-visualization</Eyebrow>
              </Flex>
              <ReactECharts option={chartOption} style={{ height: "240px", width: "100%" }} opts={{ renderer: "canvas" }} />
            </GlassCard>
          )}

          {/* Table */}
          <GlassCard p={0} overflow="hidden">
            <Flex px={5} pt={4} pb={3} align="center" gap={2}>
              <TableIcon size={14} strokeWidth={2} color="#1F3FFE" />
              <Eyebrow>Results</Eyebrow>
            </Flex>
            <Box overflowX="auto">
              <Box as="table" minW="600px" w="100%" fontSize="xs">
                <Box as="thead">
                  <Box as="tr" borderBottom="1px solid" borderColor="border.subtle">
                    {result.columns.map(c => (
                      <Box key={c} as="th" textAlign="left" px={4} py={2}
                        color="text.muted" textTransform="uppercase" letterSpacing="0.08em" fontWeight={700} fontSize="10px">
                        {c}
                      </Box>
                    ))}
                  </Box>
                </Box>
                <Box as="tbody">
                  {result.rows.slice(0, 200).map((row, i) => (
                    <Box as="tr" key={i} borderBottom="1px solid" borderColor="border.subtle"
                      _hover={{ bg: "rgba(31,63,254,0.04)" }}>
                      {result.columns.map(c => (
                        <Box as="td" key={c} px={4} py="6px" color="text.primary" sx={{ fontVariantNumeric: "tabular-nums" }}>
                          {row[c] == null ? "—" : typeof row[c] === "number" ? Number(row[c]).toLocaleString() : String(row[c])}
                        </Box>
                      ))}
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>
            {result.rows.length > 200 && (
              <Text px={5} py={2} fontSize="10px" color="text.muted">
                Showing first 200 of {result.row_count} rows
              </Text>
            )}
          </GlassCard>
        </MotionBox>
      )}
    </PageShell>
  );
}
