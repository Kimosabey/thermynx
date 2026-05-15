import { useState, useEffect } from "react";
import {
  Box, Flex, Text, Grid, Textarea, Select, Button, FormControl, FormLabel,
  Badge, HStack,
} from "@chakra-ui/react";
import { motion, AnimatePresence } from "framer-motion";
import { ScanSearch, Zap, CalendarCheck, Microscope, Wrench, Bot, Check } from "lucide-react";
import PageShell from "../../shared/ui/PageShell";
import PageHeader from "../../shared/ui/PageHeader";
import PageHeaderIcon from "../../shared/ui/PageHeaderIcon";
import { surfaceSelectProps } from "../../shared/ui/PeriodSelect";
import GlassCard from "../../shared/ui/GlassCard";
import Eyebrow from "../../shared/ui/Eyebrow";
import Chip from "../../shared/ui/Chip";
import AgentRunner from "./AgentRunner";
import { useAgentStream } from "./useAgentStream";

const MotionBox = motion.create(Box);

const MODES = [
  {
    id:       "investigator",
    label:    "Investigator",
    Icon: ScanSearch,
    color:  "#1F3FFE",
    cDeep:  "#0123B4",
    cShadow:"rgba(31,63,254,0.32)",
    bg: "rgba(31,63,254,0.07)",
    border: "rgba(31,63,254,0.22)",
    tagline:  "Deep-dive into any equipment issue autonomously",
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
    id:       "optimizer",
    label:    "Optimizer",
    Icon: Zap,
    color:  "#10b981",
    cDeep:  "#047857",
    cShadow:"rgba(16,185,129,0.32)",
    bg:     "rgba(16,185,129,0.08)",
    border: "rgba(16,185,129,0.22)",
    tagline:  "Find actionable ways to cut energy consumption today",
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
    id:       "brief",
    label:    "Daily Brief",
    Icon: CalendarCheck,
    color:  "#7c3aed",
    cDeep:  "#5b21b6",
    cShadow:"rgba(124,58,237,0.32)",
    bg:     "rgba(124,58,237,0.08)",
    border: "rgba(124,58,237,0.22)",
    tagline:  "Start-of-shift plant status briefing — no input required",
    placeholder: "Optional: focus area (e.g. overnight performance, energy spike at 2AM)",
    presets: [
      "Generate a complete plant status briefing for shift handover",
      "What happened overnight? Any issues I should know about?",
      "Morning brief — status of all equipment and top 3 action items",
    ],
    hasEquipment: false,
  },
  {
    id:       "root_cause",
    label:    "Root Cause",
    Icon: Microscope,
    color:  "#f59e0b",
    cDeep:  "#b45309",
    cShadow:"rgba(245,158,11,0.34)",
    bg:     "rgba(245,158,11,0.08)",
    border: "rgba(245,158,11,0.22)",
    tagline:  "Diagnose the root cause of a specific fault or anomaly",
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
    id:       "maintenance",
    label:    "Maintenance",
    Icon: Wrench,
    color:  "#f97316",
    cDeep:  "#c2410c",
    cShadow:"rgba(249,115,22,0.34)",
    bg:     "rgba(249,115,22,0.08)",
    border: "rgba(249,115,22,0.22)",
    tagline:  "AI-generated maintenance plan based on current equipment data",
    placeholder: "e.g. Plan maintenance priorities for this week based on current equipment health",
    presets: [
      "Create a prioritized maintenance plan for this week",
      "Which equipment needs attention most urgently based on performance data?",
      "Generate a maintenance schedule for all chillers and cooling towers",
      "Identify early warning signs of equipment degradation across the plant",
    ],
    hasEquipment: true,
  },
];

function ModeIcon({ mode, size = 18 }) {
  const Icon = mode?.Icon;
  if (!Icon) return null;
  return <Icon size={size} strokeWidth={1.85} />;
}

