import { type CSSProperties } from "react";
import StatusPulse from "@/shared/ui/StatusPulse";
import { modeMeta } from "./nyxModes";

export interface NyxStatusLineProps {
  engine?: string;
  routing?: boolean;
}

// Shimmer gradient applied to the live status label. Reproduces the legacy
// Chakra `sx` gradient: text.primary → accent.cyan → text.primary, animated via
// the `shimmer-text` keyframe (index.css). CSS vars `--ink` / `--cyan` are the
// new-app equivalents of `--chakra-colors-text-primary` / `--chakra-colors-accent-cyan`.
const SHIMMER_STYLE: CSSProperties = {
  backgroundImage:
    "linear-gradient(90deg, var(--ink) 0%, var(--ink) 35%, var(--cyan) 50%, var(--ink) 65%, var(--ink) 100%)",
  backgroundSize: "200% 100%",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  WebkitTextFillColor: "transparent",
  color: "transparent",
  animation: "shimmer-text 2.1s linear infinite",
};

/** "Nyx is investigating…" — live status while a turn streams. */
export default function NyxStatusLine({ engine, routing }: NyxStatusLineProps) {
  const gerund = routing ? "thinking" : modeMeta(engine).gerund;
  return (
    <div className="flex items-center gap-2 py-1" role="status" aria-live="polite" aria-atomic="true">
      <StatusPulse active size="8px" label="Nyx working" />
      <span className="text-[12px] font-semibold" style={SHIMMER_STYLE}>
        Nyx is {gerund}…
      </span>
    </div>
  );
}
