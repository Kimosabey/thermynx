import { Select } from "@chakra-ui/react";

/** Shared native-select styling so every page matches (dark surface + cyan focus ring). */
export const surfaceSelectProps = {
  size: "sm",
  bg: "bg.surface",
  border: "1px solid",
  borderColor: "border.subtle",
  borderRadius: "10px",
  color: "text.primary",
  _hover: { borderColor: "accent.cyan" },
  _focusVisible: {
    borderColor: "brand.500",
    boxShadow: "0 0 0 1px var(--chakra-colors-brand-500)",
  },
};

export const HOURS_OPTIONS_STANDARD = [
  { value: 6, label: "Last 6 hours" },
  { value: 12, label: "Last 12 hours" },
  { value: 24, label: "Last 24 hours" },
  { value: 48, label: "Last 48 hours" },
  { value: 168, label: "Last 7 days" },
];

export const HOURS_OPTIONS_ANOMALY = [
  { value: 1, label: "Last 1 hour" },
  { value: 3, label: "Last 3 hours" },
  { value: 6, label: "Last 6 hours" },
  { value: 12, label: "Last 12 hours" },
  { value: 24, label: "Last 24 hours" },
];

export default function PeriodSelect({
  value,
  onChange,
  options = HOURS_OPTIONS_STANDARD,
  width = "150px",
  ...rest
}) {
  return (
    <Select
      {...surfaceSelectProps}
      w={width}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      {...rest}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}
