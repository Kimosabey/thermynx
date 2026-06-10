import { useEffect, useState, type ComponentType, type CSSProperties } from "react";
import {
  CheckCircle2,
  Play,
  Pause,
  XCircle,
  UserCog,
  MessageSquare,
  Sparkles,
  Loader2,
} from "lucide-react";
import GlassCard from "@/shared/ui/GlassCard";
import Eyebrow from "@/shared/ui/Eyebrow";
import GlassSelect from "@/shared/ui/GlassSelect";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { apiFetch } from "@/shared/api/client";
import useAppToast from "@/shared/hooks/useAppToast";
import type { Equipment, Technician } from "./index";

// ── Response shapes (derived from legacy field usage) ──────────────────────────
type WorkOrderState =
  | "open"
  | "assigned"
  | "in_progress"
  | "resolved"
  | "closed"
  | "cancelled";

export interface WorkOrder {
  id: string;
  title: string;
  state: WorkOrderState;
  priority: string;
  source: string;
  equipment_id?: string | null;
  assigned_to?: string | null;
  description?: string | null;
  diagnosis?: string | null;
  recommended_actions?: string | null;
  created_at?: string;
}

interface TimelineEventData {
  id: string | number;
  kind: string;
  from_state?: WorkOrderState | null;
  to_state?: WorkOrderState | null;
  notes?: string | null;
  actor?: string | null;
  created_at?: string;
}

interface WorkOrderDetail {
  work_order?: WorkOrder;
  events?: TimelineEventData[];
}

interface TechniciansResponse {
  technicians?: Technician[];
}

interface TechSuggestion {
  technician: Technician;
  score?: number | null;
  reason?: string | null;
}

interface SuggestResponse {
  suggestions?: TechSuggestion[];
  note?: string | null;
}

const STATE_LABEL: Record<WorkOrderState, string> = {
  open: "Open",
  assigned: "Assigned",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
  cancelled: "Cancelled",
};

interface TransitionDef {
  to: WorkOrderState;
  label: string;
  Icon: ComponentType<{ size?: number | string; strokeWidth?: number | string }>;
}

// Allowed transitions client-side (mirror of the backend state machine)
const NEXT_STATES: Record<WorkOrderState, TransitionDef[]> = {
  open: [
    { to: "in_progress", label: "Start work", Icon: Play },
    { to: "cancelled", label: "Cancel", Icon: XCircle },
  ],
  assigned: [
    { to: "in_progress", label: "Start work", Icon: Play },
    { to: "cancelled", label: "Cancel", Icon: XCircle },
  ],
  in_progress: [
    { to: "resolved", label: "Mark resolved", Icon: CheckCircle2 },
    { to: "assigned", label: "Pause", Icon: Pause },
  ],
  resolved: [
    { to: "closed", label: "Close", Icon: CheckCircle2 },
    { to: "in_progress", label: "Re-open", Icon: Play },
  ],
  closed: [],
  cancelled: [],
};

const PRIORITY_BG: Record<string, { c: string; bg: string }> = {
  low: { c: "#64748b", bg: "rgba(100,116,139,0.10)" },
  normal: { c: "#1F3FFE", bg: "rgba(31,63,254,0.10)" },
  high: { c: "#f59e0b", bg: "rgba(245,158,11,0.14)" },
  critical: { c: "#ef4444", bg: "rgba(239,68,68,0.14)" },
};