function ModeCard({ mode, selected, onClick }) {
  const Icon = mode?.Icon;
  return (
    <MotionBox
      whileHover={{ y: -2, boxShadow: `0 8px 24px ${mode.color}1F` }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.15 }}
      position="relative"
    >
      <Box
        as="button"
        type="button"
        role="radio"
        aria-checked={selected}
        aria-label={`${mode.label}: ${mode.tagline}`}
        w="full"
        minH="44px"
        textAlign="left"
        onClick={onClick}
        bg={selected ? `linear-gradient(180deg, ${mode.color}14 0%, var(--chakra-colors-bg-surface) 70%)` : "bg.surface"}
        border="1px solid"
        borderColor={selected ? `${mode.color}55` : "border.subtle"}
        borderRadius="16px"
        p={4}
        pb="14px"
        _hover={{ borderColor: selected ? `${mode.color}70` : "rgba(31,63,254,0.12)" }}
        transition="all 0.18s cubic-bezier(0.25,0.46,0.45,0.94)"
        position="relative"
        isolation="isolate"
        boxShadow={selected ? `0 0 0 1px ${mode.color}33, 0 8px 24px ${mode.color}18` : "card"}
      >
        {/* Gradient icon tile */}
        <Box
          w="36px" h="36px" borderRadius="11px" mb={3}
          display="flex" alignItems="center" justifyContent="center"
          background={`linear-gradient(135deg, ${mode.color} 0%, ${mode.cDeep} 100%)`}
          boxShadow={`0 6px 14px ${mode.cShadow}`}
          color="white"
          flexShrink={0}
        >
          {Icon && <Icon size={17} strokeWidth={2} />}
        </Box>

        {/* Checkmark when selected */}
        {selected && (
          <Box
            position="absolute" top="14px" right="14px"
            w="18px" h="18px" borderRadius="full"
            bg={mode.color}
            display="flex" alignItems="center" justifyContent="center"
          >
            <Check size={10} strokeWidth={3} color="white" />
          </Box>
        )}

        <Text fontWeight={700} fontSize="13px" color="text.primary"
          letterSpacing="-0.01em" lineHeight={1.2} mb={1}>
          {mode.label}
        </Text>
        <Text fontSize="11px" color="text.muted" lineHeight={1.45}>
          {mode.tagline}
        </Text>
      </Box>
    </MotionBox>
  );
}

