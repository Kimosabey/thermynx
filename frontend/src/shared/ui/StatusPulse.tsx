import { useEffect, useState, type CSSProperties } from "react";

/**
 * Animated pulsing status dot (green = live, gray = offline). Pauses the CSS
 * animation when the tab is hidden (saves GPU) and respects reduced-motion.
 */
export default function StatusPulse({
  active = true,
  size = "8px",
  label,
}: {
  active?: boolean;
  size?: string;
  label?: string;
}) {
  const color = active ? "#059669" : "#CBD5E1";
  const a11yLabel = label ?? (active ? "Data feed live" : "Data feed offline");

  // Pause CSS animation when tab is hidden (saves GPU)
  const [docHidden, setDocHidden] = useState(false);
  useEffect(() => {
    const onVis = () => setDocHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const dim: CSSProperties = { width: size, height: size };

  return (
    <span role="status" className="relative inline-flex shrink-0" style={dim}>
      {active && (
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full opacity-40 animate-status-pulse motion-reduce:animate-none"
          style={{ background: color, animationPlayState: docHidden ? "paused" : "running" }}
        />
      )}
      <span aria-hidden="true" className="relative rounded-full" style={{ ...dim, background: color }} />
      <span className="sr-only">{a11yLabel}</span>
    </span>
  );
}
