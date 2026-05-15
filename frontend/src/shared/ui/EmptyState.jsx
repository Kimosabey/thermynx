import { Box, Flex, Text, Button } from "@chakra-ui/react";
import { Inbox } from "lucide-react";
import GlassCard from "./GlassCard";

/**
 * Standardized empty-state for pages with no data.
 *
 * Props:
 *   icon         — optional Lucide icon component instance (default: <Inbox />)
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
export default function EmptyState({
  icon,
  title,
  description,
  action,
  minH = "240px",
  ...props
}) {
  const IconNode = icon ?? <Inbox size={28} strokeWidth={1.6} />;

  return (
    <GlassCard hover={false} minH={minH} display="flex" alignItems="center" justifyContent="center" {...props}>
      <Flex direction="column" align="center" textAlign="center" px={4} py={6} maxW="420px">
        <Box
          aria-hidden="true"
          mb={4}
          w="56px"
          h="56px"
          borderRadius="14px"
          bg="bg.elevated"
          border="1px solid"
          borderColor="border.subtle"
          display="flex"
          alignItems="center"
          justifyContent="center"
          color="text.muted"
        >
          {IconNode}
        </Box>
        <Text
          as="h2"
          fontFamily="heading"
          fontWeight={700}
          fontSize="md"
          color="text.primary"
          mb={1}
          letterSpacing="-0.01em"
        >
          {title}
        </Text>
        {description && (
          <Text fontSize="sm" color="text.muted" lineHeight={1.6} mb={action ? 4 : 0}>
            {description}
          </Text>
        )}
        {action && (
          <Button
            size="sm"
            onClick={action.onClick}
            borderRadius="9px"
            fontSize="xs"
            fontWeight={600}
            px={5}
            minH="40px"
          >
            {action.label}
          </Button>
        )}
      </Flex>
    </GlassCard>
  );
}
