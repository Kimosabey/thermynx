import { Box, Flex, Text, Badge } from "@chakra-ui/react";
import { motion } from "framer-motion";
import { Sparkles, Check } from "lucide-react";
import GlassCard from "./GlassCard";
import Eyebrow from "./Eyebrow";

const MotionBox = motion.create(Box);

/**
 * In-development placeholder card. The `phase` prop is accepted for
 * source-code traceability but is intentionally not rendered in the UI.
 */
export default function ComingSoon({ phase: _phase, items = [] }) {
  return (
    <MotionBox
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <GlassCard p={6}>
        <Flex align="center" gap={3} mb={4}>
          <Box
            w="40px" h="40px" borderRadius="12px"
            bg="rgba(31,63,254,0.14)"
            border="1px solid rgba(31,63,254,0.32)"
            display="flex" alignItems="center" justifyContent="center"
            color="#AEBBFF"
          >
            <Sparkles size={18} strokeWidth={1.9} />
          </Box>
          <Box>
            <Eyebrow>In development</Eyebrow>
            <Text fontSize="md" fontWeight={700} color="text.primary" letterSpacing="-0.01em" mt={1}>
              Available soon
            </Text>
          </Box>
          <Badge ml="auto" fontSize="10px" bg="rgba(124,58,237,0.12)" color="#a78bfa"
            border="1px solid rgba(124,58,237,0.25)" borderRadius="6px" px={2} py="2px">
            Preview
          </Badge>
        </Flex>

        <Text fontSize="sm" color="text.muted" mb={4}>
          The capabilities below are in active development. All processing
          stays on the on-prem Ollama server — no cloud APIs.
        </Text>

        <Box>
          {items.map((it, i) => (
            <Flex key={i} align="flex-start" gap={3} py={2} borderBottom={i < items.length - 1 ? "1px solid" : "none"} borderColor="border.subtle">
              <Box flexShrink={0} mt="2px" color="status.good">
                <Check size={14} strokeWidth={2.4} />
              </Box>
              <Text fontSize="sm" color="text.primary">{it}</Text>
            </Flex>
          ))}
        </Box>
      </GlassCard>
    </MotionBox>
  );
}
