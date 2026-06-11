/**
 * Frame → model-task mapping for live "which model is running" toasts.
 *
 * Every streaming AI flow (analyze, agent ReAct, orchestrate, Nyx) emits the
 * same SSE frame vocabulary. Rather than each page hardcoding which models it
 * thinks it uses (which goes stale the moment routing/config changes), this maps
 * the frame that just arrived → the task whose model produced it, so the toaster
 * surfaces EVERY model the moment it's actually engaged:
 *   • a tool runs            → tool model
 *   • a plan is built        → planner model
 *   • the answer streams     → text model (narration / synthesis)
 *   • fact-check runs        → auditor model
 * Deduped per run so each model toasts once, in the order it's engaged.
 */
const FRAME_TASK: Record<string, string> = {
  token: "text",
  synthesis_token: "text",
  tool_call: "tool",
  delegate_start: "tool",
  plan: "planner",
  audit: "auditor",
};

type Notify = (task: string, opts?: { prefix?: string }) => void;

export function makeModelToaster(notify: Notify, prefix?: string) {
  const seen = new Set<string>();
  return {
    /** Feed each SSE frame's `type`; fires a toast the first time a model is engaged. */
    frame(type: string) {
      const task = FRAME_TASK[type];
      if (!task || seen.has(task)) return;
      seen.add(task);
      notify(task, { prefix });
    },
    /** Reset between runs so the next run re-announces its models. */
    reset() {
      seen.clear();
    },
  };
}
