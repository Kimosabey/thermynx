import { describe, it, expect, vi } from "vitest";
import { makeModelToaster } from "./modelStreamToast";

describe("makeModelToaster", () => {
  it("maps each known SSE frame to its model task and passes the prefix", () => {
    const notify = vi.fn();
    const mt = makeModelToaster(notify, "Agent");

    mt.frame("plan"); // planner
    mt.frame("tool_call"); // tool
    mt.frame("token"); // text
    mt.frame("audit"); // auditor

    expect(notify.mock.calls).toEqual([
      ["planner", { prefix: "Agent" }],
      ["tool", { prefix: "Agent" }],
      ["text", { prefix: "Agent" }],
      ["auditor", { prefix: "Agent" }],
    ]);
  });

  it("toasts each model only once per run (dedup), even across aliased frames", () => {
    const notify = vi.fn();
    const mt = makeModelToaster(notify);

    mt.frame("token"); // text — fires
    mt.frame("token"); // text — deduped
    mt.frame("synthesis_token"); // also -> text — deduped
    mt.frame("tool_call"); // tool — fires
    mt.frame("delegate_start"); // also -> tool — deduped

    expect(notify).toHaveBeenCalledTimes(2);
    expect(notify).toHaveBeenNthCalledWith(1, "text", { prefix: undefined });
    expect(notify).toHaveBeenNthCalledWith(2, "tool", { prefix: undefined });
  });

  it("ignores frame types with no model mapping", () => {
    const notify = vi.fn();
    const mt = makeModelToaster(notify);

    mt.frame("tool_result");
    mt.frame("delegate_done");
    mt.frame("done");
    mt.frame("citations");

    expect(notify).not.toHaveBeenCalled();
  });

  it("reset() re-arms the toaster so the next run re-announces its models", () => {
    const notify = vi.fn();
    const mt = makeModelToaster(notify);

    mt.frame("token");
    expect(notify).toHaveBeenCalledTimes(1);

    mt.reset();
    mt.frame("token");
    expect(notify).toHaveBeenCalledTimes(2);
  });
});
