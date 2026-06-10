import GlassSelect, { type GlassSelectOption } from "@/shared/ui/GlassSelect";

/**
 * Shared native-select styling — kept for the few raw <select> usages elsewhere.
 * New code should prefer <PeriodSelect/>, which is a custom glass dropdown.
 *
 * Legacy used Chakra style-props (size/bg/border/_hover/_focusVisible). The new
 * app has no raw Chakra <Select>, so these are exposed as Tailwind class strings
 * that a raw <select> can spread via className. API CHANGE: object of Chakra
 * props -> { className, focusBoxShadow } for use with a native element.
 */
export const surfaceSelectProps = {
  className:
    "rounded-[10px] border border-border-subtle bg-surface text-ink " +
    "hover:border-border-strong " +
    "focus-visible:border-brand focus-visible:shadow-[0_0_0_3px_rgba(31,63,254,0.12)]",
} as const;

export const HOURS_OPTIONS_STANDARD: GlassSelectOption[] = [
  { value: 6, label: "Last 6 hours" },
  { value: 12, label: "Last 12 hours" },
  { value: 24, label: "Last 24 hours" },
  { value: 48, label: "Last 48 hours" },
  { value: 168, label: "Last 7 days" },
];

export const HOURS_OPTIONS_ANOMALY: GlassSelectOption[] = [
  { value: 1, label: "Last 1 hour" },
  { value: 3, label: "Last 3 hours" },
  { value: 6, label: "Last 6 hours" },
  { value: 12, label: "Last 12 hours" },
  { value: 24, label: "Last 24 hours" },
];

export interface PeriodSelectProps {
  value: number | string;
  /** Receives the numeric value (always coerced via Number). */
  onChange: (value: number) => void;
  options?: GlassSelectOption[];
  width?: string;
}

/**
 * Period dropdown — thin wrapper over the shared GlassSelect. Same API as before
 * (value, onChange, options, width); onChange still receives the numeric value.
 */
export default function PeriodSelect({
  value,
  onChange,
  options = HOURS_OPTIONS_STANDARD,
  width = "150px",
  ...rest
}: PeriodSelectProps) {
  return (
    <GlassSelect
      value={value}
      onChange={(v) => onChange(Number(v))}
      options={options}
      width={width}
      placeholder="Select period"
      {...rest}
    />
  );
}
