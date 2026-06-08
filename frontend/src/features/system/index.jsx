import { useEffect, useState, useCallback } from "react";
import { Box, Flex, Text, Grid, Badge, Spinner, Tooltip, useToast } from "@chakra-ui/react";
import {
  Server, Database, HardDrive, BookOpen, Cpu, ExternalLink, Copy,
  ScrollText, Activity, Settings as SettingsIcon, ShieldCheck,
  BarChart2, Bell, FileText, Radio, RefreshCw,
} from "lucide-react";
import { motion } from "framer-motion";
import PageShell from "../../shared/ui/PageShell";
import PageHeader from "../../shared/ui/PageHeader";
import PageHeaderIcon from "../../shared/ui/PageHeaderIcon";
import GlassCard from "../../shared/ui/GlassCard";
import Eyebrow from "../../shared/ui/Eyebrow";

const MotionBox = motion.create(Box);

// healthUrl: endpoint to GET for liveness. null = not HTTP-checkable (DB conn strings).
const SERVICES = [
  {
    group: "Frontend",
    items: [
      { Icon: Server,       label: "Frontend",         url: "http://localhost:5173",                         port: 5173,  healthUrl: "http://localhost:5173",                        role: "Vite dev server (this app)" },
      { Icon: Server,       label: "Frontend (preview)",url: "http://localhost:4173",                        port: 4173,  healthUrl: null,                                           role: "Vite preview build (npm run preview)" },
    ],
  },
  {
    group: "Backend API",
    items: [
      { Icon: Activity,     label: "Health",            url: "http://localhost:8000/healthz",                port: 8000,  healthUrl: "http://localhost:8000/healthz",                role: "Backend liveness" },
      { Icon: Activity,     label: "Full health",       url: "http://localhost:8000/api/v1/health",          port: 8000,  healthUrl: "http://localhost:8000/api/v1/health",          role: "Backend + DB + Ollama state" },
      { Icon: BookOpen,     label: "Swagger UI",        url: "http://localhost:8000/docs",                   port: 8000,  healthUrl: "http://localhost:8000/healthz",                role: "Interactive OpenAPI explorer" },
      { Icon: BookOpen,     label: "ReDoc",             url: "http://localhost:8000/redoc",                  port: 8000,  healthUrl: "http://localhost:8000/healthz",                role: "Read-only OpenAPI view" },
      { Icon: ScrollText,   label: "OpenAPI JSON",      url: "http://localhost:8000/openapi.json",           port: 8000,  healthUrl: "http://localhost:8000/openapi.json",           role: "Machine-readable schema" },
      { Icon: BarChart2,    label: "Metrics",           url: "http://localhost:8000/metrics",                port: 8000,  healthUrl: "http://localhost:8000/metrics",                role: "Prometheus scrape endpoint" },
      { Icon: SettingsIcon, label: "Capabilities",      url: "http://localhost:8000/api/v1/capabilities",    port: 8000,  healthUrl: "http://localhost:8000/api/v1/capabilities",    role: "Self-describing feature catalogue" },
      { Icon: ShieldCheck,  label: "Slack health",      url: "http://localhost:8000/api/v1/slack/health",    port: 8000,  healthUrl: "http://localhost:8000/api/v1/slack/health",    role: "Slack integration status" },
    ],
  },
  {
    group: "Observability",
    items: [
      { Icon: BarChart2,    label: "Grafana",           url: "http://localhost:3030",                        port: 3030,  healthUrl: "/proxy/grafana",             role: "Dashboards — API Overview + AI Operations" },
      { Icon: Radio,        label: "Prometheus",        url: "http://localhost:9292",                        port: 9292,  healthUrl: "/proxy/prometheus",              role: "Metrics store + alert evaluation" },
      { Icon: Bell,         label: "Alertmanager",      url: "http://localhost:9394",                        port: 9394,  healthUrl: "/proxy/alertmanager",              role: "Alert routing + silences" },
      { Icon: FileText,     label: "Loki",              url: "http://localhost:3100",                        port: 3100,  healthUrl: "/proxy/loki",                  role: "Log aggregation (Promtail → Loki)" },
      { Icon: Radio,        label: "Promtail targets",  url: "http://localhost:9080/targets",                port: 9080,  healthUrl: "/proxy/promtail",                  role: "Log scrape agent — target list" },
    ],
  },
  {
    group: "Datastores",
    items: [
      { Icon: Database,     label: "Unicharm MySQL",    url: "mysql://localhost:3307",                       port: 3307,  healthUrl: null,                                           role: "Telemetry source (read-only)" },
      { Icon: Database,     label: "Postgres (pgvector)",url: "postgres://localhost:5442",                   port: 5442,  healthUrl: null,                                           role: "App state + RAG embeddings" },
      { Icon: HardDrive,    label: "Redis",             url: "redis://localhost:6380",                       port: 6380,  healthUrl: null,                                           role: "Cache + arq queue" },
      { Icon: HardDrive,    label: "Redis Commander",   url: "http://localhost:8181",                        port: 8181,  healthUrl: "/proxy/redis-commander",                        role: "Browser UI for Redis" },
    ],
  },
  {
    group: "AI Runtime",
    items: [
      { Icon: Cpu,          label: "Ollama API",        url: "http://100.125.103.28:11434",                  port: 11434, healthUrl: "http://100.125.103.28:11434/api/tags",         role: "On-prem LLM server (phi4 + mistral-small3.2)" },
      { Icon: Cpu,          label: "Ollama models",     url: "http://100.125.103.28:11434/api/tags",         port: 11434, healthUrl: "http://100.125.103.28:11434/api/tags",         role: "List installed models" },
    ],
  },
];

