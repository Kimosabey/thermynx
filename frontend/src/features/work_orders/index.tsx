import { useEffect, useState, type CSSProperties } from "react";
import { ClipboardList, Plus, Filter, RefreshCw, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import PageShell from "@/shared/ui/PageShell";
import PageHeader from "@/shared/ui/PageHeader";
import PageHeaderIcon from "@/shared/ui/PageHeaderIcon";
import GlassCard from "@/shared/ui/GlassCard";
import Eyebrow from "@/shared/ui/Eyebrow";
import GlassSelect from "@/shared/ui/GlassSelect";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/shared/api/client";
import useAppToast from "@/shared/hooks/useAppToast";
import WorkOrderDrawer, { type WorkOrder } from "./WorkOrderDrawer";

// ── Response shapes (derived from legacy field usage) ──────────────────────────
export interface Equipment {
  id: string;
  name: string;
}

export interface Technician {
  id: string;
  name: string;
  skills?: string[];
}

interface WorkOrderListResponse {
  rows?: WorkOrder[];
}

interface WorkOrderStats {
  total?: number;
  by_state?: Record<string, number>;
  resolved_or_closed?: number;
  mttr_hours?: number | string | null;
  repeat_issue_rate?: number | null;
}

const STATE_META: Record<string, { c: string; bg: string; b: string }> = {
  open: { c: "#0ea5e9", bg: "rgba(14,165,233,0.12)", b: "rgba(14,165,233,0.32)" },
  assigned: { c: "#7c3aed", bg: "rgba(124,58,237,0.12)", b: "rgba(124,58,237,0.32)" },
  in_progress: { c: "#f59e0b", bg: "rgba(245,158,11,0.12)", b: "rgba(245,158,11,0.32)" },
  resolved: { c: "#10b981", bg: "rgba(16,185,129,0.12)", b: "rgba(16,185,129,0.32)" },
  closed: { c: "#64748b", bg: "rgba(100,116,139,0.12)", b: "rgba(100,116,139,0.32)" },
  cancelled: { c: "#64748b", bg: "rgba(100,116,139,0.10)", b: "rgba(100,116,139,0.24)" },
};

const PRIORITY_META: Record<string, { c: string; bg: string }> = {
  low: { c: "#64748b", bg: "rgba(100,116,139,0.10)" },
  normal: { c: "#1F3FFE", bg: "rgba(31,63,254,0.10)" },
  high: { c: "#f59e0b", bg: "rgba(245,158,11,0.14)" },
  critical: { c: "#ef4444", bg: "rgba(239,68,68,0.14)" },
};

const SOURCE_LABEL: Record<string, string> = {
  manual: "manual",
  agent: "agent",
  anomaly: "anomaly",
  pm: "PM",
};

function StateChip({ state }: { state?: string }) {
  const m = STATE_META[state ?? ""] || STATE_META.open;
  return (
    <Badge
      className="w-fit rounded-[6px] border px-2 py-[2px] text-[9px] tracking-[0.06em] uppercase"
      style={{ background: m.bg, color: m.c, borderColor: m.b } as CSSProperties}
    >
      {(state || "—").replace("_", " ")}
    </Badge>
  );
}

function PriorityChip({ priority }: { priority?: string }) {
  const m = PRIORITY_META[priority ?? ""] || PRIORITY_META.normal;
  return (
    <Badge
      className="w-fit rounded-[6px] border px-2 py-[2px] text-[9px] tracking-[0.06em] uppercase"
      style={{ background: m.bg, color: m.c, borderColor: m.c + "44" } as CSSProperties}
    >
      {priority}
    </Badge>
  );
}

function StatTile({
  label,
  value,
  color,
  delay = 0,
}: {
  label: string;
  value: React.ReactNode;
  color?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay }}
    >
      <GlassCard className="p-4" hover={false}>
        <Eyebrow className="mb-2">{label}</Eyebrow>
        <p
          className="text-2xl font-bold tabular-nums text-ink"
          style={color ? ({ color } as CSSProperties) : undefined}
        >
          {value}
        </p>
      </GlassCard>
    </motion.div>
  );
}

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipment: Equipment[];
  onCreated?: (wo: WorkOrder) => void;
}

