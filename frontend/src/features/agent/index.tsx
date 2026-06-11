import { useState, useEffect, useMemo, type CSSProperties } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ScanSearch,
  Zap,
  CalendarCheck,
  Microscope,
  Wrench,
  Bot,
  Check,
  Play,
  Network,
  type LucideIcon,
} from "lucide-react";
import PageShell from "@/shared/ui/PageShell";
import PageHeader from "@/shared/ui/PageHeader";
import PageHeaderIcon from "@/shared/ui/PageHeaderIcon";
import GlassSelect from "@/shared/ui/GlassSelect";
import GlassCard from "@/shared/ui/GlassCard";
import Eyebrow from "@/shared/ui/Eyebrow";
import Chip from "@/shared/ui/Chip";
import MovingBorder from "@/shared/ui/MovingBorder";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import AgentRunner from "./AgentRunner";
import MultiAgentRunner from "./MultiAgentRunner";
import { useAgentStream } from "./useAgentStream";
import { buildAgentPrompts, type AgentMode } from "@/shared/ai/promptTemplates";
import { useModelToast, useModelRoster } from "@/shared/ai/useModels";
import { ENGINE_COLOR } from "@/shared/theme/engineColors";
import type { Equipment } from "@/shared/types";

interface Mode {
  id: AgentMode;
  label: string;
  Icon: LucideIcon;
  color: string;
  cDeep: string;
  cShadow: string;
  bg: string;
  border: string;
  tagline: string;
  placeholder: string;
  presets: string[];
  hasEquipment: boolean;
  colSpan?: number;
}

const MODES: Mode[] = [
  {
    id: "investigator",
    label: "Investigator",
    Icon: ScanSearch,
    color: ENGINE_COLOR.investigator,
    cDeep: "#0123B4",
    cShadow: "rgba(31,63,254,0.32)",
    bg: "rgba(31,63,254,0.07)",
    border: "rgba(31,63,254,0.22)",
    tagline: "Deep-dive into any equipment issue autonomously",
    placeholder: "e.g. Something feels off with Chiller 1. Investigate recent performance.",
    presets: [
      "Investigate Chiller 1 efficiency — why is it underperforming?",
      "Chiller 2 seems to have a problem, run a full investigation",
      "Investigate the worst-performing equipment in the plant right now",
      "Analyze Chiller 1 vs Chiller 2 — who is causing higher energy bills?",
    ],
    hasEquipment: true,
  },
  {
    id: "optimizer",
    label: "Optimizer",
    Icon: Zap,
    color: ENGINE_COLOR.optimizer,
    cDeep: "#047857",
    cShadow: "rgba(16,185,129,0.32)",
    bg: "rgba(16,185,129,0.08)",
    border: "rgba(16,185,129,0.22)",
    tagline: "Find actionable ways to cut energy consumption today",
    placeholder: "e.g. How can I reduce energy consumption at the plant today?",
    presets: [
      "How can I reduce total kWh consumption this shift?",
      "Which equipment is wasting the most energy and what should I do?",
      "Give me a prioritized list of energy saving actions for today",
      "Compare both chillers and recommend the best operating strategy",
    ],
    hasEquipment: false,
  },
  {
    id: "brief",
    label: "Daily Brief",
    Icon: CalendarCheck,
    color: ENGINE_COLOR.brief,
    cDeep: "#5b21b6",
    cShadow: "rgba(124,58,237,0.32)",
    bg: "rgba(124,58,237,0.08)",
    border: "rgba(124,58,237,0.22)",
    tagline: "Start-of-shift plant status briefing — no input required",
    placeholder: "Optional: focus area (e.g. overnight performance, energy spike at 2AM)",
    presets: [
      "Generate a complete plant status briefing for shift handover",
      "What happened overnight? Any issues I should know about?",
      "Morning brief — status of all equipment and top 3 action items",
    ],
    hasEquipment: false,
    colSpan: 2,
  },
  {
    id: "root_cause",
    label: "Root Cause",
    Icon: Microscope,
    color: ENGINE_COLOR.root_cause,
    cDeep: "#b45309",
    cShadow: "rgba(245,158,11,0.34)",
    bg: "rgba(245,158,11,0.08)",
    border: "rgba(245,158,11,0.22)",
    tagline: "Diagnose the root cause of a specific fault or anomaly",
    placeholder: "e.g. Chiller 1 kW/TR spiked to 0.95 at 14:30. What caused it?",
    presets: [
      "Chiller 1 efficiency degraded 15% over the last 24 hours — why?",
      "Condenser water delta-T is unusually low on Chiller 2 — diagnose",
      "Chilled water supply temperature is running high — find the cause",
      "Why did energy consumption spike between 2PM-4PM today?",
    ],
    hasEquipment: true,
  },
  {
    id: "maintenance",
    label: "Maintenance",
    Icon: Wrench,
    color: ENGINE_COLOR.maintenance,
    cDeep: "#c2410c",
    cShadow: "rgba(249,115,22,0.34)",
    bg: "rgba(249,115,22,0.08)",
    border: "rgba(249,115,22,0.22)",
    tagline: "AI-generated maintenance plan based on current equipment data",
    placeholder:
      "e.g. Plan maintenance priorities for this week based on current equipment health",
    presets: [
      "Create a prioritized maintenance plan for this week",
      "Which equipment needs attention most urgently based on performance data?",
      "Generate a maintenance schedule for all chillers and cooling towers",
      "Identify early warning signs of equipment degradation across the plant",
    ],
    hasEquipment: true,
  },
  {
    id: "orchestrator",
    label: "Orchestrator",
    Icon: Network,
    color: ENGINE_COLOR.orchestrator,
    cDeep: "#6d28d9",
    cShadow: "rgba(167,139,250,0.34)",
    bg: "rgba(167,139,250,0.08)",
    border: "rgba(167,139,250,0.22)",
    tagline: "Plans + dispatches multiple specialists, then synthesises one answer",
    placeholder:
      "e.g. Diagnose why energy is up 12%, propose fixes, and plan maintenance for next month",
    presets: [
      "Diagnose why total plant kW is high today, propose optimisations, and plan maintenance",
      "Investigate Chiller 1 issues, find optimisations, and produce a maintenance plan",
      "Full plant audit: investigate problems, optimise operations, plan next-week maintenance",
      "Compare both chillers, root-cause the underperformer, and recommend actions",
    ],
    hasEquipment: false,
    colSpan: 2,
  },
];

