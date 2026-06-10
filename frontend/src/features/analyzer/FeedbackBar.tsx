/**
 * FeedbackBar — 👍/👎 rating strip below every analyzer answer.
 *
 * Appears after streaming completes and an auditId is available.
 * POSTs to /api/v1/audit/{auditId}/verdict and self-dismisses.
 * Feeds graylinx_operator_feedback_total Prometheus counter on the backend.
 */
import { useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { apiFetch } from "@/shared/api/client";
import useAppToast from "@/shared/hooks/useAppToast";

type FeedbackState = "idle" | "submitting" | "done";
type Verdict = "positive" | "negative";

export function FeedbackBar({ auditId }: { auditId?: string | number | null }) {
  const [state, setState] = useState<FeedbackState>("idle"); // idle | submitting | done
  const toast = useAppToast();

  if (!auditId || state === "done") return null;

  async function submit(verdict: Verdict) {
    setState("submitting");
    try {
      const r = await apiFetch(`/api/v1/audit/${auditId}/verdict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verdict }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setState("done");
      if (verdict === "positive") {
        toast.success("Thanks for the feedback!");
      } else {
        toast.info("Noted — we'll use this to improve.");
      }
    } catch (e) {
      setState("idle");
      toast.error(`Couldn't save feedback: ${(e as Error).message}`);
    }
  }

  return (
    <div className="mt-3 flex items-center gap-2 border-t border-border-subtle pt-3">
      <p className="text-[11px] text-ink-muted">Was this answer helpful?</p>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-label="Thumbs up"
            size="icon-xs"
            variant="ghost"
            disabled={state === "submitting"}
            onClick={() => submit("positive")}
            className="text-[#10b981] hover:bg-[rgba(16,185,129,0.10)] hover:text-[#10b981]"
          >
            <ThumbsUp size={13} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          Yes, helpful
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-label="Thumbs down"
            size="icon-xs"
            variant="ghost"
            disabled={state === "submitting"}
            onClick={() => submit("negative")}
            className="text-[#ef4444] hover:bg-[rgba(239,68,68,0.10)] hover:text-[#ef4444]"
          >
            <ThumbsDown size={13} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          Not helpful
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
