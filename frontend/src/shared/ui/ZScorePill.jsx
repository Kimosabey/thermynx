import { Box, Text } from "@chakra-ui/react";

/**
 * Z-score pill for anomaly cards — full-round, color-coded by severity.
 *
 * Usage: <ZScorePill value={3.8} />  →  "+3.8σ" in amber
 *        <ZScorePill value={-5.2} /> →  "-5.2σ" in red
 */
export default function ZScorePill({ value, ...props }) {
  const abs = Math.abs(value ?? 0);
  const sign = value >= 0 ? "+" : "";
  const label = `${sign}${Number(value).toFixed(1)}σ`;

  let color, bg, border;
  if (abs >= 4.5) {
    color = "#ef4444"; bg = "rgba(239,68,68,0.20)"; border = "rgba(239,68,68,0.60)";
  } else if (abs >= 3.5) {
    color = "#f97316"; bg = "rgba(249,115,22,0.20)"; border = "rgba(249,115,22,0.60)";
  } else {
    color = "#f59e0b"; bg = "rgba(245,158,11,0.20)"; border = "rgba(245,158,11,0.60)";
  }

  return (
    <Box
      as="span"
      display="inline-flex"
      alignItems="center"
      px="8px"
      py="3px"
      borderRadius="full"
      border="1px solid"
      bg={bg}
      borderColor={border}
      {...props}
    >
      <Text
        fontSize="10px"
        fontWeight={700}
        color={color}
        letterSpacing="0.02em"
        sx={{ fontVariantNumeric: "tabular-nums" }}
      >
        {label}
      </Text>
    </Box>
  );
}