function TimelineEvent({ ev }: { ev: TimelineEventData }) {
  const kind = ev.kind;
  const kindColor =
    kind === "transition"
      ? "#1F3FFE"
      : kind === "comment"
        ? "#0ea5e9"
        : kind === "assignment"
          ? "#7c3aed"
          : "#64748b";
  return (
    <div className="relative flex gap-3 pb-3">
      <div
        className="mt-[6px] size-2 shrink-0 rounded-full"
        style={{ background: kindColor, boxShadow: `0 0 0 3px ${kindColor}22` }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Badge
            className="rounded-[6px] border border-border-subtle bg-chip px-2 py-[2px] text-[9px] tracking-[0.06em] uppercase"
            style={{ color: kindColor }}
          >
            {kind}
          </Badge>
          {ev.from_state && ev.to_state && (
            <p className="text-[11px] text-ink-muted">
              {STATE_LABEL[ev.from_state]} →{" "}
              <span className="font-bold text-ink">{STATE_LABEL[ev.to_state]}</span>
            </p>
          )}
          <p className="ml-auto font-mono text-[10px] text-ink-muted">
            {ev.created_at?.replace("T", " ").slice(0, 19)}
          </p>
        </div>
        {ev.notes && <p className="mt-1 text-xs text-ink">{ev.notes}</p>}
        {ev.actor && <p className="mt-1 text-[10px] text-ink-muted">by {ev.actor}</p>}
      </div>
    </div>
  );
}

export interface WorkOrderDrawerProps {
  woId: string | null;
  equipment: Equipment[];
  onClose: () => void;
  onChanged?: () => void;
}

export default function WorkOrderDrawer({
  woId,
  equipment,
  onClose,
  onChanged,
}: WorkOrderDrawerProps) {
  const toast = useAppToast();
  const [data, setData] = useState<WorkOrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<TechSuggestion[]>([]);
  const [commentText, setCommentText] = useState("");

  async function load() {
    if (!woId) return;
    setLoading(true);
    try {
      const [d, t] = await Promise.all([
        apiFetch(`/api/v1/work-orders/${woId}`).then((r) => r.json() as Promise<WorkOrderDetail>),
        apiFetch(`/api/v1/technicians`).then((r) => r.json() as Promise<TechniciansResponse>),
      ]);
      setData(d);
      setTechnicians(t.technicians || []);
    } catch (e) {
      toast.error("Failed to load", (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [woId]);

  async function transition(toState: WorkOrderState, notes?: string) {
    try {
      const r = await apiFetch(`/api/v1/work-orders/${woId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to_state: toState, actor: "operator", notes }),
      });
      if (!r.ok)
        throw new Error(
          ((await r.json().catch(() => ({}))) as { detail?: string }).detail || `HTTP ${r.status}`,
        );
      await load();
      onChanged?.();
      toast.success(`Moved to ${STATE_LABEL[toState]}`);
    } catch (e) {
      toast.error("Transition failed", (e as Error).message);
    }
  }

  async function assign(techId: string | number) {
    try {
      const r = await apiFetch(`/api/v1/work-orders/${woId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ technician_id: techId || null, actor: "operator" }),
      });
      if (!r.ok)
        throw new Error(
          ((await r.json().catch(() => ({}))) as { detail?: string }).detail || `HTTP ${r.status}`,
        );
      await load();
      onChanged?.();
      toast.success(techId ? "Assigned" : "Unassigned");
    } catch (e) {
      toast.error("Assign failed", (e as Error).message);
    }
  }

  async function suggest() {
    setSuggesting(true);
    setSuggestions([]);
    try {
      const r = await apiFetch(`/api/v1/technicians/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ work_order_id: woId, top_k: 3 }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = (await r.json()) as SuggestResponse;
      setSuggestions(j.suggestions || []);
      if ((j.suggestions || []).length === 0) {
        toast.info("No suggestions", j.note || "Model returned empty");
      }
    } catch (e) {
      toast.error("Suggest failed", (e as Error).message);
    } finally {
      setSuggesting(false);
    }
  }

  async function comment() {
    if (!commentText.trim()) return;
    try {
      const r = await apiFetch(`/api/v1/work-orders/${woId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: commentText.trim(), actor: "operator" }),
      });
      if (!r.ok)
        throw new Error(
          ((await r.json().catch(() => ({}))) as { detail?: string }).detail || `HTTP ${r.status}`,
        );
      setCommentText("");
      await load();
      onChanged?.();
    } catch (e) {
      toast.error("Comment failed", (e as Error).message);
    }
  }

  const wo = data?.work_order;
  const events = data?.events || [];
  const eqMap = Object.fromEntries((equipment || []).map((e) => [e.id, e])) as Record<
    string,
    Equipment
  >;

  const isOpen = !!woId;
  const transitions = wo ? NEXT_STATES[wo.state] || [] : [];
  const prio = wo ? PRIORITY_BG[wo.priority] || PRIORITY_BG.normal : null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto bg-surface sm:max-w-md">
        <SheetHeader>
          {loading || !wo ? (
            <SheetTitle className="sr-only">Work order</SheetTitle>
          ) : (
            <div>
              <SheetTitle className="sr-only">{wo.title}</SheetTitle>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge
                  className="rounded-[6px] border px-2 py-[2px] text-[9px] tracking-[0.06em] uppercase"
                  style={
                    {
                      background: prio!.bg,
                      color: prio!.c,
                      borderColor: prio!.c + "44",
                    } as CSSProperties
                  }
                >
                  {wo.priority}
                </Badge>
                <Badge className="rounded-[6px] border border-border-subtle bg-chip px-2 py-[2px] text-[9px] tracking-[0.06em] text-ink-muted uppercase">
                  {wo.source}
                </Badge>
                <Badge className="rounded-[6px] border border-border-subtle bg-chip px-2 py-[2px] text-[9px] text-ink-muted">
                  {STATE_LABEL[wo.state]}
                </Badge>
              </div>
              <p className="text-base font-bold text-ink">{wo.title}</p>
              {wo.equipment_id && (
                <p className="mt-1 text-xs text-ink-muted">
                  {eqMap[wo.equipment_id]?.name || wo.equipment_id}
                </p>
              )}
            </div>
          )}
          {(loading || !wo) && <Loader2 className="size-4 animate-spin text-ink-muted" />}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-6">
          {!loading && wo && (
            <div>
              {/* Transitions */}
              {transitions.length > 0 && (
                <div className="mb-4">
                  <Eyebrow className="mb-2">Actions</Eyebrow>
                  <div className="flex flex-wrap gap-2">
                    {transitions.map((t) => (
                      <Button
                        key={t.to}
                        size="sm"
                        onClick={() => transition(t.to)}
                        variant={
                          t.to === "cancelled"
                            ? "destructive"
                            : t.to === "resolved" || t.to === "closed"
                              ? "default"
                              : "outline"
                        }
                      >
                        <t.Icon size={12} strokeWidth={2.2} />
                        {t.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              {wo.description && (
                <div className="mb-4">
                  <Eyebrow className="mb-2">Description</Eyebrow>
                  <p className="text-sm whitespace-pre-wrap text-ink">{wo.description}</p>
                </div>
              )}

              {/* AI diagnosis (when present — populated by agent/anomaly source) */}
              {(wo.diagnosis || wo.recommended_actions) && (
                <GlassCard className="mb-4 p-3" hover={false}>
                  {wo.diagnosis && (
                    <div className={wo.recommended_actions ? "mb-3" : ""}>
                      <Eyebrow className="mb-1">Diagnosis</Eyebrow>
                      <p className="text-sm whitespace-pre-wrap text-ink">{wo.diagnosis}</p>
                    </div>
                  )}
                  {wo.recommended_actions && (
                    <div>
                      <Eyebrow className="mb-1">Recommended actions</Eyebrow>
                      <p className="text-sm whitespace-pre-wrap text-ink">
                        {wo.recommended_actions}
                      </p>
                    </div>
                  )}
                </GlassCard>
              )}

              {/* Assignment */}
              <div className="mb-4">
                <div className="mb-2 flex items-center justify-between">
                  <Eyebrow>Assigned technician</Eyebrow>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={suggest}
                    disabled={suggesting}
                  >
                    {suggesting ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Sparkles size={11} strokeWidth={2.2} />
                    )}
                    Suggest
                  </Button>
                </div>
                <GlassSelect
                  value={wo.assigned_to || ""}
                  onChange={assign}
                  width="100%"
                  options={[
                    { value: "", label: "Unassigned" },
                    ...technicians.map((t) => ({
                      value: t.id,
                      label: `${t.name}${
                        t.skills?.length ? ` — ${t.skills.slice(0, 3).join(", ")}` : ""
                      }`,
                    })),
                  ]}
                />
                {suggestions.length > 0 && (
                  <div className="mt-2">
                    {suggestions.map((s, i) => (
                      <div
                        key={i}
                        className="mb-1 flex items-start gap-2 rounded-lg border border-border-subtle bg-chip px-2 py-2"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold">{s.technician.name}</p>
                            {s.score != null && (
                              <Badge
                                className="rounded-[6px] border px-2 text-[9px]"
                                style={
                                  {
                                    background: "rgba(16,185,129,0.12)",
                                    color: "#10b981",
                                    borderColor: "rgba(16,185,129,0.32)",
                                  } as CSSProperties
                                }
                              >
                                {Number(s.score).toFixed(2)}
                              </Badge>
                            )}
                          </div>
                          {s.reason && (
                            <p className="mt-[2px] text-[11px] text-ink-muted">{s.reason}</p>
                          )}
                        </div>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => assign(s.technician.id)}
                        >
                          <UserCog size={11} />
                          Assign
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator className="mb-4" />

              {/* Comment box */}
              <div className="mb-4">
                <Eyebrow className="mb-2">Add a comment</Eyebrow>
                <Textarea
                  rows={2}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Notes for the next operator…"
                  className="mb-2"
                />
                <div className="flex justify-end">
                  <Button size="sm" onClick={comment} disabled={!commentText.trim()}>
                    <MessageSquare size={12} />
                    Post
                  </Button>
                </div>
              </div>

              {/* Timeline */}
              <div>
                <Eyebrow className="mb-3">Timeline ({events.length})</Eyebrow>
                <div className="pl-1">
                  {events.map((ev) => (
                    <TimelineEvent key={ev.id} ev={ev} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
