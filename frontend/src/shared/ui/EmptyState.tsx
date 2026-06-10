import { type ReactNode } from "react";
import { Inbox } from "lucide-react";
import type { HTMLMotionProps } from "framer-motion";
import GlassCard from "./GlassCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Standardized empty-state for pages with no data.
 *
 * Props:
 *   icon         — optional Lucide icon node (default: <Inbox />)
 *   title        — short headline ("No anomalies detected")
 *   description  — one-sentence explanation
 *   action       — optional { label, onClick } to render a primary button
 *   minH         — min height of card (default 240px)
 *
 * Example:
 *   <EmptyState
 *     title="No anomalies detected"
 *     description="The last scan found no statistical outliers above the Z-score threshold."
 *     action={{ label: "Run scan now", onClick: runScan }}
 *   />
 */
export interface EmptyStateAction {
  label: string;
  onClick?: () => void;
}

export interface EmptyStateProps extends Omit<HTMLMotionProps<"div">, "title"> {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: EmptyStateAction;
  minH?: string;
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  minH = "240px",
  style,
  ...props
}: EmptyStateProps) {
  const IconNode = icon ?? <Inbox size={28} strokeWidth={1.6} />;

  return (
    <GlassCard
      hover={false}
      className="flex items-center justify-center"
      style={{ minHeight: minH, ...style }}
      {...props}
    >
      <div className="flex max-w-[420px] flex-col items-center px-4 py-6 text-center">
        <div
          aria-hidden="true"
          className="mb-4 flex h-[56px] w-[56px] items-center justify-center rounded-[14px] border border-border-subtle bg-elevated text-ink-muted"
        >
          {IconNode}
        </div>
        <h2 className="mb-1 font-heading text-base font-bold tracking-[-0.01em] text-ink">
          {title}
        </h2>
        {description && (
          <p className={cn("text-sm leading-[1.6] text-ink-muted", action ? "mb-4" : "mb-0")}>
            {description}
          </p>
        )}
        {action && (
          <Button
            size="sm"
            onClick={action.onClick}
            className="min-h-[40px] rounded-[9px] px-5 text-xs font-semibold"
          >
            {action.label}
          </Button>
        )}
      </div>
    </GlassCard>
  );
}