function ModeIcon({ mode, size = 18 }: { mode?: Mode; size?: number }) {
  const Icon = mode?.Icon;
  if (!Icon) return null;
  return <Icon size={size} strokeWidth={1.85} />;
}

function ModeCard({
  mode,
  selected,
  onClick,
}: {
  mode: Mode;
  selected: boolean;
  onClick: () => void;
}) {
  const Icon = mode.Icon;
  const colSpanClass =
    mode.colSpan === 2 ? "sm:col-span-2 lg:col-span-2" : "sm:col-span-1 lg:col-span-1";

  return (
    <div className={cn("col-span-1", colSpanClass)}>
      <motion.div
        whileHover={{ y: -4, boxShadow: `0 12px 32px ${mode.color}25` }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.2 }}
        className="relative h-full"
      >
        <button
          type="button"
          role="radio"
          aria-checked={selected}
          aria-label={`${mode.label}: ${mode.tagline}`}
          onClick={onClick}
          className={cn(
            "relative isolate h-full min-h-[110px] w-full rounded-2xl border p-4 text-left backdrop-blur-[16px]",
            "transition-all duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]",
            "lg:min-h-[140px] lg:p-5",
            selected ? "" : "bg-glass",
          )}
          style={{
            background: selected
              ? `linear-gradient(180deg, ${mode.color}18 0%, var(--glass) 100%)`
              : undefined,
            borderColor: selected ? mode.color : "var(--border-subtle)",
            boxShadow: selected
              ? `0 0 0 1px ${mode.color}, 0 8px 32px ${mode.color}25, inset 0 0 24px ${mode.color}15`
              : "var(--shadow-card)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = selected ? mode.color : `${mode.color}70`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = selected ? mode.color : "var(--border-subtle)";
          }}
        >
          {/* Gradient icon tile */}
          <div
            className="mb-4 flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg text-white"
            style={{
              background: `linear-gradient(135deg, ${mode.color} 0%, ${mode.cDeep} 100%)`,
              boxShadow: `0 6px 14px ${mode.cShadow}`,
            }}
          >
            {Icon && <Icon size={20} strokeWidth={2} />}
          </div>

          {/* Checkmark when selected */}
          {selected && (
            <div
              className="absolute top-4 right-4 flex h-[22px] w-[22px] items-center justify-center rounded-full"
              style={{ backgroundColor: mode.color, boxShadow: `0 0 12px ${mode.color}66` }}
            >
              <Check size={12} strokeWidth={3} color="white" />
            </div>
          )}

          <p className="mb-1.5 text-[15px] leading-[1.2] font-bold tracking-[-0.01em] text-ink">
            {mode.label}
          </p>
          <p className="text-[12px] leading-[1.5] text-ink-muted">{mode.tagline}</p>
        </button>
      </motion.div>
    </div>
  );
}

