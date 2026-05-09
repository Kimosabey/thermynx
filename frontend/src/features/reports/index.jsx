import { useState } from "react";
import {
  Box, Flex, Text, Button, Spinner,
} from "@chakra-ui/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import PageShell from "../../shared/ui/PageShell";
import PageHeader from "../../shared/ui/PageHeader";
import PeriodSelect, { HOURS_OPTIONS_STANDARD } from "../../shared/ui/PeriodSelect";
import GlassCard from "../../shared/ui/GlassCard";

export default function ReportsPage() {
  const [hours, setHours] = useState(24);
  const [markdown, setMarkdown] = useState("");
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function generate() {
    setLoading(true);
    setError(null);
    setMarkdown("");
    setMeta(null);
    try {
      const res = await fetch(`/api/v1/reports/daily?hours=${hours}`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMarkdown(data.markdown || "");
      setMeta(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function downloadMd() {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `thermynx-report-${hours}h.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <PageShell maxW="960px">
      <PageHeader
        title="Report Builder"
        subtitle="KPI rollup + persisted anomalies + LLM executive summary — export as markdown"
        mb={6}
      />

      <Flex gap={3} mb={6} flexWrap="wrap" align="flex-end">
        <Box>
          <Text fontSize="10px" fontWeight={700} color="text.muted" textTransform="uppercase" letterSpacing="0.08em" mb={2}>
            Window
          </Text>
          <PeriodSelect value={hours} onChange={setHours} options={HOURS_OPTIONS_STANDARD} width="160px" />
        </Box>
        <Button size="sm" onClick={generate} isDisabled={loading}>
          {loading ? <Spinner size="sm" /> : "Generate report"}
        </Button>
        <Button size="sm" variant="outline" onClick={downloadMd} isDisabled={!markdown}>
          Download .md
        </Button>
      </Flex>

      {error && (
        <GlassCard mb={4} p={3}>
          <Text color="red.400" fontSize="sm">{error}</Text>
        </GlassCard>
      )}

      {meta && (
        <Text fontSize="xs" color="text.muted" mb={4}>
          Total kWh {meta.total_kwh?.toFixed(2)} · INR {meta.total_cost_inr?.toFixed(2)}
        </Text>
      )}

      {markdown && (
        <GlassCard p={{ base: 4, md: 6 }}>
          <Box
            sx={{
              "h1,h2": { fontWeight: 800, mb: 3, color: "text.primary" },
              h3: { fontWeight: 700, fontSize: "sm", color: "accent.cyan", mb: 2 },
              p: { mb: 3, fontSize: "sm", lineHeight: 1.8 },
              table: { width: "100%", fontSize: "sm", mb: 4 },
              "th,td": { border: "1px solid", borderColor: "border.subtle", px: 2, py: 1 },
              strong: { color: "text.primary" },
            }}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
          </Box>
        </GlassCard>
      )}
    </PageShell>
  );
}
