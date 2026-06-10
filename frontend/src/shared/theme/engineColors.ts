import { BRAND_500, THERMAL_CYAN } from "@/shared/theme/brandColors";

/**
 * Per-engine / per-specialist accent hexes — shared across the agent surface
 * (MODES / SPECIALIST_META) and the Nyx assistant (nyxModes), so the same
 * logical role can't drift between them. Ported from the legacy
 * `frontend/src/shared/theme/engineColors.js`. Nyx's "quick" keeps the THERMYNX
 * cyan signature; everything else is brand-blue or its categorical hue.
 */
export const ENGINE_COLOR: Record<string, string> = {
  quick: THERMAL_CYAN,
  investigate: BRAND_500,
  investigator: BRAND_500,
  optimize: "#10b981",
  optimizer: "#10b981",
  root_cause: "#f59e0b",
  maintenance: "#f97316",
  brief: "#7c3aed",
  data_sql: BRAND_500,
  orchestrate: "#a78bfa",
  orchestrator: "#a78bfa",
};

export const engineColor = (id: string): string => ENGINE_COLOR[id] || BRAND_500;
