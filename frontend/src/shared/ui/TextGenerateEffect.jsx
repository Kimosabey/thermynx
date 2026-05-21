/**
 * TextGenerateEffect — Aceternity-style staggered word reveal.
 *
 * Splits text into words and fades each one in with a subtle blur-to-clear
 * + upward float. Great for static LLM responses, hero subtitles, and
 * "AI is thinking" placeholders. For *streaming* LLM tokens use the
 * <StreamingText /> variant which animates on each new chunk.
 *
 *   <TextGenerateEffect text="Plant operations briefing for shift handover" />
 *   <StreamingText text={liveText} />
 *
 * Both respect prefers-reduced-motion.
 */

import { useEffect, useRef } from "react";
import { Box, Text } from "@chakra-ui/react";
import { motion, useReducedMotion } from "framer-motion";

const MotionSpan = motion.span;

const wordVariant = {
  hidden: { opacity: 0, y: 6, filter: "blur(6px)" },
  show:   { opacity: 1, y: 0, filter: "blur(0px)" },
};

export function TextGenerateEffect({
  text = "",
  stagger = 0.04,
  duration = 0.5,
  fontSize = "16px",
  color = "text.primary",
  ...rest
}) {
  const reduced = useReducedMotion();
  const words = (text || "").split(/(\s+)/);

  if (reduced) {
    return (
      <Text fontSize={fontSize} color={color} {...rest}>
        {text}
      </Text>
    );
  }

  return (
    <Box fontSize={fontSize} color={color} lineHeight="1.5" {...rest}>
      {words.map((w, i) =>
        /^\s+$/.test(w) ? (
          <span key={i}>{w}</span>
        ) : (
          <MotionSpan
            key={i}
            initial="hidden"
            animate="show"
            variants={wordVariant}
            transition={{ duration, delay: i * stagger, ease: "easeOut" }}
            style={{ display: "inline-block" }}
          >
            {w}
          </MotionSpan>
        ),
      )}
    </Box>
  );
}

/**
 * StreamingText — for live SSE / token-by-token output.
 * Each *new* tail of the string animates in (we diff against the previous
 * render). Old content is static so the page doesn't re-animate forever.
 */
export function StreamingText({ text = "", fontSize = "15px", color = "text.primary", ...rest }) {
  const reduced = useReducedMotion();
  const prevLenRef = useRef(0);
  const head = text.slice(0, prevLenRef.current);
  const tail = text.slice(prevLenRef.current);

  useEffect(() => {
    prevLenRef.current = text.length;
  }, [text]);

  if (reduced) {
    return (
      <Text fontSize={fontSize} color={color} whiteSpace="pre-wrap" {...rest}>
        {text}
      </Text>
    );
  }

  return (
    <Box fontSize={fontSize} color={color} lineHeight="1.6" whiteSpace="pre-wrap" {...rest}>
      <span>{head}</span>
      <MotionSpan
        initial={{ opacity: 0, filter: "blur(4px)" }}
        animate={{ opacity: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        {tail}
      </MotionSpan>
    </Box>
  );
}

export default TextGenerateEffect;
