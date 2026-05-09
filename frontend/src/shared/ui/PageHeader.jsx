import { Box, Flex, Heading, Text } from "@chakra-ui/react";

export default function PageHeader({ title, subtitle, icon, actions, mb = 8 }) {
  return (
    <Flex justify="space-between" align="flex-start" mb={mb} flexWrap="wrap" gap={4} w="100%" minW={0}>
      <Flex align="flex-start" gap={3} flex="1 1 auto" minW={{ base: "100%", md: "min(280px, 100%)" }}>
        {icon}
        <Box minW={0} flex="1 1 auto">
          <Heading
            size={{ base: "md", md: "lg" }}
            fontFamily="heading"
            fontWeight={800}
            color="text.primary"
            letterSpacing="-0.03em"
            lineHeight="1.15"
          >
            {title}
          </Heading>
          {subtitle != null && subtitle !== "" && (
            <Text color="text.muted" mt={1} fontSize={{ base: "xs", md: "sm" }} lineHeight="short">
              {subtitle}
            </Text>
          )}
        </Box>
      </Flex>
      {actions ? (
        <Flex
          align="center" gap={3} flexWrap="wrap" flex="1 1 auto" minW={0}
          justify={{ base: "flex-start", lg: "flex-end" }}
          w={{ base: "100%", lg: "auto" }}
        >
          {actions}
        </Flex>
      ) : null}
    </Flex>
  );
}
