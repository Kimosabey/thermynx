/**
 * System — operator-facing service directory.
 * One pane to find every running port, dashboard, and API endpoint.
 */
import { useEffect, useState } from "react";
import { Box, Flex, Text, Grid, Badge, useToast } from "@chakra-ui/react";
import {
  Server, Database, HardDrive, BookOpen, Cpu, ExternalLink, Copy,
  ScrollText, Activity, Settings as SettingsIcon, ShieldCheck,
} from "lucide-react";
import { motion } from "framer-motion";
import PageShell from "../../shared/ui/PageShell";
import PageHeader from "../../shared/ui/PageHeader";
import PageHeaderIcon from "../../shared/ui/PageHeaderIcon";
import GlassCard from "../../shared/ui/GlassCard";
import Eyebrow from "../../shared/ui/Eyebrow";

const MotionBox = motion.create(Box);

const SERVICES = [
  {
    group: "Frontend",
    items: [
      { Icon: Server,     label: "Frontend dev",      url: "http://localhost:5174",                          port: 5174, role: "Vite dev server (this app)" },
      { Icon: Server,     label: "Frontend (prod)",   url: "http://localhost:4173",                          port: 4173, role: "Vite preview build" },
    ],
  },
  {
    group: "Backend API",
    items: [
      { Icon: Server,     label: "API base",          url: "http://localhost:8000",                          port: 8000, role: "FastAPI app root" },
      { Icon: BookOpen,   label: "API docs (Swagger)",url: "http://localhost:8000/docs",                     port: 8000, role: "Interactive OpenAPI explorer" },
      { Icon: BookOpen,   label: "API docs (ReDoc)",  url: "http://localhost:8000/redoc",                    port: 8000, role: "Read-only OpenAPI view" },
      { Icon: ScrollText, label: "OpenAPI spec (json)", url: "http://localhost:8000/openapi.json",           port: 8000, role: "Machine-readable schema" },
      { Icon: Activity,   label: "Health",            url: "http://localhost:8000/api/v1/health",            port: 8000, role: "Backend liveness + dependency state" },
      { Icon: SettingsIcon, label: "Capabilities",    url: "http://localhost:8000/api/v1/capabilities",      port: 8000, role: "Self-describing feature catalogue" },
      { Icon: Activity,   label: "Metrics",           url: "http://localhost:8000/metrics",                  port: 8000, role: "Prometheus metrics scrape" },
      { Icon: ShieldCheck,label: "Slack health",      url: "http://localhost:8000/api/v1/slack/health",      port: 8000, role: "Slack integration status" },
    ],
  },
  {
    group: "Datastores",
    items: [
      { Icon: Database,   label: "Unicharm MySQL",    url: "mysql://localhost:3307",                         port: 3307, role: "Telemetry source (read-only)" },
      { Icon: Database,   label: "Postgres (pgvector)", url: "postgres://localhost:5442",                    port: 5442, role: "App state + RAG embeddings" },
      { Icon: HardDrive,  label: "Redis",             url: "redis://localhost:6380",                         port: 6380, role: "Cache + arq queue" },
      { Icon: HardDrive,  label: "Redis Commander",   url: "http://localhost:8181",                          port: 8181, role: "Browser UI for Redis" },
    ],
  },
  {
    group: "AI runtime",
    items: [
      { Icon: Cpu,        label: "Ollama API",        url: "http://100.125.103.28:11434",                    port: 11434, role: "On-prem LLM server (qwen / llama / nomic / vision)" },
      { Icon: Cpu,        label: "Ollama tags",       url: "http://100.125.103.28:11434/api/tags",           port: 11434, role: "List installed models" },
    ],
  },
];

function copyText(t, toast) {
  navigator.clipboard.writeText(t).then(
    () => toast({ title: "Copied", description: t, status: "success", duration: 1400, position: "bottom-right", isClosable: true }),
    () => toast({ title: "Copy failed", status: "error", duration: 1400 }),
  );
}

