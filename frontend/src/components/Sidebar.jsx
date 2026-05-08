import {
  Box,
  VStack,
  Text,
  Icon,
  Flex,
  Divider,
  Tooltip,
} from "@chakra-ui/react";
import { NavLink, useLocation } from "react-router-dom";

const NAV_ITEMS = [
  {
    label: "Dashboard",
    to: "/dashboard",
    icon: () => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    label: "AI Analyzer",
    to: "/analyzer",
    icon: () => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
];

function NavItem({ label, to, icon: IconComp }) {
  const location = useLocation();
  const isActive = location.pathname.startsWith(to);

  return (
    <Tooltip label={label} placement="right" hasArrow>
      <Box
        as={NavLink}
        to={to}
        w="full"
        display="block"
        textDecoration="none"
        _hover={{ textDecoration: "none" }}
      >
        <Flex
          align="center"
          gap={3}
          px={4}
          py={3}
          borderRadius="lg"
          mx={2}
          bg={isActive ? "rgba(0,184,245,0.18)" : "transparent"}
          color={isActive ? "brand.300" : "gray.400"}
          _hover={{
            bg: "rgba(255,255,255,0.08)",
            color: "white",
          }}
          transition="all 0.15s"
          cursor="pointer"
        >
          <Box flexShrink={0}>
            <IconComp />
          </Box>
          <Text fontSize="sm" fontWeight={isActive ? "600" : "400"} noOfLines={1}>
            {label}
          </Text>
        </Flex>
      </Box>
    </Tooltip>
  );
}

export default function Sidebar() {
  return (
    <Box
      w="220px"
      minH="100vh"
      bg="surface.sidebar"
      display="flex"
      flexDirection="column"
      flexShrink={0}
      py={4}
    >
      {/* Logo */}
      <Flex align="center" gap={2} px={5} pb={5}>
        <Box
          w={8}
          h={8}
          borderRadius="lg"
          bg="brand.500"
          display="flex"
          alignItems="center"
          justifyContent="center"
          flexShrink={0}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
          </svg>
        </Box>
        <Box>
          <Text fontWeight="700" fontSize="md" color="white" letterSpacing="wider">
            THERMYNX
          </Text>
          <Text fontSize="9px" color="gray.500" letterSpacing="widest" textTransform="uppercase">
            AI Operations
          </Text>
        </Box>
      </Flex>

      <Divider borderColor="whiteAlpha.100" mb={3} />

      {/* Navigation */}
      <VStack spacing={1} align="stretch" flex={1}>
        <Text px={5} pb={1} fontSize="10px" fontWeight="600" color="gray.600" letterSpacing="widest" textTransform="uppercase">
          Menu
        </Text>
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
      </VStack>

      {/* Footer */}
      <Divider borderColor="whiteAlpha.100" mt={3} mb={3} />
      <Box px={5}>
        <Text fontSize="10px" color="gray.600" textAlign="center">
          Unicharm Facility
        </Text>
        <Text fontSize="10px" color="gray.700" textAlign="center">
          v1.0.0
        </Text>
      </Box>
    </Box>
  );
}
