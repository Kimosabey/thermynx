import { Flex, Text, Box, Button } from "@chakra-ui/react";
import { AlertCircle, X, WifiOff, Server, RotateCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const MotionBox = motion.create(Box);

function errorIcon(message) {
  if (!message) return AlertCircle;
  const m = message.toLowerCase();
  if (m.includes("network") || m.includes("fetch") || m.includes("reach")) return WifiOff;
  if (m.includes("502") || m.includes("503") || m.includes("unavailable")) return Server;
  return AlertCircle;
}

/**
 * Inline error banner — shows when `error` is a non-empty string.
 *
 * Props:
 *   error      — string | null
 *   onDismiss  — optional callback when user clicks X
 *   onRetry    — optional callback when user clicks Retry
 *   mb         — bottom margin (default 5)
 */
export default function ErrorAlert({ error, onDismiss, onRetry, mb = 5 }) {
  const Icon = errorIcon(error);

  return (
    <AnimatePresence>
      {error && (
        <MotionBox
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
          initial={{ opacity: 0, y: -6, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -4, height: 0 }}
          transition={{ duration: 0.2 }}
          overflow="hidden"
          mb={mb}
        >
          <Flex
            align="flex-start"
            gap={3}
            bg="rgba(220,38,38,0.08)"
            border="1px solid rgba(220,38,38,0.25)"
            borderRadius="12px"
            px={4} py={3}
          >
            <Box color="red.400" flexShrink={0} mt="1px" aria-hidden="true">
              <Icon size={15} strokeWidth={2} />
            </Box>
            <Text fontSize="sm" color="red.400" flex={1} lineHeight={1.6}>
              {error}
            </Text>
            {onRetry && (
              <Button
                size="xs"
                variant="ghost"
                color="red.400"
                onClick={onRetry}
                leftIcon={<RotateCw size={12} strokeWidth={2.2} />}
                _hover={{ bg: "rgba(220,38,38,0.12)" }}
                aria-label="Retry"
                minW="auto"
                px={2}
              >
                Retry
              </Button>
            )}
            {onDismiss && (
              <Box
                as="button"
                onClick={onDismiss}
                color="red.400"
                opacity={0.6}
                _hover={{ opacity: 1 }}
                flexShrink={0}
                mt="1px"
                p={1}
                borderRadius="6px"
                aria-label="Dismiss error"
              >
                <X size={14} strokeWidth={2} aria-hidden="true" />
              </Box>
            )}
          </Flex>
        </MotionBox>
      )}
    </AnimatePresence>
  );
}
