import { useRef, useState, type DragEvent, type ChangeEvent } from "react";
import { Camera, Upload, Play, AlertCircle, Eye, GitCompare, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import PageShell from "@/shared/ui/PageShell";
import PageHeader from "@/shared/ui/PageHeader";
import PageHeaderIcon from "@/shared/ui/PageHeaderIcon";
import GlassCard from "@/shared/ui/GlassCard";
import Eyebrow from "@/shared/ui/Eyebrow";
import { AIHealthBanner } from "@/shared/ui/AIHealthBanner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useModelToast } from "@/shared/ai/useModels";
import useAppToast from "@/shared/hooks/useAppToast";
import { apiFetch } from "@/shared/api/client";

type Severity = "critical" | "warning" | "info";

const SEV: Record<Severity, { c: string; bg: string; b: string }> = {
  critical: { c: "#ef4444", bg: "rgba(239,68,68,0.12)", b: "rgba(239,68,68,0.32)" },
  warning: { c: "#f59e0b", bg: "rgba(245,158,11,0.12)", b: "rgba(245,158,11,0.32)" },
  info: { c: "#0ea5e9", bg: "rgba(14,165,233,0.12)", b: "rgba(14,165,233,0.32)" },
};

interface VisionResult {
  severity?: Severity | string;
  model?: string;
  elapsed_ms?: number;
  description?: unknown;
  differences?: unknown[];
  findings?: unknown[];
}

interface PickedImage {
  b64: string;
  name: string;
  size: number;
  preview: string;
}

type Mode = "describe" | "compare";

function SeverityChip({ severity }: { severity?: Severity | string }) {
  const s = SEV[(severity as Severity)] || SEV.info;
  return (
    <div
      className="w-fit rounded-[6px] border px-2 py-[2px] text-[10px] font-bold tracking-[0.06em] uppercase"
      style={{ background: s.bg, borderColor: s.b, color: s.c }}
    >
      {severity}
    </div>
  );
}

function asText(v: unknown): string {
  // LLMs occasionally return arrays of {severity, description} objects instead of
  // plain strings. Render gracefully either way.
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(asText).join(" · ");
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    const text = o.text ?? o.message ?? o.description ?? o.detail;
    if (text) return typeof text === "string" ? text : asText(text);
    return Object.entries(o)
      .map(([k, val]) => `${k}: ${asText(val)}`)
      .join(" · ");
  }
  return String(v);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface DropZoneProps {
  label: string;
  image: PickedImage | null;
  onPick: (img: PickedImage) => void;
  disabled?: boolean;
}

function DropZone({ label, image, onPick, disabled }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  async function handleFiles(files: FileList | null | undefined) {
    const file = files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const b64 = await fileToBase64(file);
    onPick({ b64, name: file.name, size: file.size, preview: b64 });
  }

  return (
    <label
      htmlFor={`drop-${label}`}
      className={disabled ? "cursor-not-allowed" : "cursor-pointer"}
      onDragOver={(e: DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        if (!disabled) setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e: DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        setDrag(false);
        if (!disabled) handleFiles(e.dataTransfer.files);
      }}
    >
      <GlassCard
        hover={false}
        className="relative flex h-[240px] items-center justify-center overflow-hidden p-0 transition-[border-color] duration-[0.18s]"
        style={{ borderColor: drag ? "var(--border-brand)" : "var(--border-subtle)" }}
      >
        {image?.preview ? (
          <div className="relative h-full w-full">
            <img src={image.preview} alt={label} className="h-full w-full object-cover" />
            <div className="absolute left-2 top-2 rounded-md border border-border-subtle bg-glass px-2 py-[2px] backdrop-blur-[8px]">
              <p className="text-[10px] font-bold text-ink">{label}</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-ink-muted">
            <Upload size={28} strokeWidth={1.6} />
            <p className="text-sm font-semibold text-ink">{label}</p>
            <p className="text-xs">Click or drop a photo</p>
          </div>
        )}
      </GlassCard>
      <input
        ref={inputRef}
        id={`drop-${label}`}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        disabled={disabled}
        onChange={(e: ChangeEvent<HTMLInputElement>) => handleFiles(e.target.files)}
      />
    </label>
  );
}

export default function VisionPage() {
  const toast = useAppToast();
  const notifyModel = useModelToast();
  const [ref, setRef] = useState<PickedImage | null>(null);
  const [cur, setCur] = useState<PickedImage | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VisionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("compare"); // "describe" | "compare"

  async function run() {
    setError(null);
    setResult(null);
    if (mode === "describe" && !cur) {
      setError("Add a current photo first.");
      return;
    }
    notifyModel("vision", { prefix: "Vision" });
    if (mode === "compare" && (!ref || !cur)) {
      setError("Add both reference and current photos.");
      return;
    }
    setLoading(true);
    try {
      const url = mode === "describe" ? "/api/v1/vision/describe" : "/api/v1/vision/compare";
      const body =
        mode === "describe"
          ? { image: cur!.b64 }
          : { reference: ref!.b64, current: cur!.b64 };
      const r = await apiFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data?.detail || `HTTP ${r.status}`);
      }
      const data: VisionResult = await r.json();
      setResult(data);
      toast.success(
        `${mode === "describe" ? "Scene described" : "Comparison done"} in ${data.elapsed_ms}ms`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Vision Compare"
        icon={<PageHeaderIcon icon={<Camera size={20} strokeWidth={1.85} />} />}
        subtitle="Upload a plant photo — on-prem vision model describes or diffs against a reference"
        actions={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={mode === "describe" ? "default" : "outline"}
              onClick={() => {
                setMode("describe");
                setResult(null);
                setError(null);
              }}
            >
              <Eye size={14} strokeWidth={2.2} />
              Describe
            </Button>
            <Button
              size="sm"
              variant={mode === "compare" ? "default" : "outline"}
              onClick={() => {
                setMode("compare");
                setResult(null);
                setError(null);
              }}
            >
              <GitCompare size={14} strokeWidth={2.2} />
              Compare
            </Button>
          </div>
        }
      />
      <AIHealthBanner />

      <div className={`mb-4 grid gap-4 ${mode === "compare" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
        {mode === "compare" && (
          <DropZone label="Reference" image={ref} onPick={setRef} disabled={loading} />
        )}
        <DropZone label="Current" image={cur} onPick={setCur} disabled={loading} />
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] text-ink-muted">
          All processing on the on-prem Ollama server. No cloud APIs. Max 6 MiB per image.
        </p>
        <Button
          onClick={run}
          disabled={loading || (mode === "describe" ? !cur : !ref || !cur)}
          size="sm"
        >
          {loading ? <Loader2 className="animate-spin" /> : <Play size={14} strokeWidth={2.2} />}
          {loading ? "Analyzing…" : "Analyze"}
        </Button>
      </div>

      {error && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard hover={false} className="mb-4 p-4" style={{ borderColor: "rgba(239,68,68,0.32)" }}>
            <div className="flex items-center gap-3">
              <div className="text-bad">
                <AlertCircle size={18} />
              </div>
              <div>
                <Eyebrow style={{ color: "#ef4444" }}>Vision call failed</Eyebrow>
                <p className="mt-1 text-sm text-ink">{error}</p>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      )}

      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <GlassCard hover={false} className="mb-4 p-5">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <Eyebrow>Verdict</Eyebrow>
                <SeverityChip severity={result.severity} />
                <Badge
                  variant="outline"
                  className="ml-auto rounded-[6px] border-border-subtle bg-chip px-2 text-[9px] text-ink-muted"
                >
                  {result.model} · {result.elapsed_ms}ms
                </Badge>
              </div>
              <p className="mb-3 text-sm text-ink">{asText(result.description)}</p>

              {result.differences && result.differences.length > 0 && (
                <div className="mb-3">
                  <Eyebrow className="mb-2">Differences</Eyebrow>
                  {result.differences.map((d, i) => (
                    <div key={i} className="flex items-start gap-2 py-1">
                      <div
                        className="mt-[6px] h-[6px] w-[6px] shrink-0 rounded-full"
                        style={{ background: "#f59e0b" }}
                      />
                      <p className="text-sm text-ink">{asText(d)}</p>
                    </div>
                  ))}
                </div>
              )}

              {result.findings && result.findings.length > 0 && (
                <div>
                  <Eyebrow className="mb-2">Findings</Eyebrow>
                  {result.findings.map((f, i) => (
                    <div key={i} className="flex items-start gap-2 py-1">
                      <div
                        className="mt-[6px] h-[6px] w-[6px] shrink-0 rounded-full"
                        style={{ background: "#0ea5e9" }}
                      />
                      <p className="text-sm text-ink">{asText(f)}</p>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
    </PageShell>
  );
}