export default function AgentHub() {
  const [activeMode, setActiveMode] = useState<AgentMode>("investigator");
  const [goal, setGoal] = useState("");
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [selectedEq, setSelectedEq] = useState("");
  const [hours, setHours] = useState(24);

  const { trace, output, running, done, meta, error, plan, delegations, synthesis, agentAudit, start, stop } =
    useAgentStream();
  const mode = MODES.find((m) => m.id === activeMode);
  const isOrchestrator = activeMode === "orchestrator";
  const notifyModel = useModelToast();
  const goalOk = activeMode === "brief" || goal.trim().length >= 3;

  // The specialist agents run the ReAct executor (tool model) + narration (text
  // model), and the orchestrator adds the planner. Show the ACTUAL configured
  // models from the live roster — never a hardcoded list (which goes stale the
  // moment the model config changes).
  const roster = useModelRoster();
  const agentModels = useMemo(() => {
    const tasks = roster?.tasks;
    if (!tasks) return [] as string[];
    const names = (["tool", "text", "planner"] as const)
      .map((k) => tasks[k]?.model)
      .filter((m): m is string => Boolean(m))
      .map((m) => m.replace(/:latest$/, ""));
    return [...new Set(names)];
  }, [roster]);

  useEffect(() => {
    fetch("/api/v1/equipment")
      .then((r) => r.json())
      .then(setEquipment)
      .catch(() => {});
  }, []);

  // Reset goal when switching modes
  const handleModeSwitch = (id: AgentMode) => {
    setActiveMode(id);
    setGoal("");
  };

  function handleRun() {
    if (!goalOk) return;
    notifyModel(isOrchestrator ? "planner" : "tool", { prefix: "Agent" });
    const ctx: { equipment_id?: string; hours?: number } = {};
    if (selectedEq) ctx.equipment_id = selectedEq;
    if (hours) ctx.hours = hours;
    const effectiveGoal =
      activeMode === "brief"
        ? goal.trim() || "Generate a complete plant status briefing for shift handover"
        : goal;
    start(activeMode, effectiveGoal, Object.keys(ctx).length ? ctx : null);
  }

  return (
    <PageShell className="max-w-[1240px]">
      <PageHeader
        title="AI Agents"
        subtitle={
          <>
            Autonomous HVAC intelligence — 5 specialist agents
            {agentModels.length > 0 && (
              <>
                {" "}powered by{" "}
                <span className="font-semibold text-brand">{agentModels.join(" · ")}</span>
              </>
            )}
          </>
        }
        icon={
          <PageHeaderIcon
            icon={<Bot size={20} strokeWidth={1.85} />}
            gradient={`linear-gradient(135deg, ${mode?.color}, ${mode?.cDeep})`}
          />
        }
        className="mb-6"
      />

      {/* Mode selector grid */}
      <fieldset className="m-0 mb-6 border-none p-0">
        <legend className="sr-only">Select agent mode</legend>
        <div
          className="grid w-full min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          role="radiogroup"
          aria-label="Agent mode"
        >
          {MODES.map((m) => (
            <ModeCard
              key={m.id}
              mode={m}
              selected={activeMode === m.id}
              onClick={() => handleModeSwitch(m.id)}
            />
          ))}
        </div>
      </fieldset>

      {/* Active mode config */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeMode}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
        >
          <GlassCard className="p-5">
            {/* Mode header */}
            <div className="mb-4 flex items-start gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white"
                style={{
                  background: `linear-gradient(135deg, ${mode?.color} 0%, ${mode?.cDeep} 100%)`,
                  boxShadow: `0 6px 16px ${mode?.cShadow ?? "rgba(31,63,254,0.25)"}`,
                }}
              >
                <ModeIcon mode={mode} size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold" style={{ color: mode?.color }}>
                  {mode?.label}
                </p>
                <p className="text-xs leading-[1.45] text-ink-muted">{mode?.tagline}</p>
              </div>
            </div>

            {/* Context selectors */}
            {mode?.hasEquipment && (
              <div className="mb-4 flex flex-wrap gap-3">
                <div className="min-w-[160px] flex-[1_1_100%] sm:flex-1">
                  <Label
                    htmlFor="agent-equipment"
                    className="mb-1 block text-[10px] font-bold tracking-[0.10em] text-ink-muted uppercase"
                  >
                    Equipment (optional)
                  </Label>
                  <GlassSelect
                    value={selectedEq}
                    onChange={(v) => setSelectedEq(String(v))}
                    placeholder="All equipment"
                    width="100%"
                    options={[
                      { value: "", label: "All equipment" },
                      ...["chiller", "cooling_tower", "pump"].flatMap((type) =>
                        equipment
                          .filter((e) => e.type === type)
                          .map((e) => ({ value: e.id, label: e.name })),
                      ),
                    ]}
                  />
                </div>
                <div className="w-full sm:w-[130px]">
                  <Label
                    htmlFor="agent-window"
                    className="mb-1 block text-[10px] font-bold tracking-[0.10em] text-ink-muted uppercase"
                  >
                    Window
                  </Label>
                  <GlassSelect
                    value={hours}
                    onChange={(v) => setHours(Number(v))}
                    width="100%"
                    options={[
                      { value: 6, label: "6 hours" },
                      { value: 12, label: "12 hours" },
                      { value: 24, label: "24 hours" },
                      { value: 48, label: "48 hours" },
                      { value: 168, label: "7 days" },
                    ]}
                  />
                </div>
              </div>
            )}

            {/* Preset chips — equipment-aware: switch between per-equipment and plant-wide
                templates based on the dropdown selection. Falls back to mode's static
                presets only if the template module returns nothing (shouldn't happen). */}
            {(() => {
              const selectedEqObj = mode?.hasEquipment
                ? equipment.find((e) => e.id === selectedEq) || null
                : null;
              const dynamic = mode ? buildAgentPrompts(mode.id, selectedEqObj) : [];
              // Use dynamic chips if the module returned any; fall back to static presets only if empty
              const chips =
                Array.isArray(dynamic) && dynamic.length > 0 ? dynamic : mode?.presets || [];
              return (
                <div className="mb-4">
                  <Eyebrow className="mb-2">
                    {selectedEqObj
                      ? `Quick goals for ${selectedEqObj.name} (${mode?.label})`
                      : `Plant-wide goals (${mode?.label})`}
                  </Eyebrow>
                  <div className="flex flex-wrap gap-2">
                    {chips.map((p, i) => (
                      <Chip
                        key={`${selectedEqObj?.id || "all"}-${mode?.id}-${i}`}
                        accentColor={mode?.color}
                        onClick={() => setGoal(p)}
                      >
                        {p}
                      </Chip>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Goal input */}
            <div className="mb-3">
              <Label htmlFor="agent-goal" className="sr-only">
                Agent goal
              </Label>
              <Textarea
                id="agent-goal"
                value={goal}
                onChange={(e) => setGoal(e.target.value.slice(0, 2000))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleRun();
                }}
                placeholder={mode?.placeholder}
                rows={3}
                aria-describedby="agent-goal-count"
                maxLength={2000}
                className="resize-y rounded-[10px] border border-border-subtle bg-elevated text-sm text-ink placeholder:text-ink-muted focus-visible:ring-0"
                style={{ "--tw-ring-color": "transparent" } as CSSProperties}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = mode?.color ?? "var(--cyan)";
                  e.currentTarget.style.boxShadow = "none";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-subtle)";
                }}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <p className="text-xs text-ink-muted">Ctrl+Enter to run</p>
                <p
                  id="agent-goal-count"
                  className={cn(
                    "text-[10px] font-semibold tabular-nums",
                    goal.length >= 2000
                      ? "text-bad"
                      : goal.length > 1700
                        ? "text-warn"
                        : "text-ink-faint",
                  )}
                  aria-live="polite"
                >
                  {goal.length} / 2000
                </p>
              </div>
              <div className="flex items-center gap-2">
                {running && (
                  <button
                    type="button"
                    onClick={stop}
                    aria-label="Stop agent"
                    className="min-h-[40px] rounded-md border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)] px-3 text-xs text-[#f87171] transition-all duration-150 hover:bg-[rgba(239,68,68,0.15)]"
                  >
                    Stop
                  </button>
                )}
                <motion.div whileTap={{ scale: 0.96 }}>
                  <MovingBorder
                    icon={running ? undefined : Play}
                    tone="primary"
                    size="md"
                    onClick={handleRun}
                    isDisabled={!goalOk || running}
                  >
                    {running ? "Agent working…" : `Run ${mode?.label}`}
                  </MovingBorder>
                </motion.div>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      </AnimatePresence>

      {/* Agent runner output */}
      {isOrchestrator ? (
        <MultiAgentRunner
          plan={plan}
          delegations={delegations}
          synthesis={synthesis}
          running={running}
          done={done}
          meta={meta}
          error={error}
        />
      ) : (
        <AgentRunner
          trace={trace}
          output={output}
          running={running}
          done={done}
          meta={meta}
          error={error}
          agentAudit={agentAudit}
        />
      )}
    </PageShell>
  );
}