// Collect all unique healthUrls for bulk polling
const HEALTH_URLS = [...new Set(
  SERVICES.flatMap(g => g.items.map(i => i.healthUrl)).filter(Boolean)
)];

function useLiveStatus() {
  const [status, setStatus] = useState({}); // url → "up"|"down"|"pending"
  const [lastChecked, setLastChecked] = useState(null);

  const poll = useCallback(async () => {
    setStatus(prev => Object.fromEntries(HEALTH_URLS.map(u => [u, prev[u] ?? "pending"])));
    const results = await Promise.allSettled(
      HEALTH_URLS.map(url =>
        fetch(url, { method: "GET", signal: AbortSignal.timeout(4000) })
          .then(r => ({ url, ok: r.status < 500 }))
          .catch(() => ({ url, ok: false }))
      )
    );
    const next = {};
    results.forEach(r => {
      if (r.status === "fulfilled") next[r.value.url] = r.value.ok ? "up" : "down";
    });
    setStatus(next);
    setLastChecked(new Date());
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, [poll]);

  return { status, poll, lastChecked };
}

function StatusDot({ healthUrl, status }) {
  if (!healthUrl) return (
    <Tooltip label="Not HTTP-checkable" hasArrow placement="top">
      <Box w="8px" h="8px" borderRadius="full" bg="rgba(255,255,255,0.15)" flexShrink={0} />
    </Tooltip>
  );
  const s = status[healthUrl] ?? "pending";
  const map = {
    up:      { bg: "#10b981", shadow: "0 0 6px rgba(16,185,129,0.55)", label: "Reachable" },
    down:    { bg: "#ef4444", shadow: "0 0 6px rgba(239,68,68,0.55)",  label: "Unreachable" },
    pending: { bg: "rgba(255,255,255,0.25)", shadow: "none",           label: "Checking…" },
  };
  const { bg, shadow, label } = map[s];
  return (
    <Tooltip label={label} hasArrow placement="top">
      <Box w="8px" h="8px" borderRadius="full" bg={bg} boxShadow={shadow} flexShrink={0}
        transition="background 0.3s, box-shadow 0.3s" />
    </Tooltip>
  );
}

function copyText(t, toast) {
  navigator.clipboard.writeText(t).then(
    () => toast({ title: "Copied", description: t, status: "success", duration: 1400, position: "bottom-right", isClosable: true }),
    () => toast({ title: "Copy failed", status: "error", duration: 1400 }),
  );
}

function ServiceRow({ Icon, label, url, port, role, healthUrl, status, idx }) {
  const toast = useToast();
  const isHttp = url.startsWith("http");
  return (
    <MotionBox initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: Math.min(idx, 12) * 0.015 }}>
      <Flex align="center" gap={3} px={3} py="10px" borderRadius="10px"
        _hover={{ bg: "rgba(31,63,254,0.04)" }} transition="background 0.15s">

        {/* Status dot */}
        <StatusDot healthUrl={healthUrl} status={status} />

        {/* Icon */}
        <Box w="32px" h="32px" borderRadius="9px" flexShrink={0}
          display="flex" alignItems="center" justifyContent="center"
          bg="accent.glow" border="1px solid" borderColor="border.brand" color="accent.primary">
          <Icon size={15} strokeWidth={2} />
        </Box>

        {/* Label + role */}
        <Box flex="1" minW={0}>
          <Flex align="center" gap={2}>
            <Text fontSize="sm" fontWeight={700} color="text.primary">{label}</Text>
            <Badge fontSize="9px" bg="bg.chip" color="text.muted"
              border="1px solid" borderColor="border.subtle"
              borderRadius="6px" px={2} py="2px" sx={{ fontVariantNumeric: "tabular-nums" }}>
              :{port}
            </Badge>
          </Flex>
          <Text fontSize="11px" color="text.muted" mt="2px">{role}</Text>
        </Box>

        {/* URL + actions */}
        <Flex gap={2} align="center">
          <Text fontSize="10px" fontFamily="mono" color="text.faint"
            maxW="240px" noOfLines={1} title={url}>{url}</Text>
          <Box as="button" aria-label={`Copy ${url}`} onClick={() => copyText(url, toast)}
            w="28px" h="28px" borderRadius="8px" display="flex" alignItems="center" justifyContent="center"
            border="1px solid" borderColor="border.subtle" color="text.muted"
            _hover={{ color: "accent.primary", borderColor: "border.brand", bg: "accent.glow" }}
            transition="all 0.15s">
            <Copy size={12} strokeWidth={2} />
          </Box>
          {isHttp && (
            <Box as="a" href={url} target="_blank" rel="noopener noreferrer"
              aria-label={`Open ${url}`}
              w="28px" h="28px" borderRadius="8px" display="flex" alignItems="center" justifyContent="center"
              border="1px solid" borderColor="border.subtle" color="text.muted"
              _hover={{ color: "accent.primary", borderColor: "border.brand", bg: "accent.glow" }}
              transition="all 0.15s">
              <ExternalLink size={12} strokeWidth={2} />
            </Box>
          )}
        </Flex>
      </Flex>
    </MotionBox>
  );
}

