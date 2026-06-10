import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Consistent outer padding + max width for every route (fluid below max width). */
export default function PageShell({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mx-auto w-full min-w-0 max-w-[1600px] p-3 sm:p-4 md:p-6 xl:p-8", className)}
      {...props}
    >
      {children}
    </div>
  );
}
