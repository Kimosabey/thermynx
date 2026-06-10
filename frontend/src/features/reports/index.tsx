import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FileText, Loader2 } from "lucide-react";

import PageShell from "@/shared/ui/PageShell";
import PageHeader from "@/shared/ui/PageHeader";
import PageHeaderIcon from "@/shared/ui/PageHeaderIcon";
import Eyebrow from "@/shared/ui/Eyebrow";
import PeriodSelect, { HOURS_OPTIONS_STANDARD } from "@/shared/ui/PeriodSelect";
import GlassCard from "@/shared/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { useModelToast } from "@/shared/ai/useModels";
import { apiFetch } from "@/shared/api/client";

interface ReportResponse {
  markdown?: string;
  total_kwh?: number;
  total_cost_inr?: number;
}

export default function ReportsPage() {
  const [hours, setHours] = useState<number>(24);
  const [markdown, setMarkdown] = useState<string>("");
  const [meta, setMeta] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const notifyModel = useModelToast();

  async function generate() {
    notifyModel("text", { prefix: "Report" });
    setLoading(true);
    setError(null);
    setMarkdown("");
    setMeta(null);
    try {
      const res = await apiFetch(`/api/v1/reports/daily?hours=${hours}`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ReportResponse;
      setMarkdown(data.markdown || "");
      setMeta(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
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
    <PageShell className="max-w-[960px]">
      <PageHeader
        title="Report Builder"
        subtitle="KPI rollup + persisted anomalies + LLM executive summary — export as markdown"
        icon={<PageHeaderIcon icon={<FileText size={20} strokeWidth={1.85} />} />}
        className="mb-6"
      />

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div>
          <Eyebrow className="mb-2">Window</Eyebrow>
          <PeriodSelect value={hours} onChange={setHours} options={HOURS_OPTIONS_STANDARD} width="160px" />
        </div>
        <Button size="sm" onClick={generate} disabled={loading}>
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : "Generate report"}
        </Button>
        <Button size="sm" variant="outline" onClick={downloadMd} disabled={!markdown}>
          Download .md
        </Button>
      </div>

      {error && (
        <GlassCard className="mb-4 p-3">
          <p className="text-sm text-bad">{error}</p>
        </GlassCard>
      )}

      {meta && (
        <p className="mb-4 text-xs text-ink-muted">
          Total kWh {meta.total_kwh?.toFixed(2)} · INR {meta.total_cost_inr?.toFixed(2)}
        </p>
      )}

      {markdown && (
        <GlassCard className="p-4 md:p-6">
          <div
            className={
              "[&_h1]:mb-3 [&_h1]:font-extrabold [&_h1]:text-ink " +
              "[&_h2]:mb-3 [&_h2]:font-extrabold [&_h2]:text-ink " +
              "[&_h3]:mb-2 [&_h3]:text-sm [&_h3]:font-bold [&_h3]:text-cyan " +
              "[&_p]:mb-3 [&_p]:text-sm [&_p]:leading-[1.8] " +
              "[&_table]:mb-4 [&_table]:w-full [&_table]:text-sm " +
              "[&_th]:border [&_th]:border-border-subtle [&_th]:px-2 [&_th]:py-1 " +
              "[&_td]:border [&_td]:border-border-subtle [&_td]:px-2 [&_td]:py-1 " +
              "[&_strong]:text-ink"
            }
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
          </div>
        </GlassCard>
      )}
    </PageShell>
  );
}
