import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export default function PageHeader({ title, subtitle, icon, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("mb-8 flex w-full min-w-0 flex-wrap items-start justify-between gap-4", className)}>
      <div className="flex min-w-full flex-[1_1_auto] items-start gap-3 md:min-w-[min(280px,100%)]">
        {icon}
        <div className="min-w-0 flex-[1_1_auto]">
          <h1 className="font-heading text-lg leading-[1.15] font-extrabold tracking-[-0.03em] text-ink md:text-2xl">
            {title}
          </h1>
          {subtitle != null && subtitle !== "" && (
            <p className="mt-1 text-xs leading-snug text-ink-muted md:text-sm">{subtitle}</p>
          )}
        </div>
      </div>
      {actions ? (
        <div className="flex w-full flex-[1_1_auto] flex-wrap items-center justify-start gap-3 lg:w-auto lg:justify-end">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
