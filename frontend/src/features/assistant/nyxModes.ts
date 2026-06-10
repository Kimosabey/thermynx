import {
  MessageSquareText,
  ScanSearch,
  Zap,
  Microscope,
  Wrench,
  CalendarCheck,
  Database,
  Network,
  type LucideIcon,
} from "lucide-react";
import { ENGINE_COLOR } from "@/shared/theme/engineColors";

export interface NyxMode {
  label: string;
  gerund: string;
  color: string;
  Icon: LucideIcon;
}

// The 8 engines = the router's engine ids = the UI mode-chip ids.
// label/gerund/color/Icon drive the chip, status line, and override dropdown.
export const NYX_MODES: Record<string, NyxMode> = {
  quick:       { label: "Quick Ask",   gerund: "thinking",                 color: ENGINE_COLOR.quick,       Icon: MessageSquareText },
  investigate: { label: "Investigate", gerund: "investigating",            color: ENGINE_COLOR.investigate, Icon: ScanSearch },
  optimize:    { label: "Optimize",    gerund: "optimizing",               color: ENGINE_COLOR.optimize,    Icon: Zap },
  root_cause:  { label: "Root Cause",  gerund: "diagnosing",               color: ENGINE_COLOR.root_cause,  Icon: Microscope },
  maintenance: { label: "Maintenance", gerund: "planning maintenance",     color: ENGINE_COLOR.maintenance, Icon: Wrench },
  brief:       { label: "Daily Brief", gerund: "briefing",                 color: ENGINE_COLOR.brief,       Icon: CalendarCheck },
  data_sql:    { label: "Data / SQL",  gerund: "querying the database",     color: ENGINE_COLOR.data_sql,    Icon: Database },
  orchestrate: { label: "Orchestrate", gerund: "coordinating specialists", color: ENGINE_COLOR.orchestrate, Icon: Network },
};

export const MODE_IDS = Object.keys(NYX_MODES);

export const modeMeta = (id?: string | null): NyxMode => (id != null && NYX_MODES[id]) || NYX_MODES.quick;

// Which model-toast task key fits each engine (for useModelToast).
export const modeToastTask = (id?: string | null): string =>
  (id != null ? { data_sql: "sql", orchestrate: "planner", quick: "text" }[id] : undefined) || "tool";
