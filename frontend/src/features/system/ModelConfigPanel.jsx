import { useState, useEffect } from "react";
import { Box, Flex, Text, Badge, Button, Spinner, useToast } from "@chakra-ui/react";
import { Cpu, Check, RotateCcw, Sparkles } from "lucide-react";
import GlassCard from "../../shared/ui/GlassCard";
import Eyebrow from "../../shared/ui/Eyebrow";
import GlassSelect from "../../shared/ui/GlassSelect";
import { apiFetch } from "../../shared/api/client";

// UI-editable roles (embed is fixed — changing it would invalidate the vectors).
const ROLES = ["text", "tool", "sql", "planner", "auditor", "rag", "vision"];
// One-click demo preset → all qwen (off the non-Chinese prod policy, fine for a demo).
const QWEN_PRESET = {
  text: "qwen2.5:14b", tool: "qwen2.5:14b", sql: "qwen2.5-coder:32b",
  planner: "qwen2.5:32b", auditor: "qwen2.5:14b", rag: "qwen2.5:14b",
};

export default function ModelConfigPanel() {
  const [roster, setRoster] = useState(null);   // role -> {model, purpose, maker, flag, params, country}
  const [avail, setAvail] = useState([]);        // [{name, maker, flag, params, country}]
  const [edits, setEdits] = useState({});        // role -> pending model
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function load() {
    setLoading(true);
    const [m, a] = await Promise.all([
      apiFetch("/api/v1/models").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      apiFetch("/api/v1/models/available").then((r) => (r.ok ? r.json() : { models: [] })).catch(() => ({ models: [] })),
    ]);
    setRoster(m?.tasks || null);
    setAvail(a?.models || []);
    if (m?.tasks) setEdits(Object.fromEntries(ROLES.filter((r) => m.tasks[r]).map((r) => [r, m.tasks[r].model])));
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const country = Object.fromEntries(avail.map((a) => [a.name, a.country]));
  const options = avail.map((a) => ({
    value: a.name,
    label: `${a.name}${a.flag ? "  " + a.flag : ""}${a.params && a.params !== "—" ? " · " + a.params : ""}`,
  }));
  const dirty = roster && ROLES.some((r) => roster[r] && edits[r] !== roster[r].model);

  async function applyOverrides(overrides) {
    setBusy(true);
    try {
      const res = await apiFetch("/api/v1/models", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overrides }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `HTTP ${res.status}`);
      await load();
      toast({ title: "Models applied — live", description: "The next request uses them (no restart).",
        status: "success", duration: 3200, position: "bottom-right", variant: "subtle" });
    } catch (e) {
      toast({ title: "Apply failed", description: String(e.message || e), status: "error", duration: 5000, position: "bottom-right" });
    } finally { setBusy(false); }
  }

  async function resetDefaults() {
    setBusy(true);
    try {
      const res = await apiFetch("/api/v1/models/reset", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
      toast({ title: "Reset to committed defaults", status: "info", duration: 3000, position: "bottom-right", variant: "subtle" });
    } catch (e) {
      toast({ title: "Reset failed", status: "error", duration: 4000, position: "bottom-right" });
    } finally { setBusy(false); }
  }

  function applyPreset(preset) {
    // only roles whose preset model is actually installed
    const names = new Set(avail.map((a) => a.name));
    const ov = Object.fromEntries(Object.entries(preset).filter(([, m]) => names.has(m)));
    if (!Object.keys(ov).length) {
      toast({ title: "Preset models not installed on the server", status: "warning", duration: 4000, position: "bottom-right" });
      return;
    }
    applyOverrides(ov);
  }

  return (
    <Box mb={5}>
      <Flex align="center" justify="space-between" mb={2} flexWrap="wrap" gap={2}>
        <Eyebrow mb={0}>AI Models — configure which model runs where (live)</Eyebrow>
        <Flex gap={2} align="center">
          <Button size="xs" variant="outline" leftIcon={<Sparkles size={12} />} isDisabled={busy || loading}
            onClick={() => applyPreset(QWEN_PRESET)}>All qwen (demo)</Button>
          <Button size="xs" variant="ghost" leftIcon={<RotateCcw size={12} />} isDisabled={busy || loading}
            onClick={resetDefaults}>Eval defaults</Button>
        </Flex>
      </Flex>

      <GlassCard p={2}>
        {loading ? (
          <Flex align="center" gap={2} px={3} py={3} color="text.muted">
            <Spinner size="xs" /><Text fontSize="sm">Loading model roster…</Text>
          </Flex>
        ) : !roster ? (
          <Text fontSize="sm" color="status.bad" px={3} py={3}>Couldn't load models (backend / Ollama unreachable).</Text>
        ) : (
          <>
            {ROLES.filter((r) => roster[r]).map((r) => {
              const cur = roster[r];
              const sel = edits[r];
              const changed = sel !== cur.model;
              const offPolicy = country[sel] === "CN";
              return (
                <Flex key={r} align="center" gap={3} px={3} py="10px" borderRadius="10px"
                  _hover={{ bg: "accent.glow" }} flexWrap={{ base: "wrap", md: "nowrap" }}>
                  <Flex flex={{ base: "1 0 100%", md: "0 0 150px" }} align="center" gap={2} minW={0}>
                    <Box w="26px" h="26px" borderRadius="8px" flexShrink={0} display="flex" alignItems="center"
                      justifyContent="center" bg="accent.glow" border="1px solid" borderColor="border.brand" color="accent.primary">
                      <Cpu size={13} strokeWidth={2} />
                    </Box>
                    <Box minW={0}>
                      <Text fontSize="sm" fontWeight={700} color="text.primary">{r}</Text>
                      <Text fontSize="10px" color="text.faint" noOfLines={1}>{cur.purpose}</Text>
                    </Box>
                  </Flex>
                  <Box flex={{ base: "1 0 auto", md: "0 0 280px" }}>
                    <GlassSelect value={sel} width="280px" options={options}
                      onChange={(v) => setEdits((e) => ({ ...e, [r]: v }))} />
                  </Box>
                  <Flex flex="1" gap={2} align="center" minW={0}>
                    {changed && <Badge colorScheme="blue" variant="subtle" fontSize="9px">changed</Badge>}
                    {offPolicy && <Badge colorScheme="orange" variant="subtle" fontSize="9px">off-policy 🇨🇳</Badge>}
                  </Flex>
                </Flex>
              );
            })}

            <Flex align="center" justify="space-between" px={3} py="10px" borderTop="1px solid" borderColor="border.subtle" mt={1} flexWrap="wrap" gap={2}>
              <Text fontSize="11px" color="text.faint">
                Live + session-scoped — applies on the next request; a backend restart reverts to the committed config. Embeddings are fixed (changing breaks the vector index).
              </Text>
              <Flex gap={2}>
                <Button size="sm" variant="ghost" isDisabled={!dirty || busy}
                  onClick={() => roster && setEdits(Object.fromEntries(ROLES.filter((r) => roster[r]).map((r) => [r, roster[r].model])))}>
                  Revert
                </Button>
                <Button size="sm" colorScheme="blue" leftIcon={busy ? <Spinner size="xs" /> : <Check size={14} />}
                  isDisabled={!dirty || busy} onClick={() => applyOverrides(edits)}>
                  {busy ? "Applying…" : "Apply"}
                </Button>
              </Flex>
            </Flex>
          </>
        )}
      </GlassCard>
    </Box>
  );
}
