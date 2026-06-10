import type { ComponentType } from "react";
import { AlertCircle, X, WifiOff, Server, RotateCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

/** Chakra default `red.400` — kept literal so the port renders pixel-identically. */
const RED_400 = "#FC8181";

type IconType = ComponentType<{ size?: number | string; strokeWidth?: number }>;

function errorIcon(message?: string | null): IconType {
  if (!message) return AlertCircle;
  const m = message.toLowerCase();
  if (m.includes("network") || m.includes("fetch") || m.includes("reach")) return WifiOff;
  if (m.includes("502") || m.includes("503") || m.includes("unavailable")) return Server;
  return AlertCircle;
}

export interface ErrorAlertProps {
  /** Error message; banner shows only when this is a non-empty string. */
  error?: string | null;
  /** Optional callback when the user clicks the dismiss (X) control. */
  onDismiss?: () => void;
  /** Optional callback when the user clicks Retry. */
  onRetry?: () => void;
  /** Bottom margin (Tailwind spacing unit). Default 5 → mb-5. */
  mb?: number;
}

/**
 * Inline error banner — shows when `error` is a non-empty string.
 *
 * Props:
 *   error      — string | null
 *   onDismiss  — optional callback when user clicks X
 *   onRetry    — optional callback when user clicks Retry
 *   mb         — bottom margin (default 5)
 */
export default function ErrorAlert({ error, onDismiss, onRetry, mb = 5 }: ErrorAlertProps) {
  const Icon = errorIcon(error);

  return (
    <AnimatePresence>
      {error && (
        <motion.div
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
          initial={{ opacity: 0, y: -6, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -4, height: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
          style={{ marginBottom: `${mb * 4}px` }}
        >
          <div
            className="flex items-start gap-3 rounded-lg px-4 py-3"
            style={{
              background: "rgba(220,38,38,0.08)",
              border: "1px solid rgba(220,38,38,0.25)",
            }}
          >
            <div className="mt-px shrink-0" style={{ color: RED_400 }} aria-hidden="true">
              <Icon size={15} strokeWidth={2} />
            </div>
            <p className="flex-1 text-sm leading-[1.6]" style={{ color: RED_400 }}>
              {error}
            </p>
            {onRetry && (
              <Button
                size="xs"
                variant="ghost"
                onClick={onRetry}
                aria-label="Retry"
                className="min-w-0 px-2 hover:bg-[rgba(220,38,38,0.12)] hover:text-[#FC8181]"
                style={{ color: RED_400 }}
              >
                <RotateCw size={12} strokeWidth={2.2} />
                Retry
              </Button>
            )}
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className="mt-px shrink-0 rounded-md p-1 opacity-60 transition-opacity hover:opacity-100"
                style={{ color: RED_400 }}
                aria-label="Dismiss error"
              >
                <X size={14} strokeWidth={2} aria-hidden="true" />
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