function ServiceRow({ Icon, label, url, port, role, idx }) {
  const toast = useToast();
  const isHttp = url.startsWith("http");
  return (
    <MotionBox initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, delay: Math.min(idx, 12) * 0.015 }}>
      <Flex
        align="center" gap={3}
        px={3} py="10px"
        borderRadius="10px"
        _hover={{ bg: "rgba(31,63,254,0.04)" }}
        transition="background 0.15s"
      >
        <Box
          w="32px" h="32px" borderRadius="9px" flexShrink={0}
          display="flex" alignItems="center" justifyContent="center"
          bg="accent.glow" border="1px solid" borderColor="border.brand" color="accent.primary"
        >
          <Icon size={15} strokeWidth={2} />
        </Box>
        <Box flex="1" minW={0}>
          <Flex align="center" gap={2}>
            <Text fontSize="sm" fontWeight={700} color="text.primary">{label}</Text>
            <Badge fontSize="9px" bg="bg.chip" color="text.muted" border="1px solid" borderColor="border.subtle" borderRadius="6px" px={2} py="2px" sx={{ fontVariantNumeric: "tabular-nums" }}>
              :{port}
            </Badge>
          </Flex>
          <Text fontSize="11px" color="text.muted" mt="2px">{role}</Text>
        </Box>
        <Flex gap={2} align="center">
          <Text fontSize="10px" fontFamily="mono" color="text.faint" maxW="240px" noOfLines={1} title={url}>
            {url}
          </Text>
          <Box
            as="button"
            aria-label={`Copy ${url}`}
            onClick={() => copyText(url, toast)}
            w="28px" h="28px" borderRadius="8px"
            display="flex" alignItems="center" justifyContent="center"
            border="1px solid" borderColor="border.subtle"
            color="text.muted"
            _hover={{ color: "accent.primary", borderColor: "border.brand", bg: "accent.glow" }}
            transition="all 0.15s"
          >
            <Copy size={12} strokeWidth={2} />
          </Box>
          {isHttp && (
            <Box
              as="a"
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${url}`}
              w="28px" h="28px" borderRadius="8px"
              display="flex" alignItems="center" justifyContent="center"
              border="1px solid" borderColor="border.subtle"
              color="text.muted"
              _hover={{ color: "accent.primary", borderColor: "border.brand", bg: "accent.glow" }}
              transition="all 0.15s"
            >
              <ExternalLink size={12} strokeWidth={2} />
            </Box>
          )}
        </Flex>
      </Flex>
    </MotionBox>
  );
}

export default function SystemPage() {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    fetch("/api/v1/health")
      .then(r => r.ok ? r.json() : null)
      .then(setHealth)
      .catch(() => {});
  }, []);

  const liveBadge = health
    ? <Badge fontSize="9px" bg="rgba(16,185,129,0.12)" color="#10b981" border="1px solid rgba(16,185,129,0.32)" borderRadius="6px" px={2} py="2px">Backend reachable</Badge>
    : <Badge fontSize="9px" bg="rgba(239,68,68,0.12)" color="#ef4444" border="1px solid rgba(239,68,68,0.32)" borderRadius="6px" px={2} py="2px">Backend offline</Badge>;

  return (
    <PageShell>
      <PageHeader
        title="System"
        icon={<PageHeaderIcon icon={<Server size={20} strokeWidth={1.85} />} />}
        subtitle="Every running service, port, and endpoint — one click to open or copy"
        actions={liveBadge}
      />

      {SERVICES.map((group, gi) => (
        <Box key={group.group} mb={5}>
          <Eyebrow mb={2}>{group.group}</Eyebrow>
          <GlassCard p={2}>
            <Box>
              {group.items.map((s, i) => (
                <ServiceRow key={s.label} idx={i} {...s} />
              ))}
            </Box>
          </GlassCard>
        </Box>
      ))}

      <GlassCard p={4}>
        <Eyebrow mb={2}>Tip</Eyebrow>
        <Text fontSize="sm" color="text.muted">
          The Postgres / MySQL / Redis rows are connection strings, not browser URLs — use the copy
          button and paste them into your DB client. Everything else opens in a new tab.
        </Text>
      </GlassCard>
    </PageShell>
  );
}
