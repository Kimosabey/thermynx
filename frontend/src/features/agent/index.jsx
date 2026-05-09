import { useState, useEffect } from "react";
import {
  Box, Flex, Text, Grid, Textarea, Select, Button,
  Badge, HStack,
} from "@chakra-ui/react";
import { motion, AnimatePresence } from "framer-motion";
import { ScanSearch, Zap, CalendarCheck, Microscope, Wrench, Bot } from "lucide-react";
import PageShell from "../../shared/ui/PageShell";
import PageHeader from "../../shared/ui/PageHeader";
import { surfaceSelectProps } from "../../shared/ui/PeriodSelect";
import GlassCard from "../../shared/ui/GlassCard";
import AgentRunner, { useAgentStream } from "./AgentRunner";

const MotionBox = motion.create(Box);

const MODES = [
  {
    id:       "investigator",
    label:    "Investigator",
    Icon: ScanSearch,
    color: "#0511F2",
    bg: "rgba(5,17,242,0.07)",
    border: "rgba(5,17,242,0.2)",
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
    color:    "#10b981",
    bg:       "rgba(16,185,129,0.08)",
    border:   "rgba(16,185,129,0.2)",
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
    color:    "#7c3aed",
    bg:       "rgba(124,58,237,0.08)",
    border:   "rgba(124,58,237,0.2)",
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
    color:    "#f59e0b",
    bg:       "rgba(245,158,11,0.08)",
    border:   "rgba(245,158,11,0.2)",
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
    color:    "#f97316",
    bg:       "rgba(249,115,22,0.08)",
    border:   "rgba(249,115,22,0.2)",
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
  return (
    <MotionBox whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.15 }}>
      <Box
        as="button"
        w="full"
        textAlign="left"
        onClick={onClick}
        bg={selected ? mode.bg : "bg.surface"}
        border="1px solid"
        borderColor={selected ? mode.border : "border.subtle"}
        borderRadius="14px"
        p={4}
        _hover={{ borderColor: mode.border, bg: mode.bg }}
        transition="all 0.15s"
        position="relative"
      >
        {selected && (
          <Box
            position="absolute" top={0} left={0} right={0} h="2px"
            bg={mode.color} borderRadius="14px 14px 0 0"
            boxShadow={`0 0 12px ${mode.color}60`}
          />
        )}
        <Flex align="center" gap={3} mb={2}>
          <Box><ModeIcon mode={mode} /></Box>
          <Text fontWeight={700} fontSize="sm" color={selected ? mode.color : "text.primary"}>
            {mode.label}
          </Text>
        </Flex>
        <Text fontSize="xs" color="text.muted" lineHeight={1.5}>{mode.tagline}</Text>
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
    <PageShell>
      <PageHeader
        title="AI Agents"
        subtitle={
          <>
            Autonomous HVAC intelligence — 5 specialist agents powered by{" "}
            <Text as="span" color="accent.primary" fontWeight={600}>qwen2.5:14b</Text>
          </>
        }
        icon={
          <Box
            w="40px" h="40px" borderRadius="12px" flexShrink={0}
            bgGradient="linear(135deg, brand.500, brand.700)"
            display="flex" alignItems="center" justifyContent="center"
            boxShadow="0 4px 20px rgba(5,17,242,0.3)"
            color="white"
          >
            <Bot size={20} strokeWidth={1.85} />
          </Box>
        }
        mb={6}
      />

      {/* Mode selector grid */}
      <Grid
        templateColumns={{
          base: "repeat(2, minmax(0, 1fr))",
          sm: "repeat(3, minmax(0, 1fr))",
          lg: "repeat(5, minmax(0, 1fr))",
        }}
        gap={3}
        mb={6}
        w="100%"
        minW={0}
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
            <Flex align="center" gap={3} mb={4}>
              <Text fontSize="2xl">{mode?.icon}</Text>
              <Box>
                <Text fontWeight={700} fontSize="sm" color={mode?.color}>{mode?.label}</Text>
                <Text fontSize="xs" color="text.muted">{mode?.tagline}</Text>
              </Box>
            </Flex>

            {/* Context selectors */}
            {mode?.hasEquipment && (
              <Flex gap={3} mb={4} flexWrap="wrap">
                <Box flex="1" minW="160px">
                  <Text fontSize="9px" fontWeight={700} color="text.muted"
                    textTransform="uppercase" letterSpacing="0.12em" mb={1}>
                    Equipment (optional)
                  </Text>
                  <Select
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
                </Box>
                <Box>
                  <Text fontSize="9px" fontWeight={700} color="text.muted"
                    textTransform="uppercase" letterSpacing="0.12em" mb={1}>
                    Window
                  </Text>
                  <Select
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
                </Box>
              </Flex>
            )}

            {/* Preset chips */}
            <Flex flexWrap="wrap" gap={2} mb={4}>
              {mode?.presets.map((p, i) => (
                <MotionBox key={i} whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}>
                  <Box
                    as="button" onClick={() => setGoal(p)}
                    fontSize="xs" color="text.muted"
                    bg="bg.surface" border="1px solid" borderColor="border.subtle"
                    borderRadius="full" px={3} py="5px"
                    _hover={{ borderColor: mode?.color, color: mode?.color, bg: mode?.bg }}
                    transition="all 0.15s" textAlign="left"
                  >
                    {p}
                  </Box>
                </MotionBox>
              ))}
            </Flex>

            {/* Goal input */}
            <Textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
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
              mb={3}
            />

            <Flex justify="space-between" align="center">
              <Text fontSize="xs" color="text.muted">Ctrl+Enter to run</Text>
              <HStack spacing={2}>
                {running && (
                  <Box
                    as="button" onClick={stop}
                    fontSize="xs" color="red.400" px={3} py="6px"
                    borderRadius="8px" border="1px solid rgba(239,68,68,0.3)"
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
        onStop={stop}
      />
    </PageShell>
  );
}
