/**
 * FeedbackBar — 👍/👎 rating strip below every analyzer answer.
 *
 * Appears after streaming completes and an auditId is available.
 * POSTs to /api/v1/audit/{auditId}/verdict and self-dismisses.
 * Feeds graylinx_operator_feedback_total Prometheus counter on the backend.
 */
import { useState } from "react";
import { Flex, Text, IconButton, Tooltip, useToast } from "@chakra-ui/react";
import { ThumbsUp, ThumbsDown } from "lucide-react";

export function FeedbackBar({ auditId }) {
  const [state, setState] = useState("idle"); // idle | submitting | done
  const toast = useToast();

  if (!auditId || state === "done") return null;

  async function submit(verdict) {
    setState("submitting");
    try {
      const r = await fetch(`/api/v1/audit/${auditId}/verdict`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ verdict }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setState("done");
      toast({
        title: verdict === "positive" ? "Thanks for the feedback!" : "Noted — we'll use this to improve.",
        status: verdict === "positive" ? "success" : "info",
        duration: 2500,
        position: "bottom-right",
        isClosable: true,
      });
    } catch (e) {
      setState("idle");
      toast({ title: `Couldn't save feedback: ${e.message}`, status: "error",
              duration: 3000, position: "bottom-right" });
    }
  }

  return (
    <Flex align="center" gap={2} mt={3} pt={3}
      borderTop="1px solid" borderColor="border.subtle">
      <Text fontSize="11px" color="text.muted">Was this answer helpful?</Text>
      <Tooltip label="Yes, helpful" placement="top" fontSize="xs">
        <IconButton
          aria-label="Thumbs up"
          icon={<ThumbsUp size={13} />}
          size="xs"
          variant="ghost"
          colorScheme="green"
          isLoading={state === "submitting"}
          onClick={() => submit("positive")}
          _hover={{ bg: "rgba(16,185,129,0.10)" }}
        />
      </Tooltip>
      <Tooltip label="Not helpful" placement="top" fontSize="xs">
        <IconButton
          aria-label="Thumbs down"
          icon={<ThumbsDown size={13} />}
          size="xs"
          variant="ghost"
          colorScheme="red"
          isLoading={state === "submitting"}
          onClick={() => submit("negative")}
          _hover={{ bg: "rgba(239,68,68,0.10)" }}
        />
      </Tooltip>
    </Flex>
  );
}
