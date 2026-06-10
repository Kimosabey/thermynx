/**
 * AIHealthBanner — sticky banner shown above AI surfaces when Ollama is
 * unreachable or its circuit breaker is open. Polls /api/v1/health every
 * 15s. Renders nothing when healthy.
 *
 * Use on /ai, /nl-query, /vision, /reports — anywhere a slow LLM call
 * would block the operator.
 */
import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const POLL_MS = 15_000;

interface OllamaHealth {
  connected?: boolean;
  circuit?: CircuitState | null;
}

interface CircuitState {
  open?: boolean;
  open_seconds_left?: number;
}

interface HealthState {
  loading: boolean;
  ollama: OllamaHealth | null;
  circuit: CircuitState | null;
}

export function AIHealthBanner() {
  const [state, setState] = useState<HealthState>({ loading: true, ollama: null, circuit: null });
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
          loading: false,
          ollama: d.ollama || null,
          circuit: d.ollama?.circuit || null,
        });
      } catch {
        if (alive) setState({ loading: false, ollama: { connected: false }, circuit: null });
      }
    }
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (state.loading || dismissed) return null;

  const ollamaDown = state.ollama && state.ollama.connected === false;
  const circuitOpen = state.circuit?.open === true;
  if (!ollamaDown && !circuitOpen) return null;

  const title = ollamaDown
    ? "AI features unavailable — Ollama not reachable"
    : `AI temporarily throttled — circuit breaker open (retry in ${state.circuit?.open_seconds_left ?? "?"}s)`;

  const desc = ollamaDown
    ? "The LLM server isn't responding. Analytics, anomaly detection, and reports still work — but the AI Analyzer, Agent, NL-Query, and Vision will return errors until it recovers."
    : "Repeated Ollama failures tripped the circuit breaker. New AI requests will be refused immediately until the cooldown passes. Analytics pages are unaffected.";

  // Chakra status="error"/"warning" + variant="left-accent" reproduced with
  // semantic status tokens (bad / warn) and a thick left accent border.
  const accent = ollamaDown
    ? "border-l-4 border-l-bad text-bad bg-[color-mix(in_srgb,var(--bad)_8%,transparent)]"
    : "border-l-4 border-l-warn text-warn bg-[color-mix(in_srgb,var(--warn)_8%,transparent)]";

  return (
    <div className="mb-4">
      <Alert
        className={cn(
          "rounded-[10px] border-border-subtle px-4 py-3",
          accent,
        )}
      >
        <AlertTriangle />
        <AlertTitle className="text-sm font-bold">{title}</AlertTitle>
        <AlertDescription className="mt-1 block text-xs text-ink-muted">
          {desc}
        </AlertDescription>
        <div className="col-start-2 mt-2 flex items-center gap-2">
          <Button size="xs" variant="ghost" onClick={() => setDismissed(true)}>
            Dismiss
          </Button>
        </div>
      </Alert>
    </div>
  );
}

export default AIHealthBanner;
