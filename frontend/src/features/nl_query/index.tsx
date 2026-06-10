import { useState, useMemo, useRef, type KeyboardEvent } from "react";
import {
  Sparkles,
  Play,
  Database,
  AlertCircle,
  BarChart3,
  Table as TableIcon,
  X,
  Zap,
  Layers,
  Flame,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { motion } from "framer-motion";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";

import PageShell from "@/shared/ui/PageShell";
import PageHeader from "@/shared/ui/PageHeader";
import PageHeaderIcon from "@/shared/ui/PageHeaderIcon";
import GlassCard from "@/shared/ui/GlassCard";
import Eyebrow from "@/shared/ui/Eyebrow";
import { AIHealthBanner } from "@/shared/ui/AIHealthBanner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useColorMode } from "@/app/theme/ColorModeProvider";
import useApi from "@/shared/hooks/useApi";
import { apiFetch } from "@/shared/api/client";
import useAppToast from "@/shared/hooks/useAppToast";
import { useModelToast } from "@/shared/ai/useModels";
import { BRAND_500 } from "@/shared/theme/brandColors";
import type { Equipment } from "@/shared/types";

// ── API shapes (derived from legacy field usage) ──
type QueryRow = Record<string, unknown>;

interface QueryResult {
  sql: string;
  columns: string[];
  rows: QueryRow[];
  row_count: number;
  elapsed_ms: number;
  warnings?: string[];
}

interface Examples {
  simple: string[];
  medium: string[];
  complex: string[];
}

interface SeriesMeta {
  timeCol: string;
  numericCol: string;
}

function buildExamples(equipment: Equipment[]): Examples {
  // Examples are derived from the real equipment list so they always match
  // what's actually queryable. Time phrasing avoids "now" because the
  // dataset's latest slot may be days/weeks old.
  if (!equipment?.length) return { simple: [], medium: [], complex: [] };

  const chillers = equipment.filter((e) => e.type === "chiller");
  const towers = equipment.filter((e) => e.type === "cooling_tower");
  const pumps = equipment.filter((e) => e.type === "pump");
  const ch1 = chillers[0];
  const ch2 = chillers[1];
  const tw1 = towers[0];
  const tw2 = towers[1];
  const pp1 = pumps[0];

  const simple: string[] = [];
  const medium: string[] = [];
  const complex: string[] = [];

  // ── Simple — single equipment, single metric, no aggregation ────────────────
  if (ch1) simple.push(`Show the most recent 50 kW/TR readings for ${ch1.name}`);
  if (ch1) simple.push(`What was the latest evaporator leaving temperature for ${ch1.name}?`);
  if (tw1) simple.push(`Show the last 24 hours of kW for ${tw1.name}`);
  if (pp1) simple.push(`Latest 100 power readings for ${pp1.name}`);
  if (ch2) simple.push(`Show all readings where ${ch2.name} kW/TR is above 1.0 in the last week`);
  if (ch1) simple.push(`How many hours of data do we have for ${ch1.name} in the last 30 days?`);

  // ── Medium — aggregation, grouping, or filtering ────────────────────────────
  if (ch1 && ch2) medium.push(`Compare average kW for ${ch1.name} and ${ch2.name} over the last 7 days of data`);
  if (tw1) medium.push(`What is the run percentage of ${tw1.name} over the latest 7 days in the dataset?`);
  if (ch1) medium.push(`Top 10 hours of highest energy use for ${ch1.name} from the available data`);
  if (pp1) medium.push(`Average kW for ${pp1.name} grouped by hour-of-day over the last 30 days of data`);
  if (ch2) medium.push(`How many hours did ${ch2.name} spend in the poor efficiency band (kW/TR > 0.75)?`);
  if (ch1) medium.push(`Average chilled water delta-T per day for ${ch1.name} over the last 14 days`);
  if (tw1) medium.push(`Daily total kWh for ${tw1.name} over the last 30 days`);
  if (ch1) medium.push(`What hour of the day has the highest average kW for ${ch1.name} over the last month?`);

  // ── Complex — multi-equipment, multi-metric, joins, window-style logic ──────
  if (ch1 && ch2)
    complex.push(
      `Which chiller — ${ch1.name} or ${ch2.name} — had better average efficiency over the last 30 days, and by how much?`,
    );
  if (ch1)
    complex.push(
      `For ${ch1.name}, show daily average kW/TR alongside daily average chiller load over the last 14 days`,
    );
  if (tw1 && tw2) complex.push(`Daily total kWh for ${tw1.name} and ${tw2.name} side by side for the last 7 days`);
  if (ch1 && tw1)
    complex.push(`On hours where ${ch1.name} was running, what was the average ${tw1.name} kW over the last 7 days?`);
  if (ch1)
    complex.push(
      `For ${ch1.name}, find the hours where condenser approach (cond_leaving - cond_entering) exceeded 5°C in the last 14 days`,
    );
  if (ch1 && ch2)
    complex.push(`How many hours in the last 7 days did both ${ch1.name} and ${ch2.name} run simultaneously?`);
  if (ch1)
    complex.push(
      `Show the worst-performing 20 hours by kW/TR for ${ch1.name}, with timestamp, kW, TR, and load percentage, in the last 30 days`,
    );
  if (pp1 && tw1)
    complex.push(`Average kW for ${pp1.name} versus ${tw1.name} grouped by day-of-week over the last 30 days`);
  if (ch1)
    complex.push(
      `Count anomalous hours where ${ch1.name} kW/TR was more than 1.5x its 7-day moving average (last 14 days)`,
    );

  return { simple, medium, complex };
}

function pickSeries(rows: QueryRow[], columns: string[]): SeriesMeta | null {
  if (!rows.length || columns.length < 2) return null;
  // Try to detect a time column + a numeric column
  const timeCol = columns.find((c) => /time|date|slot|hour|day/i.test(c)) || columns[0];
  const numericCol = columns.find((c) => c !== timeCol && typeof rows[0][c] === "number");
  if (!numericCol) return null;
  return { timeCol, numericCol };
}

interface ExampleGroup {
  key: keyof Examples;
  label: string;
  Icon: LucideIcon;
  color: string;
  desc: string;
  items: string[];
}

export default function NLQueryPage() {
  const { colorMode } = useColorMode();
  const isDark = colorMode === "dark";
  const toast = useAppToast();
  const notifyModel = useModelToast();
  const taRef = useRef<HTMLTextAreaElement>(null);

  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: equipmentData } = useApi<Equipment[]>("/api/v1/equipment");
  const equipment = useMemo(() => equipmentData ?? [], [equipmentData]);

  const examples = useMemo(() => buildExamples(equipment), [equipment]);

  function handleClear() {
    setQuestion("");
    setResult(null);
    setError(null);
    taRef.current?.focus();
  }

  async function run(q?: string) {
    const text = (q ?? question).trim();
    if (text.length < 3) return;
    notifyModel("sql", { prefix: "NL→SQL" });
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await apiFetch("/api/v1/nl-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      if (!r.ok) {
        const data = (await r.json().catch(() => ({}))) as { detail?: string };
        throw new Error(data?.detail || `HTTP ${r.status}`);
      }
      const data = (await r.json()) as QueryResult;
      setResult(data);
      toast.success(
        `Returned ${data.row_count} row${data.row_count === 1 ? "" : "s"} in ${data.elapsed_ms}ms`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const chartOption = useMemo<EChartsOption | null>(() => {
    if (!result?.rows?.length) return null;
    const meta = pickSeries(result.rows, result.columns);
    if (!meta) return null;
    const xData = result.rows.map((r) => r[meta.timeCol] as string | number);
    const yData = result.rows.map((r) => r[meta.numericCol] as number);
    return {
      animation: true,
      animationDuration: 600,
      grid: { top: 16, right: 16, bottom: 28, left: 50 },
      xAxis: {
        type: "category",
        data: xData,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { fontSize: 10, color: isDark ? "#9D9DAA" : "#334155", hideOverlap: true },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { fontSize: 10, color: isDark ? "#9D9DAA" : "#334155" },
        splitLine: { lineStyle: { color: isDark ? "rgba(255,255,255,0.05)" : "rgba(31,63,254,0.06)", type: "dashed" } },
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: isDark ? "#0d1526" : "#fff",
        borderColor: isDark ? "#1e2d4a" : "#E0E7FF",
        borderRadius: 10,
        padding: [8, 12],
        textStyle: { fontSize: 11, color: isDark ? "#fff" : "#0D0D0D" },
      },
      series: [
        {
          name: meta.numericCol,
          type: "line",
          data: yData,
          smooth: true,
          symbol: "none",
          lineStyle: { color: "#1F3FFE", width: 2 },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0.05, color: "rgba(31,63,254,0.20)" },
                { offset: 0.95, color: "rgba(31,63,254,0)" },
              ],
            },
          },
        },
      ],
    };
  }, [result, isDark]);

  const exampleGroups: ExampleGroup[] = [
    { key: "simple", label: "Simple", Icon: Zap, color: "#10b981", desc: "Single equipment · one metric · no aggregation", items: examples.simple },
    { key: "medium", label: "Medium", Icon: Layers, color: "#1F3FFE", desc: "Aggregation · grouping · filters", items: examples.medium },
    { key: "complex", label: "Complex", Icon: Flame, color: "#a855f7", desc: "Multi-equipment · multi-metric · joins · windows", items: examples.complex },
  ];

  return (
    <PageShell>
      <PageHeader
        title="Natural Language Query"
        icon={<PageHeaderIcon icon={<Sparkles size={20} strokeWidth={1.85} />} />}
        subtitle="Ask the plant in plain English — agent generates safe read-only SQL and returns results"
      />
      <AIHealthBanner />

      <GlassCard hover={false} className="mb-6 p-5">
        <Eyebrow className="mb-2">Your question</Eyebrow>
        <Textarea
          ref={taRef}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") run();
          }}
          placeholder="e.g. Show average kW/TR for chiller 1 in the last 6 hours"
          rows={2}
          className="mb-3 resize-y"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] text-ink-muted">
            ⌘/Ctrl+Enter to run · Only SELECT against telemetry tables · Hard 10s query timeout · Max 1000 rows
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              disabled={loading || (!question && !result && !error)}
            >
              <X size={14} strokeWidth={2.2} />
              Clear
            </Button>
            <Button
              size="sm"
              onClick={() => run()}
              disabled={loading || question.trim().length < 3}
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} strokeWidth={2.2} />}
              {loading ? "Generating…" : "Run query"}
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* Templates — grouped by complexity, generated from the real equipment list */}
      {!result && !error && examples.simple.length + examples.medium.length + examples.complex.length > 0 && (
        <div className="mb-6">
          <Eyebrow className="mb-3">Templates — generated from the {equipment.length} assets in your plant</Eyebrow>

          {exampleGroups.map(
            (group) =>
              group.items.length > 0 && (
                <div key={group.key} className="mb-5">
                  <div className="mb-3 flex items-center gap-2">
                    <group.Icon size={14} strokeWidth={2.2} color={group.color} />
                    <p className="text-xs font-bold tracking-[0.08em] text-ink uppercase">{group.label}</p>
                    <p className="text-[11px] text-ink-muted">— {group.desc}</p>
                    <Badge
                      variant="outline"
                      className="ml-auto rounded-md border-border-subtle bg-chip px-2 text-[9px] text-ink-muted"
                    >
                      {group.items.length}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {group.items.map((ex, i) => (
                      <motion.div key={ex} whileHover={{ y: -1 }} transition={{ duration: 0.15 }}>
                        <GlassCard
                          hover={false}
                          className="w-full cursor-pointer p-4 text-left hover:border-border-brand"
                          onClick={() => {
                            setQuestion(ex);
                            taRef.current?.focus();
                          }}
                        >
                          <div className="mb-1 flex items-center gap-2">
                            <group.Icon size={11} strokeWidth={2} color={group.color} />
                            <Eyebrow>
                              {group.label} · Example {i + 1}
                            </Eyebrow>
                          </div>
                          <p className="text-sm text-ink">{ex}</p>
                        </GlassCard>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ),
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard hover={false} className="mb-4 border border-[rgba(239,68,68,0.32)] p-4">
            <div className="flex items-center gap-3">
              <div className="text-bad">
                <AlertCircle size={18} />
              </div>
              <div>
                <Eyebrow style={{ color: "#ef4444" }}>Query refused</Eyebrow>
                <p className="mt-1 text-sm text-ink">{error}</p>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* Result */}
      {result && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          {/* Generated SQL */}
          <GlassCard hover={false} className="mb-4 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Database size={14} strokeWidth={2} color={BRAND_500} />
              <Eyebrow>Generated SQL</Eyebrow>
              <Badge
                variant="outline"
                className="ml-auto rounded-md border-border-subtle bg-chip px-2 text-[9px] text-ink-muted"
              >
                {result.row_count} rows · {result.elapsed_ms}ms
              </Badge>
            </div>
            <pre className="overflow-x-auto rounded-md border border-border-subtle bg-chip p-3 font-mono text-[12px] whitespace-pre-wrap text-ink">
              {result.sql}
            </pre>
            {result.warnings && result.warnings.length > 0 && (
              <p className="mt-2 text-[10px] text-warn">⚠ {result.warnings.join(" · ")}</p>
            )}
          </GlassCard>

          {/* Chart */}
          {chartOption && (
            <GlassCard hover={false} className="mb-4 overflow-hidden p-0">
              <div className="flex items-center gap-2 px-5 pt-4 pb-3">
                <BarChart3 size={14} strokeWidth={2} color={BRAND_500} />
                <Eyebrow>Auto-visualization</Eyebrow>
              </div>
              <ReactECharts option={chartOption} style={{ height: "240px", width: "100%" }} opts={{ renderer: "canvas" }} />
            </GlassCard>
          )}

          {/* Table */}
          <GlassCard hover={false} className="overflow-hidden p-0">
            <div className="flex items-center gap-2 px-5 pt-4 pb-3">
              <TableIcon size={14} strokeWidth={2} color={BRAND_500} />
              <Eyebrow>Results</Eyebrow>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-xs">
                <thead>
                  <tr className="border-b border-border-subtle">
                    {result.columns.map((c) => (
                      <th
                        key={c}
                        className="px-4 py-2 text-left text-[10px] font-bold tracking-[0.08em] text-ink-muted uppercase"
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.slice(0, 200).map((row, i) => (
                    <tr key={i} className="border-b border-border-subtle hover:bg-[rgba(31,63,254,0.04)]">
                      {result.columns.map((c) => (
                        <td key={c} className="px-4 py-[6px] text-ink tabular-nums">
                          {row[c] == null
                            ? "—"
                            : typeof row[c] === "number"
                              ? Number(row[c]).toLocaleString()
                              : String(row[c])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {result.rows.length > 200 && (
              <p className="px-5 py-2 text-[10px] text-ink-muted">
                Showing first 200 of {result.row_count} rows
              </p>
            )}
          </GlassCard>
        </motion.div>
      )}
    </PageShell>
  );
}