function SummaryBar({ status, poll, lastChecked, loading }) {
  const total  = HEALTH_URLS.length;
  const up     = HEALTH_URLS.filter(u => status[u] === "up").length;
  const down   = HEALTH_URLS.filter(u => status[u] === "down").length;
  const pending = total - up - down;

  return (
    <Flex align="center" gap={3} flexWrap="wrap">
      <Flex align="center" gap="6px">
        <Box w="8px" h="8px" borderRadius="full" bg="#10b981" boxShadow="0 0 5px rgba(16,185,129,0.5)" />
        <Text fontSize="12px" color="text.muted">{up} up</Text>
      </Flex>
      {down > 0 && (
        <Flex align="center" gap="6px">
          <Box w="8px" h="8px" borderRadius="full" bg="#ef4444" boxShadow="0 0 5px rgba(239,68,68,0.5)" />
          <Text fontSize="12px" color="#ef4444">{down} down</Text>
        </Flex>
      )}
      {pending > 0 && (
        <Flex align="center" gap="6px">
          <Box w="8px" h="8px" borderRadius="full" bg="rgba(255,255,255,0.2)" />
          <Text fontSize="12px" color="text.faint">{pending} checking</Text>
        </Flex>
      )}
      {lastChecked && (
        <Text fontSize="10px" color="text.faint">
          checked {lastChecked.toLocaleTimeString()}
        </Text>
      )}
      <Box as="button" onClick={poll} aria-label="Refresh status"
        display="flex" alignItems="center" gap="5px"
        px={2} py="3px" borderRadius="7px"
        border="1px solid" borderColor="border.subtle" color="text.muted"
        _hover={{ color: "accent.primary", borderColor: "border.brand", bg: "accent.glow" }}
        transition="all 0.15s" fontSize="11px">
        {loading ? <Spinner size="xs" /> : <RefreshCw size={11} strokeWidth={2} />}
        Refresh
      </Box>
    </Flex>
  );
}

