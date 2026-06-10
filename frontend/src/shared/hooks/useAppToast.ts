import { toast } from "sonner";

/**
 * Standardized toast wrapper — Sonner-backed, but preserves the exact interface
 * of the legacy Chakra `useAppToast()` so ~15 call sites port unchanged.
 *
 * Usage:
 *   const toast = useAppToast();
 *   toast.success("Thread saved", "Conversation memory enabled");
 *   toast.error("Could not connect", "Backend may be offline");
 *   toast.info("Agent complete", `Investigated in ${seconds}s`);
 */
// Stable module-level instance. sonner's `toast` is a singleton, so this wrapper
// never needs a new identity. Returning a fresh object each render made `toast`
// unstable in effect/callback deps — e.g. ServiceStatusBar's health poller has
// `[toast]` deps, so it re-ran every render, firing a fetch + spawning a new
// interval on each render = the /api/v1/health request storm. A stable ref fixes it.
const appToast = {
  success: (title: string, description?: string) =>
    toast.success(title, { description, duration: 3000 }),
  error: (title: string, description?: string) =>
    toast.error(title, { description, duration: 5000 }),
  info: (title: string, description?: string) =>
    toast.info(title, { description, duration: 3000 }),
  warning: (title: string, description?: string) =>
    toast.warning(title, { description, duration: 4000 }),
};

export default function useAppToast() {
  return appToast;
}
