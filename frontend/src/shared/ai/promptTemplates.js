/**
 * Per-equipment-type and per-agent-mode prompt templates.
 *
 * Shared between the AI Analyzer (Quick Ask) and Autonomous Agents pages so
 * the operator clicks a chip instead of typing free-hand. Reduces typos,
 * shows what the system can do, and steers operators toward phrasings the
 * guardrails handle well.
 *
 * Public API:
 *   buildAnalyzerPrompts(equipment | null) -> string[]
 *   buildAgentPrompts(mode, equipment | null) -> string[]
 *
 * `equipment` is the dropdown selection object ({id, name, type, ...}) or
 * null when no equipment is selected (plant-wide view).
 */

// Per-equipment-type templates for the Quick Ask page.
// {name} is the human-readable equipment name (e.g. "Chiller 1").
const ANALYZER_PER_TYPE = {
  chiller: [
    "How efficient is {name} over the last 24 hours?",
    "Why is {name}'s kW/TR outside optimal range?",
    "Show any anomalies on {name}",
    "What's {name}'s average load and running percentage?",
    "Compare {name}'s performance to the 0.65 kW/TR design benchmark",
    "Identify loss drivers on {name}",
  ],
  cooling_tower: [
    "What's the average kW for {name} over the last 24 hours?",
    "Is {name}'s fan running consistently?",
    "Any anomalies on {name} in the last day?",
    "Show {name}'s run hours and power trend",
    "Is the approach temperature on {name} healthy?",
  ],
  pump: [
    "How many run hours does {name} have?",
    "Show {name}'s power consumption trend",
    "Any cycling or anomalies on {name}?",
    "Compare condenser pumps' efficiency",
    "Is {name}'s power draw steady or variable?",
  ],
};

// Plant-wide templates when no equipment is selected.
const ANALYZER_PLANT_WIDE = [
  "Generate a plant-wide overview",
  "What's the highest energy consumer right now?",
  "Compare Chiller 1 vs Chiller 2 efficiency",
  "Are there any anomalies or alerts on any equipment?",
  "Summarize plant performance over the last 24 hours",
  "Which equipment needs the most attention?",
];

// Agent-mode + equipment-aware templates.
// `eq`  = when an equipment is selected
// `none` = when nothing is selected (plant-wide)
const AGENT_PER_MODE = {
  investigator: {
    eq: [
      "Investigate {name} — diagnose recent performance issues",
      "Why is {name} underperforming?",
      "Run a full investigation on {name}",
      "What's the root cause of {name}'s recent behavior?",
    ],
    none: [
      "Investigate the worst-performing equipment in the plant",
      "Find the most concerning issue right now",
      "Compare both chillers — who's causing higher energy bills?",
      "Investigate any equipment with recent anomalies",
    ],
  },
  optimizer: {
    eq: [
      "How can I reduce {name}'s energy use?",
      "Find optimization opportunities for {name}",
      "Quantify the savings from improving {name}'s efficiency",
      "What's the best operating strategy for {name}?",
    ],
    none: [
      "How can I reduce total kWh consumption this shift?",
      "Which equipment is wasting the most energy and what should I do?",
      "Give me a prioritized list of energy-saving actions",
      "Compare both chillers and recommend the best operating strategy",
    ],
  },
  brief: {
    eq: [
      "Brief me on {name}'s current state",
      "Quick summary of {name} over the last 24 hours",
    ],
    none: [
      "Generate a shift-start briefing",
      "Daily plant health summary",
      "What's the top 3 things I need to know right now?",
    ],
  },
  root_cause: {
    eq: [
      "Diagnose recent anomalies on {name}",
      "Why is {name}'s kW/TR above 0.65 at times?",
      "What's causing performance variance on {name}?",
    ],
    none: [
      "Diagnose the latest critical anomaly in the plant",
      "What's the underlying cause of recent energy spikes?",
    ],
  },
  maintenance: {
    eq: [
      "Build a maintenance plan for {name} for next month",
      "What maintenance is due for {name}?",
      "Prioritize maintenance tasks for {name} based on data",
    ],
    none: [
      "Generate this month's plant-wide maintenance plan",
      "Which equipment needs maintenance attention first?",
      "Build a priority list of preventive tasks for this shift",
    ],
  },
  // Orchestrator (multi-agent) uses richer multi-step goals.
  orchestrator: {
    eq: [
      "Investigate {name} thoroughly, then propose a maintenance plan",
      "Diagnose {name}'s issues and recommend savings actions",
    ],
    none: [
      "Audit plant efficiency and propose a complete action plan",
      "Investigate all equipment, identify top risks, and recommend fixes",
    ],
  },
};


function fill(template, ctx) {
  return template
    .replaceAll("{name}", ctx.name || "the plant")
    .replaceAll("{id}", ctx.id || "");
}


/**
 * Build prompt chips for the Quick Ask analyzer.
 * @param {{id:string,name:string,type:string}|null} equipment
 * @returns {string[]}
 */
export function buildAnalyzerPrompts(equipment) {
  if (!equipment) return [...ANALYZER_PLANT_WIDE];
  const tmpls = ANALYZER_PER_TYPE[equipment.type] || [];
  if (tmpls.length === 0) return [...ANALYZER_PLANT_WIDE];
  return tmpls.map((t) => fill(t, equipment));
}


/**
 * Build prompt chips for an Autonomous-Agent mode.
 * @param {string} mode - "investigator" | "optimizer" | "brief" | "root_cause" | "maintenance" | "orchestrator"
 * @param {{id:string,name:string,type:string}|null} equipment
 * @returns {string[]}
 */
export function buildAgentPrompts(mode, equipment) {
  const set = AGENT_PER_MODE[mode] || AGENT_PER_MODE.investigator;
  const tmpls = equipment ? set.eq : set.none;
  return tmpls.map((t) => fill(t, equipment || { name: "the plant" }));
}
