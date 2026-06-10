import { motion } from "framer-motion";
import { Sparkles, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import GlassCard from "./GlassCard";
import Eyebrow from "./Eyebrow";

export interface ComingSoonProps {
  /**
   * Accepted for source-code traceability but intentionally not rendered
   * in the UI (matches legacy behavior).
   */
  phase?: string;
  items?: string[];
}

/**
 * In-development placeholder card. The `phase` prop is accepted for
 * source-code traceability but is intentionally not rendered in the UI.
 */
export default function ComingSoon({ phase: _phase, items = [] }: ComingSoonProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <GlassCard className="p-6">
        <div className="mb-4 flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{
              background: "rgba(31,63,254,0.14)",
              border: "1px solid rgba(31,63,254,0.32)",
              color: "#AEBBFF",
            }}
          >
            <Sparkles size={18} strokeWidth={1.9} />
          </div>
          <div>
            <Eyebrow>In development</Eyebrow>
            <p className="mt-1 text-base font-bold tracking-[-0.01em] text-ink">
              Available soon
            </p>
          </div>
          <Badge
            className="ml-auto rounded-[6px] border px-2 py-[2px] text-[10px]"
            style={{
              background: "rgba(124,58,237,0.12)",
              color: "#a78bfa",
              borderColor: "rgba(124,58,237,0.25)",
            }}
          >
            Preview
          </Badge>
        </div>

        <p className="mb-4 text-sm text-ink-muted">
          The capabilities below are in active development. All processing
          stays on the on-prem Ollama server — no cloud APIs.
        </p>

        <div>
          {items.map((it, i) => (
            <div
              key={i}
              className={cn(
                "flex items-start gap-3 py-2",
                i < items.length - 1 && "border-b border-border-subtle",
              )}
            >
              <div className="mt-[2px] shrink-0 text-good">
                <Check size={14} strokeWidth={2.4} />
              </div>
              <p className="text-sm text-ink">{it}</p>
            </div>
          ))}
        </div>
      </GlassCard>
    </motion.div>
  );
}
