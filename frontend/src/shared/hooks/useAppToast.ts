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
export default function useAppToast() {
  return {
    success: (title: string, description?: string) =>
      toast.success(title, { description, duration: 3000 }),
    error: (title: string, description?: string) =>
      toast.error(title, { description, duration: 5000 }),
    info: (title: string, description?: string) =>
      toast.info(title, { description, duration: 3000 }),
    warning: (title: string, description?: string) =>
      toast.warning(title, { description, duration: 4000 }),
  };
}
