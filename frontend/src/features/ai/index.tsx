/**
 * Unified AI page (legacy switcher) — kept reachable at /ai/legacy.
 *   Quick Ask  → /api/v1/analyze  (single LLM call + RAG + chart + threads)
 *   Agents     → /api/v1/agent/*  (ReAct loop, tool calls, 6 specialist modes)
 *
 * URL state: /ai/legacy?mode=quick (default) | ?mode=agent
 * The flagship /ai now renders the Nyx assistant; this two-mode switcher is the
 * fallback surface.
 */
import { lazy, Suspense, type ComponentType } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { MessageSquareText, Bot, Loader2, type LucideIcon } from "lucide-react";
import { AIHealthBanner } from "@/shared/ui/AIHealthBanner";
import { cn } from "@/lib/utils";

const AIAnalyzer = lazy(() => import("@/features/analyzer"));
const AgentHub = lazy(() => import("@/features/agent"));

type ModeId = "quick" | "agent";

interface ModeDef {
  id: ModeId;
  label: string;
  Icon: LucideIcon;
  iconClass: string;
  pillClass: string;
  tagline: string;
}

const MODES: ModeDef[] = [
  {
    id: "quick",
    label: "Quick Ask",
    Icon: MessageSquareText,
    iconClass: "text-cyan",
    pillClass: "bg-elevated border-border-subtle",
    tagline: "Instant answer — RAG context, chart, conversation memory",
  },
  {
    id: "agent",
    label: "Autonomous Agents",
    Icon: Bot,
    iconClass: "text-brand",
    pillClass: "bg-[var(--glow)] border-brand shadow-[0_0_12px_rgba(31,63,254,0.15)]",
    tagline: "Deep investigation — ReAct loop, tool calls, 6 specialist modes",
  },
];

function ModeSwitcher({ active, onChange }: { active: ModeId; onChange: (id: ModeId) => void }) {
  return (
    <div
      role="tablist"
      aria-label="AI mode"
      className="relative mb-6 flex w-fit gap-1 rounded-xl border border-border-subtle bg-surface p-[4px] shadow-sm"
    >
      {MODES.map((m) => {
        const selected = active === m.id;
        return (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`ai-panel-${m.id}`}
            onClick={() => onChange(m.id)}
            className={cn(
              "relative z-[1] flex cursor-pointer items-center gap-3 rounded-lg px-5 py-2.5 transition-colors hover:text-ink",
              selected ? "text-ink" : "text-ink-secondary",
            )}
          >
            {selected && (
              <motion.div
                layoutId="ai-mode-pill"
                className={cn("absolute inset-0 z-[-1] rounded-lg border", m.pillClass)}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className={selected ? m.iconClass : "text-current"}>
              <m.Icon size={16} strokeWidth={selected ? 2.2 : 1.8} />
            </span>
            <span className="text-left">
              <span
                className={cn(
                  "block text-[13px] leading-[1.2] tracking-[-0.01em]",
                  selected ? "font-bold" : "font-medium",
                )}
              >
                {m.label}
              </span>
              <span className={cn("mt-px block text-[10px] leading-[1.3]", selected ? "text-ink-secondary" : "text-ink-muted")}>
                {m.tagline}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Fallback() {
  return (
    <div className="flex h-[40vh] items-center justify-center">
      <Loader2 className="size-8 animate-spin text-brand" />
    </div>
  );
}

export default function AIPage() {
  const [params, setParams] = useSearchParams();
  const mode: ModeId = params.get("mode") === "agent" ? "agent" : "quick";

  function switchMode(id: ModeId) {
    setParams(id === "quick" ? {} : { mode: id }, { replace: true });
  }

  const Panel: ComponentType = mode === "quick" ? AIAnalyzer : AgentHub;

  return (
    <div>
      {/* AI degraded-mode warning — only renders when Ollama is down or breaker is open */}
      <div className="px-4 pt-5 md:px-6">
        <AIHealthBanner />
      </div>

      {/* Mode switcher sits above whichever page is rendered */}
      <div className="px-4 pt-1 md:px-6">
        <ModeSwitcher active={mode} onChange={switchMode} />
      </div>

      <div id={`ai-panel-${mode}`} role="tabpanel" aria-label={mode === "quick" ? "Quick Ask" : "Autonomous Agents"}>
        <Suspense fallback={<Fallback />}>
          <Panel />
        </Suspense>
      </div>
    </div>
  );
}
