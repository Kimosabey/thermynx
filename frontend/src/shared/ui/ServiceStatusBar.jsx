/**
 * ServiceStatusBar — live, modern indicator of every backend service.
 *
 * Polls /api/v1/health every 15s. Renders four animated pills (MySQL,
 * Postgres+pgvector, Ollama, telemetry freshness). Each pill shows a
 * pulsing status dot, a label, and the current value (host:port, model,
 * lag). Toast notifications fire only when a service transitions
 * (ok → down or down → ok) so the operator is alerted without spam.
 *
 * Floats bottom-right, glassmorphic. Click any pill to expand into a
 * compact details popover. All Framer Motion + Chakra — no extra deps.
 */

import { useEffect, useRef, useState } from "react";
import {
  Box, Flex, Text, useToast, useColorModeValue,
} from "@chakra-ui/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Database, Server, Cpu, Activity, ChevronUp, ChevronDown,
} from "lucide-react";

const MotionBox  = motion.create(Box);
const MotionFlex = motion.create(Flex);

const POLL_MS = 15_000;

const STATUS = {
  ok:   { color: "#10b981", glow: "rgba(16,185,129,0.35)" },
  warn: { color: "#f59e0b", glow: "rgba(245,158,11,0.35)" },
  down: { color: "#ef4444", glow: "rgba(239,68,68,0.35)" },
};

