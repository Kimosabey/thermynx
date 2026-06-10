import { useState, useEffect } from "react";
import { Cpu, Check, RotateCcw, Sparkles, Loader2 } from "lucide-react";
import GlassCard from "@/shared/ui/GlassCard";
import Eyebrow from "@/shared/ui/Eyebrow";
import GlassSelect from "@/shared/ui/GlassSelect";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import useAppToast from "@/shared/hooks/useAppToast";
import { apiFetch } from "@/shared/api/client";

// UI-editable roles (embed is fixed — changing it would invalidate the vectors).
const ROLES = ["text", "tool", "sql", "planner", "auditor", "rag", "vision"] as const;
type Role = (typeof ROLES)[number];

// One-click demo preset → all qwen (off the non-Chinese prod policy, fine for a demo).
const QWEN_PRESET: Record<string, string> = {
  text: "qwen2.5:14b",
  tool: "qwen2.5:14b",
  sql: "qwen2.5-coder:32b",
  planner: "qwen2.5:32b",
  auditor: "qwen2.5:14b",
  rag: "qwen2.5:14b",
};

interface RosterEntry {
  model: string;
  purpose?: string;
  maker?: string;
  flag?: string;
  params?: string;
  country?: string;
}

interface AvailableModel {
  name: string;
  maker?: string;
  flag?: string;
  params?: string;
  country?: string;
}

interface ModelsResponse {
  tasks?: Record<string, RosterEntry>;
}

interface AvailableResponse {
  models?: AvailableModel[];
}

export default function ModelConfigPanel() {
  const [roster, setRoster] = useState<Record<string, RosterEntry> | null>(null); // role -> {model, purpose, maker, flag, params, country}
  const [avail, setAvail] = useState<AvailableModel[]>([]); // [{name, maker, flag, params, country}]
  const [edits, setEdits] = useState<Record<string, string>>({}); // role -> pending model
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const toast = useAppToast();

  async function load() {
    setLoading(true);
    const [m, a] = await Promise.all([
      apiFetch("/api/v1/models")
        .then((r) => (r.ok ? (r.json() as Promise<ModelsResponse>) : null))
        .catch(() => null),
      apiFetch("/api/v1/models/available")
        .then((r) => (r.ok ? (r.json() as Promise<AvailableResponse>) : { models: [] }))
        .catch(() => ({ models: [] as AvailableModel[] })),
    ]);
    setRoster(m?.tasks || null);
    setAvail(a?.models || []);
    if (m?.tasks) {
      const tasks = m.tasks;
      setEdits(
        Object.fromEntries(
          ROLES.filter((r) => tasks[r]).map((r) => [r, tasks[r].model]),
        ),
      );
    }
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  const country: Record<string, string | undefined> = Object.fromEntries(
    avail.map((a) => [a.name, a.country]),
  );
  const options = avail.map((a) => ({
    value: a.name,
    label: `${a.name}${a.flag ? "  " + a.flag : ""}${a.params && a.params !== "—" ? " · " + a.params : ""}`,
  }));
  const dirty = !!roster && ROLES.some((r) => roster[r] && edits[r] !== roster[r].model);

  async function applyOverrides(overrides: Record<string, string>) {
    setBusy(true);
    try {
      const res = await apiFetch("/api/v1/models", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overrides }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { detail?: string };
        throw new Error(body.detail || `HTTP ${res.status}`);
      }
      await load();
      toast.success("Models applied — live", "The next request uses them (no restart).");
    } catch (e) {
      const err = e as { message?: string };
      toast.error("Apply failed", String(err.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function resetDefaults() {
    setBusy(true);
    try {
      const res = await apiFetch("/api/v1/models/reset", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
      toast.info("Reset to committed defaults");
    } catch {
      toast.error("Reset failed");
    } finally {
      setBusy(false);
    }
  }

  function applyPreset(preset: Record<string, string>) {
    // only roles whose preset model is actually installed
    const names = new Set(avail.map((a) => a.name));
    const ov = Object.fromEntries(
      Object.entries(preset).filter(([, m]) => names.has(m)),
    );
    if (!Object.keys(ov).length) {
      toast.warning("Preset models not installed on the server");
      return;
    }
    applyOverrides(ov);
  }

  return (
    <div className="mb-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <Eyebrow className="mb-0">AI Models — configure which model runs where (live)</Eyebrow>
        <div className="flex items-center gap-2">
          <Button
            size="xs"
            variant="outline"
            disabled={busy || loading}
            onClick={() => applyPreset(QWEN_PRESET)}
          >
            <Sparkles size={12} />
            All qwen (demo)
          </Button>
          <Button size="xs" variant="ghost" disabled={busy || loading} onClick={resetDefaults}>
            <RotateCcw size={12} />
            Eval defaults
          </Button>
        </div>
      </div>

      <GlassCard className="p-2">
        {loading ? (
          <div className="flex items-center gap-2 px-3 py-3 text-ink-muted">
            <Loader2 className="size-3 animate-spin" />
            <p className="text-sm">Loading model roster…</p>
          </div>
        ) : !roster ? (
          <p className="px-3 py-3 text-sm text-bad">
            Couldn't load models (backend / Ollama unreachable).
          </p>
        ) : (
          <>
            {ROLES.filter((r) => roster[r]).map((r: Role) => {
              const cur = roster[r];
              const sel = edits[r];
              const changed = sel !== cur.model;
              const offPolicy = country[sel] === "CN";
              return (
                <div
                  key={r}
                  className="flex flex-wrap items-center gap-3 rounded-[10px] px-3 py-[10px] hover:bg-[var(--glow)] md:flex-nowrap"
                >
                  <div className="flex min-w-0 flex-[1_0_100%] items-center gap-2 md:flex-[0_0_150px]">
                    <div className="flex size-[26px] shrink-0 items-center justify-center rounded-md border border-border-brand bg-[var(--glow)] text-brand">
                      <Cpu size={13} strokeWidth={2} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-ink">{r}</p>
                      <p className="line-clamp-1 text-[10px] text-ink-faint">{cur.purpose}</p>
                    </div>
                  </div>
                  <div className="flex-[1_0_auto] md:flex-[0_0_280px]">
                    <GlassSelect
                      value={sel}
                      width="280px"
                      options={options}
                      onChange={(v) => setEdits((e) => ({ ...e, [r]: String(v) }))}
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    {changed && (
                      <Badge className="h-auto rounded-[6px] border border-border-brand bg-[var(--glow)] px-2 py-[2px] text-[9px] font-medium text-ink-brand">
                        changed
                      </Badge>
                    )}
                    {offPolicy && (
                      <Badge className="h-auto rounded-[6px] border border-warn/40 bg-warn/10 px-2 py-[2px] text-[9px] font-medium text-warn">
                        off-policy 🇨🇳
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}

            <div className="mt-1 flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle px-3 py-[10px]">
              <p className="text-[11px] text-ink-faint">
                Live + session-scoped — applies on the next request; a backend restart reverts to
                the committed config. Embeddings are fixed (changing breaks the vector index).
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!dirty || busy}
                  onClick={() =>
                    roster &&
                    setEdits(
                      Object.fromEntries(
                        ROLES.filter((r) => roster[r]).map((r) => [r, roster[r].model]),
                      ),
                    )
                  }
                >
                  Revert
                </Button>
                <Button
                  size="sm"
                  disabled={!dirty || busy}
                  onClick={() => applyOverrides(edits)}
                >
                  {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check size={14} />}
                  {busy ? "Applying…" : "Apply"}
                </Button>
              </div>
            </div>
          </>
        )}
      </GlassCard>
    </div>
  );
}
