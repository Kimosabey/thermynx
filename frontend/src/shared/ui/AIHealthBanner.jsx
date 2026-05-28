/**
 * AIHealthBanner — sticky banner shown above AI surfaces when Ollama is
 * unreachable or its circuit breaker is open. Polls /api/v1/health every
 * 15s. Renders nothing when healthy.
 *
 * Use on /ai, /nl-query, /vision, /reports — anywhere a slow LLM call
 * would block the operator.
 */
import { useEffect, useState } from "react";
import {
  Alert, AlertIcon, AlertTitle, AlertDescription, Box, Button, HStack,
} from "@chakra-ui/react";
import { AlertTriangle } from "lucide-react";

const POLL_MS = 15_000;

export function AIHealthBanner() {
  const [state, setState] = useState({ loading: true, ollama: null, circuit: null });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const r = await fetch("/api/v1/health");
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = await r.json();
        if (!alive) return;
        setState({
          loading:  false,
          ollama:   d.ollama || null,
          circuit:  d.ollama?.circuit || null,
        });
      } catch {
        if (alive) setState({ loading: false, ollama: { connected: false }, circuit: null });
      }
    }
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, []);

  if (state.loading || dismissed) return null;

  const ollamaDown   = state.ollama && state.ollama.connected === false;
  const circuitOpen  = state.circuit?.open === true;
  if (!ollamaDown && !circuitOpen) return null;

  const title = ollamaDown
    ? "AI features unavailable — Ollama not reachable"
    : `AI temporarily throttled — circuit breaker open (retry in ${state.circuit?.open_seconds_left ?? "?"}s)`;

  const desc = ollamaDown
    ? "The LLM server isn't responding. Analytics, anomaly detection, and reports still work — but the AI Analyzer, Agent, NL-Query, and Vision will return errors until it recovers."
    : "Repeated Ollama failures tripped the circuit breaker. New AI requests will be refused immediately until the cooldown passes. Analytics pages are unaffected.";

  return (
    <Box mb={4}>
      <Alert
        status={ollamaDown ? "error" : "warning"}
        variant="left-accent"
        borderRadius="10px"
        py={3}
        px={4}
      >
        <AlertIcon as={AlertTriangle} />
        <Box flex="1" minW={0}>
          <AlertTitle fontSize="sm" fontWeight={700}>{title}</AlertTitle>
          <AlertDescription fontSize="xs" color="text.muted" mt={1} display="block">
            {desc}
          </AlertDescription>
        </Box>
        <HStack spacing={2} ml={3}>
          <Button
            size="xs"
            variant="ghost"
            onClick={() => setDismissed(true)}
          >
            Dismiss
          </Button>
        </HStack>
      </Alert>
    </Box>
  );
}
