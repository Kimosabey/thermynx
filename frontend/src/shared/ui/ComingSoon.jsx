import { Box, Flex, Text, Badge } from "@chakra-ui/react";
import { motion } from "framer-motion";
import { Sparkles, Check } from "lucide-react";
import GlassCard from "./GlassCard";
import Eyebrow from "./Eyebrow";

const MotionBox = motion.create(Box);

export default function ComingSoon({ phase, items = [] }) {
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
            <Eyebrow>{phase} · planned</Eyebrow>
            <Text fontSize="md" fontWeight={700} color="text.primary" letterSpacing="-0.01em" mt={1}>
              Coming soon
            </Text>
          </Box>
          <Badge ml="auto" fontSize="10px" bg="rgba(124,58,237,0.12)" color="#a78bfa"
            border="1px solid rgba(124,58,237,0.25)" borderRadius="6px" px={2} py="2px">
            Roadmap
          </Badge>
        </Flex>

        <Text fontSize="sm" color="text.muted" mb={4}>
          The capabilities below are scoped and queued. They will arrive natively in this product —
          no cross-service dependencies, no cloud APIs, all processing on the on-prem Ollama box.
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
