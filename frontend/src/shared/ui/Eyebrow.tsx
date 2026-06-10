import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Eyebrow / overline label — 10px, weight 700, UPPERCASE, 0.10em tracking.
 * Used ~50× across the product as section labels and field captions.
 *
 * Usage: <Eyebrow className="mb-3">Equipment Overview</Eyebrow>
 */
export default function Eyebrow({ children, className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        "text-[10px] leading-[1.25] font-bold tracking-[0.10em] text-ink-muted uppercase",
        className,
      )}
      {...props}
    >
      {children}
    </p>
  );
}