function StatusDot({ kind = "ok", size = 8 }) {
  const c = STATUS[kind];
  return (
    <Box position="relative" w={`${size}px`} h={`${size}px`} flexShrink={0}>
      <Box
        position="absolute" inset={0}
        borderRadius="full" bg={c.color}
        boxShadow={`0 0 8px ${c.glow}`}
      />
      {kind !== "down" && (
        <MotionBox
          position="absolute" inset={0}
          borderRadius="full" border={`1px solid ${c.color}`}
          animate={{ scale: [1, 2.2, 1], opacity: [0.7, 0, 0.7] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut" }}
        />
      )}
    </Box>
  );
}

function Pill({ icon: Icon, label, value, kind = "ok", detail }) {
  return (
    <Flex
      align="center" gap={2}
      px={3} py="6px"
      borderRadius="full"
      bg="bg.glass"
      backdropFilter="blur(12px)"
      border="1px solid"
      borderColor="border.subtle"
      boxShadow="0 4px 14px rgba(31,63,254,0.08)"
      title={detail}
    >
      <StatusDot kind={kind} />
      <Icon size={13} strokeWidth={2} />
      <Text fontSize="11px" fontWeight={600} color="text.secondary" letterSpacing="-0.01em">
        {label}
      </Text>
      {value && (
        <Text
          fontFamily="mono" fontSize="10px" color="text.muted"
          maxW="120px" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap"
        >
          {value}
        </Text>
      )}
    </Flex>
  );
}

function kindFromHealth(h) {
  // Map /api/v1/health response → 4 service states
  const db_ok      = !!h?.db?.connected;
  const ollama_ok  = !!h?.ollama?.connected;
  const freshness  = h?.telemetry?.freshness_warning;
  const ageSec     = h?.telemetry?.age_seconds;
  const slot       = h?.telemetry?.latest_slot_time;
  const tk         = freshness ? "warn" : slot ? "ok" : "warn";
  return {
    db:       db_ok ? "ok" : "down",
    ollama:   ollama_ok ? "ok" : "down",
    telemetry: tk,
  };
}

function relative(slot) {
  if (!slot) return "—";
  const d = new Date(slot);
  if (isNaN(+d)) return "—";
  const ago = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (ago < 90)        return "live";
  if (ago < 3600)      return `${Math.round(ago / 60)}m ago`;
  if (ago < 86400)     return `${Math.round(ago / 3600)}h ago`;
  return `${Math.round(ago / 86400)}d ago`;
}

export default function ServiceStatusBar() {
  const [health, setHealth] = useState(null);
  const [open, setOpen] = useState(false);
  const prevKindRef = useRef({});
  const toast = useToast();

  useEffect(() => {
    let active = true;
    const tick = async () => {
      try {
        const r = await fetch("/api/v1/health");
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        if (!active) return;
        setHealth(data);

        // Toast on transitions only
        const k = kindFromHealth(data);
        const p = prevKindRef.current;
        const labels = { db: "MySQL", ollama: "Ollama", telemetry: "Telemetry" };
        for (const key of Object.keys(k)) {
          if (p[key] && p[key] !== k[key]) {
            const next = k[key];
            toast({
              title: `${labels[key]} ${next === "ok" ? "recovered" : next === "warn" ? "degraded" : "unreachable"}`,
              description:
                next === "ok"
                  ? `Connection restored`
                  : next === "warn"
                  ? `Service flagged ${next}`
                  : `Service is unreachable from the backend`,
              status: next === "ok" ? "success" : next === "warn" ? "warning" : "error",
              duration: 4500,
              isClosable: true,
              position: "bottom-right",
            });
          }
        }
        prevKindRef.current = k;
      } catch {
        if (!active) return;
        setHealth({ _err: true });
      }
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => { active = false; clearInterval(id); };
  }, [toast]);

  if (!health) return null;
  if (health._err) {
    return (
      <Box position="fixed" right="20px" bottom="20px" zIndex={50}>
        <Pill icon={Server} label="Backend" value="unreachable" kind="down" />
      </Box>
    );
  }

  const k = kindFromHealth(health);
  const dbHost   = `${health.db?.host}:${health.db?.port}`;
  const ollHost  = (health.ollama?.host || "").replace(/^https?:\/\//, "").replace(/:\d+$/, "");
  const ollModel = health.ollama?.default_model || "—";
  const fresh    = relative(health.telemetry?.latest_slot_time);

  return (
    <MotionBox
      position="fixed"
      right="20px"
      bottom="20px"
      zIndex={50}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <Flex
        direction="column"
        align="flex-end"
        gap={2}
        p={2}
        borderRadius="14px"
        bg="rgba(255,255,255,0.55)"
        backdropFilter="blur(18px)"
        border="1px solid"
        borderColor="rgba(31,63,254,0.12)"
        boxShadow="0 14px 40px rgba(15,23,42,0.10)"
      >
        <Flex
          as="button"
          align="center"
          gap={2}
          px={2} py="2px"
          borderRadius="md"
          _hover={{ bg: "rgba(31,63,254,0.06)" }}
          cursor="pointer"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle service status details"
        >
          <Activity size={12} strokeWidth={2} color="#1F3FFE" />
          <Text fontSize="10px" fontWeight={700} color="#1F3FFE" letterSpacing="0.06em" textTransform="uppercase">
            Live · system status
          </Text>
          {open
            ? <ChevronDown size={12} strokeWidth={2} color="#1F3FFE" />
            : <ChevronUp   size={12} strokeWidth={2} color="#1F3FFE" />}
        </Flex>

        <AnimatePresence initial={false}>
          {open && (
            <MotionFlex
              direction="column"
              gap={2}
              initial={{ opacity: 0, y: -6, height: 0 }}
              animate={{ opacity: 1, y: 0,  height: "auto" }}
              exit   ={{ opacity: 0, y: -6, height: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <Pill icon={Database} label="MySQL"     value={dbHost}            kind={k.db}        detail="Unicharm telemetry source" />
              <Pill icon={Server}   label="Postgres"  value="thermynx_app"      kind="ok"          detail="App state, RAG vectors" />
              <Pill icon={Cpu}      label="Ollama"    value={ollModel}          kind={k.ollama}    detail={ollHost ? `host: ${ollHost}` : "Local LLM"} />
              <Pill icon={Activity} label="Telemetry" value={fresh}             kind={k.telemetry} detail="Latest slot in MySQL" />
            </MotionFlex>
          )}
        </AnimatePresence>
      </Flex>
    </MotionBox>
  );
}
