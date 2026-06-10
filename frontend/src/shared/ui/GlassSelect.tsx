import { type CSSProperties } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * Custom glass dropdown — rebuilt on shadcn/radix Select to match the top-bar
 * menu, used everywhere instead of the OS-native <select>.
 *
 * Props:
 *   value        — current value (string|number; compared loosely)
 *   onChange     — called with the selected option's `value` (NOT an event)
 *   options      — [{ value, label }]
 *   placeholder  — trigger text when no option matches (default "Select")
 *   width        — trigger width (default "150px")
 *
 * Note: onChange receives the raw value, so call sites use `onChange={setX}`
 * or `onChange={(v) => setX(v)}` — not `(e) => setX(e.target.value)`.
 *
 * API change vs legacy: radix Select works on string values, so option values
 * are coerced to strings internally and mapped back to the original `value`
 * type on change. The Chakra `size` prop is dropped (was visual-only "sm").
 * Arbitrary style props are no longer spread onto a Chakra Menu; pass
 * `className` to style the trigger instead.
 */
export interface GlassSelectOption {
  value: string | number;
  label: string;
}

// Radix Select forbids an empty-string item value (it reserves "" for "clear").
// Legacy native <select> allowed value="" for "All"/plant-wide options, so map
// empty values to a sentinel internally and map back on change.
const EMPTY_SENTINEL = "__glasssel_empty__";
const toKey = (v: string | number | undefined): string => {
  const s = String(v ?? "");
  return s === "" ? EMPTY_SENTINEL : s;
};

export interface GlassSelectProps {
  value?: string | number;
  onChange: (value: GlassSelectOption["value"]) => void;
  options?: GlassSelectOption[];
  placeholder?: string;
  width?: string;
  className?: string;
}

export default function GlassSelect({
  value,
  onChange,
  options = [],
  placeholder = "Select",
  width = "150px",
  className,
}: GlassSelectProps) {
  const current = options.find((o) => String(o.value) === String(value));

  const handleChange = (next: string) => {
    const real = next === EMPTY_SENTINEL ? "" : next;
    const match = options.find((o) => String(o.value) === real);
    onChange(match ? match.value : real);
  };

  return (
    <Select value={current ? toKey(current.value) : undefined} onValueChange={handleChange}>
      <SelectTrigger
        size="sm"
        style={{ width } as CSSProperties}
        className={cn(
          // base — glassy trigger (rounded-[10px], surface bg, subtle border)
          "h-auto justify-between gap-2 rounded-[10px] border border-border-subtle bg-surface px-3 py-2 text-[13px] font-semibold transition-colors",
          current ? "text-ink" : "text-ink-muted",
          // hover / active
          "hover:border-border-strong hover:bg-elevated active:bg-elevated dark:hover:bg-elevated",
          // focus ring (matches legacy accent.primary + soft glow)
          "focus-visible:border-brand focus-visible:ring-0 focus-visible:shadow-[0_0_0_3px_rgba(31,63,254,0.12)]",
          // chevron color → ink-muted to read on glass
          "[&>svg]:text-ink-muted [&>svg]:size-[15px]",
          className,
        )}
      >
        <SelectValue placeholder={placeholder} className="text-left" />
      </SelectTrigger>

      <SelectContent
        position="popper"
        align="start"
        sideOffset={6}
        style={{ minWidth: width } as CSSProperties}
        className="z-30 max-h-[340px] rounded-[14px] border border-border-subtle bg-surface py-[6px] shadow-xl ring-0"
      >
        {options.map((o) => {
          const active = String(o.value) === String(value);
          return (
            <SelectItem
              key={toKey(o.value)}
              value={toKey(o.value)}
              className={cn(
                // base item — restyle as glass row. Override shadcn's reserved
                // check-slot padding (pr-8) and re-position the built-in radix
                // indicator (it lives in an absolute span) to sit flush-right.
                "mx-[6px] w-auto cursor-pointer justify-between gap-3 rounded-[10px] px-[10px] py-2 pr-[10px] text-[13px]",
                // built-in indicator span: drop absolute right-2, render in
                // flow on the right (DOM order is [indicator, label]; order-last
                // pushes the check after the label to match legacy layout).
                "[&>span:first-child]:static [&>span:first-child]:order-last [&>span:first-child]:right-auto [&>span:first-child]:size-[15px] [&>span:first-child]:shrink-0 [&>span:first-child]:text-brand",
                "[&_svg]:size-[15px] [&_svg]:stroke-[2.5]",
                "focus:bg-elevated focus:text-ink data-highlighted:bg-elevated data-highlighted:text-ink",
                active ? "bg-[var(--glow)] font-bold text-brand" : "font-medium text-ink-secondary",
              )}
            >
              {o.label}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