// ── AI model roster (per-role map from GET /api/v1/health) ────────────────────
function useModelInfo() {
  const [state, setState] = useState({ loading: true, info: null });
  useEffect(() => {
    let alive = true;
    setState({ loading: true, info: null });
    fetch("/api/v1/health", { signal: AbortSignal.timeout(12000) })
      .then(r => r.json())
      .then(d => { if (alive) setState({ loading: false, info: d?.ollama ?? null }); })
      .catch(() => { if (alive) setState({ loading: false, info: null }); });
    return () => { alive = false; };
  }, []);
  return state;
}

function ModelsCard() {
  const { loading, info } = useModelInfo();
  const roles = info?.model_roles ?? [];

  return (
    <Box mb={5}>
      <Eyebrow mb={2}>AI Models — which model runs where</Eyebrow>
      <GlassCard p={2}>
        {/* header row */}
        <Flex align="center" gap={3} px={3} py="8px" display={{ base: "none", md: "flex" }}>
          <Text flex="0 0 150px" fontSize="10px" fontWeight={700} color="text.faint"
            textTransform="uppercase" letterSpacing="0.08em">Role</Text>
          <Text flex="0 0 200px" fontSize="10px" fontWeight={700} color="text.faint"
            textTransform="uppercase" letterSpacing="0.08em">Model</Text>
          <Text flex="0 0 120px" fontSize="10px" fontWeight={700} color="text.faint"
            textTransform="uppercase" letterSpacing="0.08em">Size / Params</Text>
          <Text flex="1" fontSize="10px" fontWeight={700} color="text.faint"
            textTransform="uppercase" letterSpacing="0.08em">Purpose</Text>
          <Text flex="0 0 110px" fontSize="10px" fontWeight={700} color="text.faint"
            textTransform="uppercase" letterSpacing="0.08em">Origin</Text>
        </Flex>

        {loading && (
          <Flex align="center" gap={2} px={3} py={3} color="text.muted">
            <Spinner size="xs" /><Text fontSize="sm">Loading model roster from backend…</Text>
          </Flex>
        )}
        
        {!loading && roles.length === 0 && (
          <Flex align="center" gap={2} px={3} py={3} color="#ef4444">
            <Text fontSize="sm">Failed to load model roster (backend timeout or Ollama unreachable).</Text>
          </Flex>
        )}

        {roles.map((r, i) => (
          <MotionBox key={r.role} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, delay: Math.min(i, 12) * 0.02 }}>
            <Flex align="center" gap={3} px={3} py="10px" borderRadius="10px"
              _hover={{ bg: "rgba(31,63,254,0.04)" }} transition="background 0.15s"
              flexWrap={{ base: "wrap", md: "nowrap" }}>
              <Flex flex={{ base: "1 0 100%", md: "0 0 150px" }} align="center" gap={2} minW={0}>
                <Box w="28px" h="28px" borderRadius="8px" flexShrink={0}
                  display="flex" alignItems="center" justifyContent="center"
                  bg="accent.glow" border="1px solid" borderColor="border.brand" color="accent.primary">
                  <Cpu size={14} strokeWidth={2} />
                </Box>
                <Text fontSize="sm" fontWeight={700} color="text.primary">{r.role}</Text>
              </Flex>
              <Text flex={{ base: "1 0 auto", md: "0 0 200px" }} fontSize="13px" fontFamily="mono"
                color="text.brand" fontWeight={600} title={r.model}>{r.model}</Text>
              <Text flex={{ base: "0 0 auto", md: "0 0 120px" }} fontSize="11px" color="text.muted" fontFamily="mono">
                {r.param_size ? `${r.param_size} · ${r.size}` : (r.size || "—")}
              </Text>
              <Text flex="1" fontSize="12px" color="text.muted" minW={0}>{r.purpose}</Text>
              <Badge flex={{ base: "0 0 auto", md: "0 0 110px" }} w="fit-content" fontSize="9px"
                bg="bg.chip" color="text.muted" border="1px solid" borderColor="border.subtle"
                borderRadius="6px" px={2} py="2px">{r.origin}</Badge>
            </Flex>
          </MotionBox>
        ))}

        {info && (
          <Box px={3} py="8px" borderTop="1px solid" borderColor="border.subtle" mt={1}>
            <Text fontSize="11px" color="text.faint" mb={2}>
              Host <Text as="span" fontFamily="mono" color="text.muted">{info.host}</Text>
              {"  ·  "}fallback <Text as="span" fontFamily="mono" color="text.muted">{info.default_model}</Text>
              {"  ·  "}all non-Chinese-origin (Microsoft · Mistral · Meta · Nomic)
            </Text>
            <Flex gap={6} flexWrap="wrap">
              {info.available_models && info.available_models.length > 0 && (
                <Box maxW="500px">
                  <Text fontSize="10px" fontWeight={700} color="text.faint" textTransform="uppercase" mb={1}>Available Models</Text>
                  <Text fontSize="11px" color="text.muted" fontFamily="mono" lineHeight={1.4}>
                    {info.available_models.join(", ")}
                  </Text>
                </Box>
              )}
              {info.circuit && (
                <Box>
                  <Text fontSize="10px" fontWeight={700} color="text.faint" textTransform="uppercase" mb={1}>Circuit Breaker</Text>
                  <Text fontSize="11px" color={info.circuit.open ? "#ef4444" : "#10b981"} fontFamily="mono">
                    {info.circuit.open ? `Open (${info.circuit.open_seconds_left}s left)` : "Closed"} 
                    {" "}— {info.circuit.recent_failures}/{info.circuit.threshold} fails (window: {info.circuit.window_seconds}s)
                  </Text>
                </Box>
              )}
              {info.digest_warnings && info.digest_warnings.length > 0 && (
                <Box w="100%" mt={1}>
                  <Text fontSize="10px" fontWeight={700} color="#f59e0b" textTransform="uppercase" mb={1}>Digest Warnings</Text>
                  {info.digest_warnings.map((w, i) => (
                    <Text key={i} fontSize="11px" color="#f59e0b" fontFamily="mono">• {w}</Text>
                  ))}
                </Box>
              )}
            </Flex>
          </Box>
        )}
      </GlassCard>
    </Box>
  );
}