function CreateModal({ isOpen, onClose, equipment, onCreated }: CreateModalProps) {
  const toast = useAppToast();
  const [title, setTitle] = useState("");
  const [equipmentId, setEquipmentId] = useState<string>("");
  const [priority, setPriority] = useState("normal");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (title.trim().length < 3) {
      toast.warning("Title is required");
      return;
    }
    setSubmitting(true);
    try {
      const r = await apiFetch("/api/v1/work-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          equipment_id: equipmentId || null,
          priority,
          description: description.trim() || null,
          created_by: "operator",
          source: "manual",
        }),
      });
      if (!r.ok)
        throw new Error(
          ((await r.json().catch(() => ({}))) as { detail?: string }).detail || `HTTP ${r.status}`,
        );
      const wo = (await r.json()) as WorkOrder;
      toast.success("Work order created", wo.title);
      setTitle("");
      setEquipmentId("");
      setPriority("normal");
      setDescription("");
      onCreated?.(wo);
      onClose();
    } catch (e) {
      toast.error("Create failed", (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New work order</DialogTitle>
        </DialogHeader>
        <div>
          <div className="mb-3">
            <Label className="mb-1.5 text-xs text-ink-muted">Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Inspect Chiller 1 condenser approach"
            />
          </div>
          <div className="mb-3 grid grid-cols-[1fr_160px] gap-3">
            <div>
              <Label className="mb-1.5 text-xs text-ink-muted">Equipment</Label>
              <GlassSelect
                value={equipmentId}
                onChange={(v) => setEquipmentId(String(v))}
                width="100%"
                placeholder="(none)"
                options={[
                  { value: "", label: "(none)" },
                  ...equipment.map((e) => ({ value: e.id, label: e.name })),
                ]}
              />
            </div>
            <div>
              <Label className="mb-1.5 text-xs text-ink-muted">Priority</Label>
              <GlassSelect
                value={priority}
                onChange={(v) => setPriority(String(v))}
                width="100%"
                options={[
                  { value: "low", label: "Low" },
                  { value: "normal", label: "Normal" },
                  { value: "high", label: "High" },
                  { value: "critical", label: "Critical" },
                ]}
              />
            </div>
          </div>
          <div>
            <Label className="mb-1.5 text-xs text-ink-muted">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="What needs to happen, why, and any expected outcome…"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="size-4 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function WorkOrdersPage() {
  const toast = useAppToast();
  const [createOpen, setCreateOpen] = useState(false);

  const [rows, setRows] = useState<WorkOrder[]>([]);
  const [stats, setStats] = useState<WorkOrderStats | null>(null);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterState, setFilterState] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    const q = new URLSearchParams();
    if (filterState) q.set("state", filterState);
    if (filterPriority) q.set("priority", filterPriority);
    if (filterSource) q.set("source", filterSource);
    q.set("limit", "200");
    try {
      const [list, st, eq] = await Promise.all([
        apiFetch(`/api/v1/work-orders?${q.toString()}`).then(
          (r) => r.json() as Promise<WorkOrderListResponse>,
        ),
        apiFetch(`/api/v1/work-orders/stats`).then((r) => r.json() as Promise<WorkOrderStats>),
        apiFetch(`/api/v1/equipment`).then((r) => r.json() as Promise<Equipment[]>),
      ]);
      setRows(list.rows || []);
      setStats(st);
      setEquipment(eq || []);
    } catch (e) {
      toast.error("Failed to load", (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterState, filterPriority, filterSource]);

  const counts = stats?.by_state || {};
  const openCount = (counts.open || 0) + (counts.assigned || 0) + (counts.in_progress || 0);

  return (
    <PageShell>
      <PageHeader
        title="Work Orders"
        icon={<PageHeaderIcon icon={<ClipboardList size={20} strokeWidth={1.85} />} />}
        subtitle="Operator tasks — every state change is logged"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={refresh}>
              <RefreshCw size={14} strokeWidth={2.2} />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus size={14} strokeWidth={2.2} />
              New
            </Button>
          </div>
        }
      />

      {/* Stat tiles */}
      {stats && (
        <div className="mb-6 grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatTile label="Total" value={stats.total ?? 0} delay={0} />
          <StatTile label="Open / Active" value={openCount} color="#0ea5e9" delay={0.04} />
          <StatTile
            label="Resolved/Closed"
            value={stats.resolved_or_closed ?? 0}
            color="#10b981"
            delay={0.08}
          />
          <StatTile label="MTTR (h)" value={stats.mttr_hours ?? "—"} delay={0.12} />
          <StatTile
            label="Repeat-issue rate"
            value={`${Math.round((stats.repeat_issue_rate ?? 0) * 100)}%`}
            delay={0.16}
          />
        </div>
      )}

      {/* Filters */}
      <GlassCard className="mb-4 p-3" hover={false}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter size={13} strokeWidth={2} color="#64748b" />
            <p className="text-[11px] text-ink-muted">Filter:</p>
          </div>
          <GlassSelect
            value={filterState}
            onChange={(v) => setFilterState(String(v))}
            width="140px"
            options={[
              { value: "", label: "All states" },
              { value: "open", label: "Open" },
              { value: "assigned", label: "Assigned" },
              { value: "in_progress", label: "In progress" },
              { value: "resolved", label: "Resolved" },
              { value: "closed", label: "Closed" },
              { value: "cancelled", label: "Cancelled" },
            ]}
          />
          <GlassSelect
            value={filterPriority}
            onChange={(v) => setFilterPriority(String(v))}
            width="130px"
            options={[
              { value: "", label: "Any priority" },
              { value: "critical", label: "Critical" },
              { value: "high", label: "High" },
              { value: "normal", label: "Normal" },
              { value: "low", label: "Low" },
            ]}
          />
          <GlassSelect
            value={filterSource}
            onChange={(v) => setFilterSource(String(v))}
            width="130px"
            options={[
              { value: "", label: "Any source" },
              { value: "manual", label: "Manual" },
              { value: "agent", label: "Agent" },
              { value: "anomaly", label: "Anomaly" },
              { value: "pm", label: "PM" },
            ]}
          />
        </div>
      </GlassCard>

      {/* List */}
      <GlassCard className="overflow-hidden p-0" hover={false}>
        <div className="overflow-x-auto">
          <div className="min-w-[820px]">
            <div className="grid grid-cols-[110px_110px_130px_minmax(0,1fr)_100px_100px_80px] gap-3 border-b border-border-subtle px-4 py-3">
              <Eyebrow>State</Eyebrow>
              <Eyebrow>Priority</Eyebrow>
              <Eyebrow>Equipment</Eyebrow>
              <Eyebrow>Title</Eyebrow>
              <Eyebrow>Source</Eyebrow>
              <Eyebrow>When</Eyebrow>
              <Eyebrow className="text-right">Open</Eyebrow>
            </div>
            {loading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-8">
                <Loader2 className="size-4 animate-spin" />
                <p className="text-xs text-ink-muted">Loading…</p>
              </div>
            ) : rows.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-ink-muted">
                No work orders match these filters.
              </p>
            ) : (
              rows.map((wo) => (
                <div
                  key={wo.id}
                  className="grid cursor-pointer grid-cols-[110px_110px_130px_minmax(0,1fr)_100px_100px_80px] gap-3 border-b border-border-subtle px-4 py-[10px] hover:bg-[rgba(31,63,254,0.04)]"
                  onClick={() => setSelectedId(wo.id)}
                >
                  <StateChip state={wo.state} />
                  <PriorityChip priority={wo.priority} />
                  <p className="line-clamp-1 text-xs text-ink">{wo.equipment_id || "—"}</p>
                  <p className="line-clamp-2 text-xs text-ink">{wo.title}</p>
                  <Badge className="w-fit rounded-[6px] border border-border-subtle bg-chip px-2 text-[9px] text-ink-muted">
                    {SOURCE_LABEL[wo.source] || wo.source}
                  </Badge>
                  <p className="line-clamp-1 font-mono text-[11px] text-ink-muted">
                    {wo.created_at?.slice(5, 16).replace("T", " ")}
                  </p>
                  <div className="text-right">
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(wo.id);
                      }}
                    >
                      Open
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </GlassCard>

      {/* Detail drawer */}
      <WorkOrderDrawer
        woId={selectedId}
        equipment={equipment}
        onClose={() => setSelectedId(null)}
        onChanged={refresh}
      />

      {/* Create modal */}
      <CreateModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        equipment={equipment}
        onCreated={refresh}
      />
    </PageShell>
  );
}
