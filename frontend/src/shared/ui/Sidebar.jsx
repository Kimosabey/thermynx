import { useState } from "react";
import { Box, VStack, Text, Flex, Divider, Tooltip, useBreakpointValue } from "@chakra-ui/react";
import { NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

const MotionBox = motion(Box);

const NAV_ITEMS = [
  {
    label: "Dashboard",
    to: "/dashboard",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    label: "AI Analyzer",
    to: "/analyzer",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    label: "Efficiency",
    to: "/efficiency",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  },
  {
    label: "Anomalies",
    to: "/anomalies",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
  },
  {
    label: "Forecast",
    to: "/forecast",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
      </svg>
    ),
  },
  {
    label: "Compare",
    to: "/compare",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  },
  {
    label: "AI Agents",
    to: "/agent",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5 2.5 2.5 0 0 0 7.5 18 2.5 2.5 0 0 0 10 15.5 2.5 2.5 0 0 0 7.5 13m9 0A2.5 2.5 0 0 0 14 15.5a2.5 2.5 0 0 0 2.5 2.5 2.5 2.5 0 0 0 2.5-2.5A2.5 2.5 0 0 0 16.5 13z"/>
      </svg>
    ),
  },
];

function NavItem({ label, to, icon, badge, collapsed }) {
  const { pathname } = useLocation();
  const isActive = pathname.startsWith(to);

  return (
    <Tooltip label={collapsed ? label : ""} placement="right" hasArrow isDisabled={!collapsed}>
      <Box as={NavLink} to={to} display="block" textDecoration="none" _hover={{ textDecoration: "none" }}>
        <MotionBox
          whileHover={{ x: collapsed ? 0 : 2 }}
          transition={{ duration: 0.12 }}
        >
          <Flex
            align="center"
            gap={3}
            px={collapsed ? 0 : 3}
            py="10px"
            mx={2}
            borderRadius="10px"
            justifyContent={collapsed ? "center" : "flex-start"}
            bg={isActive ? "rgba(0,196,244,0.12)" : "transparent"}
            color={isActive ? "brand.400" : "whiteAlpha.500"}
            _hover={{ bg: "rgba(255,255,255,0.07)", color: "whiteAlpha.900" }}
            transition="all 0.15s ease"
            position="relative"
          >
            {isActive && (
              <Box
                position="absolute"
                left={0}
                top="20%"
                bottom="20%"
                w="2px"
                bg="brand.500"
                borderRadius="full"
                boxShadow="0 0 8px rgba(0,196,244,0.8)"
              />
            )}
            <Box flexShrink={0}>{icon}</Box>
            <AnimatePresence>
              {!collapsed && (
                <MotionBox
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2 }}
                  overflow="hidden"
                  display="flex"
                  alignItems="center"
                  gap={2}
                >
                  <Text fontSize="sm" fontWeight={isActive ? 600 : 400} whiteSpace="nowrap">
                    {label}
                  </Text>
                  {badge && (
                    <Text
                      fontSize="9px"
                      fontWeight={700}
                      color="whiteAlpha.400"
                      bg="whiteAlpha.100"
                      px="5px"
                      py="1px"
                      borderRadius="4px"
                    >
                      {badge}
                    </Text>
                  )}
                </MotionBox>
              )}
            </AnimatePresence>
          </Flex>
        </MotionBox>
      </Box>
    </Tooltip>
  );
}

export default function Sidebar({ mobileOpen, onMobileClose }) {
  const [collapsed, setCollapsed] = useState(false);
  const isMobile = useBreakpointValue({ base: true, md: false });
  const width = isMobile ? "240px" : collapsed ? "64px" : "220px";

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {isMobile && mobileOpen && (
          <MotionBox
            position="fixed" inset={0} bg="blackAlpha.700" zIndex={10}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onMobileClose}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <MotionBox
        position={isMobile ? "fixed" : "relative"}
        left={isMobile ? (mobileOpen ? 0 : "-240px") : 0}
        top={0}
        zIndex={isMobile ? 20 : "auto"}
        animate={{ width }}
        transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
        h="100vh"
        bg="#080f22"
        display="flex"
        flexDirection="column"
        flexShrink={0}
        borderRight="1px solid"
        borderColor="border.subtle"
        py={4}
        overflow="hidden"
      >
        {/* Logo */}
        <Flex align="center" gap={3} px={collapsed ? 0 : 4} pb={5} justifyContent={collapsed ? "center" : "flex-start"}>
          <Box
            w="34px" h="34px" borderRadius="10px"
            bg="linear-gradient(135deg, #00c4f4, #0066cc)"
            display="flex" alignItems="center" justifyContent="center"
            flexShrink={0}
            boxShadow="0 0 16px rgba(0,196,244,0.3)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
              <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2"/>
            </svg>
          </Box>
          <AnimatePresence>
            {!collapsed && !isMobile && (
              <MotionBox
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Text fontWeight={800} fontSize="15px" color="white" letterSpacing="0.05em">
                  THERMYNX
                </Text>
                <Text fontSize="9px" color="whiteAlpha.400" letterSpacing="0.15em" textTransform="uppercase">
                  AI Operations
                </Text>
              </MotionBox>
            )}
          </AnimatePresence>
        </Flex>

        <Divider borderColor="whiteAlpha.100" mb={3} />

        <VStack spacing={1} align="stretch" flex={1} px={collapsed ? 0 : 1}>
          {!collapsed && (
            <Text px={4} pb={2} fontSize="9px" fontWeight={700} color="whiteAlpha.300" letterSpacing="0.15em" textTransform="uppercase">
              Navigation
            </Text>
          )}
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.to} {...item} collapsed={collapsed} />
          ))}
        </VStack>

        <Divider borderColor="whiteAlpha.100" my={3} />

        {/* Collapse toggle (desktop only) */}
        {!isMobile && (
          <Flex justify={collapsed ? "center" : "flex-end"} px={collapsed ? 0 : 3} mb={1}>
            <Box
              as="button"
              onClick={() => setCollapsed(!collapsed)}
              w="28px" h="28px"
              borderRadius="8px"
              border="1px solid"
              borderColor="whiteAlpha.100"
              display="flex" alignItems="center" justifyContent="center"
              color="whiteAlpha.400"
              _hover={{ bg: "whiteAlpha.100", color: "whiteAlpha.800" }}
              transition="all 0.15s"
            >
              <MotionBox animate={{ rotate: collapsed ? 180 : 0 }} transition={{ duration: 0.25 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </MotionBox>
            </Box>
          </Flex>
        )}

        {/* Footer */}
        <AnimatePresence>
          {!collapsed && (
            <MotionBox
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              px={4} mt={1}
            >
              <Text fontSize="10px" color="whiteAlpha.300" textAlign="center">
                Unicharm Facility · v0.1.0-poc
              </Text>
            </MotionBox>
          )}
        </AnimatePresence>
      </MotionBox>
    </>
  );
}
