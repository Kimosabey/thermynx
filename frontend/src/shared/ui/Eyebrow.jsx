import { Text } from "@chakra-ui/react";

/**
 * Eyebrow / overline label — 10px, weight 700, UPPERCASE, 0.10em tracking.
 * Used ~50× across the product as section labels and field captions.
 *
 * Usage: <Eyebrow mb={3}>Equipment Overview</Eyebrow>
 */
export default function Eyebrow({ children, mb = 0, mt = 0, ...props }) {
  return (
    <Text
      fontSize="10px"
      fontWeight={700}
      color="text.muted"
      textTransform="uppercase"
      letterSpacing="0.10em"
      lineHeight="1.25"
      mb={mb}
      mt={mt}
      {...props}
    >
      {children}
    </Text>
  );
}