export default function AgentHub() {
  const [activeMode,  setActiveMode]  = useState("investigator");
  const [goal,        setGoal]        = useState("");
  const [equipment,   setEquipment]   = useState([]);
  const [selectedEq,  setSelectedEq]  = useState("");
  const [hours,       setHours]       = useState(24);

  const { trace, output, running, done, meta, error, start, stop } = useAgentStream();
  const mode = MODES.find((m) => m.id === activeMode);

  useEffect(() => {
    fetch("/api/v1/equipment")
      .then((r) => r.json())
      .then(setEquipment)
      .catch(() => {});
  }, []);

  // Reset goal when switching modes
  const handleModeSwitch = (id) => {
    setActiveMode(id);
    setGoal("");
  };

  function handleRun() {
    if (!goal.trim()) return;
    const ctx = {};
    if (selectedEq) ctx.equipment_id = selectedEq;
    if (hours)      ctx.hours        = hours;
    start(activeMode, goal, Object.keys(ctx).length ? ctx : null);
  }

  return (
    <PageShell maxW="1240px">
      <PageHeader
        title="AI Agents"
        subtitle={
          <>
            Autonomous HVAC intelligence — 5 specialist agents powered by{" "}
            <Text as="span" color="accent.primary" fontWeight={600}>qwen2.5:14b</Text>
          </>
        }
        icon={
          <PageHeaderIcon
            icon={<Bot size={20} strokeWidth={1.85} />}
            gradient={`linear-gradient(135deg, ${mode.color}, ${mode.cDeep})`}
          />
        }
        mb={6}
      />

      {/* Mode selector grid */}
      <Box as="fieldset" border="none" p={0} m={0} mb={6}>
        <Text as="legend" srOnly>Select agent mode</Text>
        <Grid
          templateColumns={{
            base: "repeat(2, minmax(0, 1fr))",
            sm: "repeat(3, minmax(0, 1fr))",
            md: "repeat(5, minmax(0, 1fr))",
          }}
          gap={3}
          w="100%"
          minW={0}
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
        </Grid>
      </Box>

      {/* Active mode config */}
      <AnimatePresence mode="wait">
        <MotionBox
          key={activeMode}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
        >
          <GlassCard p={5}>
            {/* Mode header */}
            <Flex align="flex-start" gap={3} mb={4}>
              <Box
                w="40px" h="40px" borderRadius="12px" flexShrink={0}
                display="flex" alignItems="center" justifyContent="center"
                bg={`linear-gradient(135deg, ${mode?.color} 0%, ${mode?.cDeep} 100%)`}
                boxShadow={`0 6px 16px ${mode?.cShadow ?? "rgba(31,63,254,0.25)"}`}
                color="white"
              >
                <ModeIcon mode={mode} size={20} />
              </Box>
              <Box minW={0}>
                <Text fontWeight={700} fontSize="sm" color={mode?.color}>{mode?.label}</Text>
                <Text fontSize="xs" color="text.muted" lineHeight={1.45}>{mode?.tagline}</Text>
              </Box>
            </Flex>

            {/* Context selectors */}
            {mode?.hasEquipment && (
              <Flex gap={3} mb={4} flexWrap="wrap">
                <FormControl flex="1" minW="160px">
                  <FormLabel htmlFor="agent-equipment" fontSize="10px" letterSpacing="0.10em" textTransform="uppercase" color="text.muted" fontWeight={700} mb={1}>
                    Equipment (optional)
                  </FormLabel>
                  <Select
                    id="agent-equipment"
                    placeholder="All equipment"
                    value={selectedEq}
                    onChange={(e) => setSelectedEq(e.target.value)}
                    {...surfaceSelectProps}
                    _hover={{ borderColor: mode?.color ?? "accent.cyan" }}
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
                  <FormLabel htmlFor="agent-window" fontSize="10px" letterSpacing="0.10em" textTransform="uppercase" color="text.muted" fontWeight={700} mb={1}>
                    Window
                  </FormLabel>
                  <Select
                    id="agent-window"
                    value={hours}
                    onChange={(e) => setHours(Number(e.target.value))}
                    w="130px"
                    {...surfaceSelectProps}
                  >
                    <option value={6}>6 hours</option>
                    <option value={12}>12 hours</option>
                    <option value={24}>24 hours</option>
                    <option value={48}>48 hours</option>
                    <option value={168}>7 days</option>
                  </Select>
                </FormControl>
              </Flex>
            )}

            {/* Preset chips */}
            <Flex flexWrap="wrap" gap={2} mb={4}>
              {mode?.presets.map((p, i) => (
                <Chip key={i} accentColor={mode?.color} onClick={() => setGoal(p)}>{p}</Chip>
              ))}
            </Flex>

            {/* Goal input */}
            <FormControl mb={3}>
              <FormLabel htmlFor="agent-goal" srOnly>Agent goal</FormLabel>
              <Textarea
                id="agent-goal"
                value={goal}
                onChange={(e) => setGoal(e.target.value.slice(0, 2000))}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleRun(); }}
                placeholder={mode?.placeholder}
                rows={3}
                resize="vertical"
                bg="bg.elevated"
                border="1px solid"
                borderColor="border.subtle"
                borderRadius="10px"
                _focus={{ borderColor: mode?.color ?? "accent.cyan", boxShadow: "none" }}
                fontSize="sm"
                color="text.primary"
                _placeholder={{ color: "text.muted" }}
                aria-describedby="agent-goal-count"
                maxLength={2000}
              />
            </FormControl>

            <Flex justify="space-between" align="center" flexWrap="wrap" gap={2}>
              <HStack spacing={3}>
                <Text fontSize="xs" color="text.muted">Ctrl+Enter to run</Text>
                <Text
                  id="agent-goal-count"
                  fontSize="10px"
                  fontWeight={600}
                  color={goal.length >= 2000 ? "status.bad" : goal.length > 1700 ? "status.warn" : "text.faint"}
                  sx={{ fontVariantNumeric: "tabular-nums" }}
                  aria-live="polite"
                >
                  {goal.length} / 2000
                </Text>
              </HStack>
              <HStack spacing={2}>
                {running && (
                  <Box
                    as="button"
                    type="button"
                    onClick={stop}
                    aria-label="Stop agent"
                    fontSize="xs"
                    color="red.400"
                    px={3}
                    minH="40px"
                    borderRadius="8px"
                    border="1px solid rgba(239,68,68,0.3)"
                    bg="rgba(239,68,68,0.08)"
                    _hover={{ bg: "rgba(239,68,68,0.15)" }}
                    transition="all 0.15s"
                  >
                    Stop
                  </Box>
                )}
                <MotionBox whileTap={{ scale: 0.95 }}>
                  <Button
                    size="sm" onClick={handleRun}
                    isLoading={running}
                    loadingText="Agent working…"
                    borderRadius="9px" fontWeight={600} px={5}
                    minH="40px"
                    bg={mode?.color ?? "brand.500"}
                    color="#060d1f"
                    _hover={{ opacity: 0.9, transform: "translateY(-1px)" }}
                    transition="all 0.15s"
                    isDisabled={!goal.trim()}
                  >
                    Run {mode?.label}
                  </Button>
                </MotionBox>
              </HStack>
            </Flex>
          </GlassCard>
        </MotionBox>
      </AnimatePresence>

      {/* Agent runner output */}
      <AgentRunner
        trace={trace}
        output={output}
        running={running}
        done={done}
        meta={meta}
        error={error}
      />
    </PageShell>
  );
}