export default function SystemPage() {
  const { status, poll, lastChecked } = useLiveStatus();
  const loading = Object.values(status).some(s => s === "pending");

  return (
    <PageShell>
      <PageHeader
        title="System"
        icon={<PageHeaderIcon icon={<Server size={20} strokeWidth={1.85} />} />}
        subtitle="Every running service, port, and endpoint — live status, one click to open or copy"
        actions={<SummaryBar status={status} poll={poll} lastChecked={lastChecked} loading={loading} />}
      />

      <ModelsCard />

      {SERVICES.map((group) => (
        <Box key={group.group} mb={5}>
          <Eyebrow mb={2}>{group.group}</Eyebrow>
          <GlassCard p={2}>
            {group.items.map((s, i) => (
              <ServiceRow key={s.label} idx={i} {...s} status={status} />
            ))}
          </GlassCard>
        </Box>
      ))}

      <GlassCard p={4}>
        <Eyebrow mb={2}>Tip</Eyebrow>
        <Text fontSize="sm" color="text.muted">
          MySQL / Postgres / Redis rows are connection strings — use Copy and paste into your DB client.
          Status dots poll every 30 s automatically; hit <strong>Refresh</strong> for an instant check.
          Obs stack ports are remapped: Grafana → 3030, Prometheus → 9292, Alertmanager → 9394
          (9090/9093/3000 ghost-held by Docker Desktop on this machine).
        </Text>
      </GlassCard>
    </PageShell>
  );
}
