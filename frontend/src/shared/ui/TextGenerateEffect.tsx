import { useEffect, useRef, type CSSProperties } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { cn } from "@/lib/utils";

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
 * Both respect prefers-reduced-motion. Props are explicit (className/style) —
 * the legacy Chakra style-prop spread is replaced by className.
 */

const wordVariant: Variants = {
  hidden: { opacity: 0, y: 6, filter: "blur(6px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)" },
};

/** text.* color token -> Tailwind text-* utility class. */
const COLOR_CLASS: Record<string, string> = {
  "text.primary": "text-ink",
  "text.secondary": "text-ink-secondary",
  "text.muted": "text-ink-muted",
  "text.faint": "text-ink-faint",
  "text.inverse": "text-ink-inverse",
  "text.brand": "text-ink-brand",
};

function colorClass(color: string): string {
  return COLOR_CLASS[color] ?? "text-ink";
}

export interface TextGenerateEffectProps {
  text?: string;
  stagger?: number;
  duration?: number;
  fontSize?: string;
  color?: string;
  className?: string;
  style?: CSSProperties;
}

export function TextGenerateEffect({
  text = "",
  stagger = 0.04,
  duration = 0.5,
  fontSize = "16px",
  color = "text.primary",
  className,
  style,
}: TextGenerateEffectProps) {
  const reduced = useReducedMotion();
  const words = (text || "").split(/(\s+)/);

  if (reduced) {
    return (
      <p className={cn(colorClass(color), className)} style={{ fontSize, ...style }}>
        {text}
      </p>
    );
  }

  return (
    <motion.div className={cn("leading-[1.5]", colorClass(color), className)} style={{ fontSize, ...style }}>
      {words.map((w, i) =>
        /^\s+$/.test(w) ? (
          <span key={i}>{w}</span>
        ) : (
          <motion.span
            key={i}
            initial="hidden"
            animate="show"
            variants={wordVariant}
            transition={{ duration, delay: i * stagger, ease: "easeOut" }}
            style={{ display: "inline-block" }}
          >
            {w}
          </motion.span>
        ),
      )}
    </motion.div>
  );
}

/**
 * StreamingText — for live SSE / token-by-token output.
 * Each *new* tail of the string animates in (we diff against the previous
 * render). Old content is static so the page doesn't re-animate forever.
 */
export interface StreamingTextProps {
  text?: string;
  fontSize?: string;
  color?: string;
  className?: string;
  style?: CSSProperties;
}

export function StreamingText({
  text = "",
  fontSize = "15px",
  color = "text.primary",
  className,
  style,
}: StreamingTextProps) {
  const reduced = useReducedMotion();
  const prevLenRef = useRef(0);
  const head = text.slice(0, prevLenRef.current);
  const tail = text.slice(prevLenRef.current);

  useEffect(() => {
    prevLenRef.current = text.length;
  }, [text]);

  if (reduced) {
    return (
      <p className={cn("whitespace-pre-wrap", colorClass(color), className)} style={{ fontSize, ...style }}>
        {text}
      </p>
    );
  }

  return (
    <motion.div
      className={cn("leading-[1.6] whitespace-pre-wrap", colorClass(color), className)}
      style={{ fontSize, ...style }}
    >
      <span>{head}</span>
      <motion.span
        initial={{ opacity: 0, filter: "blur(4px)" }}
        animate={{ opacity: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        {tail}
      </motion.span>
    </motion.div>
  );
}

export default TextGenerateEffect;
