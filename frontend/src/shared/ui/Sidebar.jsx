import { useState } from "react";
import { Box, Flex, Text, Divider, Tooltip, Image } from "@chakra-ui/react";
import { NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, MessageSquareText, Activity, TriangleAlert,
  TrendingUp, Columns2, Wrench, IndianRupee, FileText, Bot,
  BookOpen, ChevronLeft, ChevronRight, Wind, Zap,
} from "lucide-react";
import logo from "../../assets/logo.png";

const MotionBox = motion.create(Box);

const ICON = { size: 18, strokeWidth: 1.65 };

const NAV_GROUPS = [
  {
    label: "Monitor",
    items: [
      { label: "Dashboard",   to: "/dashboard",   Icon: LayoutDashboard },
      { label: "AI Analyzer", to: "/analyzer",    Icon: MessageSquareText },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "Efficiency",  to: "/efficiency",  Icon: Zap },
      { label: "Anomalies",   to: "/anomalies",   Icon: TriangleAlert },
      { label: "Forecast",    to: "/forecast",    Icon: TrendingUp },
      { label: "Compare",     to: "/compare",     Icon: Columns2 },
    ],
  },
  {
    label: "Advanced",
    items: [
      { label: "Maintenance", to: "/maintenance", Icon: Wrench },
      { label: "Cost",        to: "/cost",        Icon: IndianRupee },
      { label: "Reports",     to: "/reports",     Icon: FileText },
    ],
  },
  {
    label: "AI & Knowledge",
    items: [
      { label: "AI Agents",   to: "/agent",       Icon: Bot },
      { label: "Knowledge",   to: "/rag",         Icon: BookOpen },
    ],
  },
];

const navListVariants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.04, delayChildren: 0.06 } },
};

const navItemVariants = {
  initial: { opacity: 0, x: -12 },
  animate: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 400, damping: 28 } },
};

function NavItem({ label, to, Icon, collapsed, onNavigate }) {
  const { pathname } = useLocation();
  const isActive = to === "/dashboard"
    ? pathname === "/dashboard"
    : pathname === to || pathname.startsWith(`${to}/`);

  return (
    <Tooltip label={collapsed ? label : ""} placement="right" hasArrow isDisabled={!collapsed}>
      <MotionBox variants={navItemVariants}>
        <Box as={NavLink} to={to} display="block" textDecoration="none"
          _hover={{ textDecoration: "none" }} onClick={() => onNavigate?.()}>
          <MotionBox
            whileHover={{ x: collapsed ? 0 : 3 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 500, damping: 32 }}
          >
            <Flex
              align="center"
              gap={3}
              px={collapsed ? "14px" : "12px"}
              py="9px"
              mx="8px"
              borderRadius="12px"
              justifyContent={collapsed ? "center" : "flex-start"}
              bg={isActive ? "rgba(5,17,242,0.18)" : "transparent"}
              border="1px solid"
              borderColor={isActive ? "rgba(5,17,242,0.3)" : "transparent"}
              color={isActive ? "#93A8FF" : "rgba(255,255,255,0.55)"}
              position="relative"
              overflow="hidden"
              _hover={{
                bg: isActive ? "rgba(5,17,242,0.22)" : "rgba(255,255,255,0.07)",
                color: "rgba(255,255,255,0.92)",
                borderColor: isActive ? "rgba(5,17,242,0.4)" : "rgba(255,255,255,0.08)",
              }}
              transition="all 0.16s ease"
            >
              {/* Active indicator */}
              {isActive && (
                <Box position="absolute" left={0} top="20%" bottom="20%"
                  w="3px" bg="brand.500" borderRadius="full"
                  boxShadow="0 0 10px rgba(5,17,242,0.8)" />
              )}

              {/* Icon */}
              <Box flexShrink={0} position="relative" zIndex={1}>
                <Icon size={ICON.size} strokeWidth={isActive ? 2 : ICON.strokeWidth} />
              </Box>

              {/* Label */}
              <AnimatePresence>
                {!collapsed && (
                  <MotionBox
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.2 }}
                    overflow="hidden"
                    position="relative"
                    zIndex={1}
                  >
                    <Text fontSize="13px" fontWeight={isActive ? 600 : 500}
                      letterSpacing="-0.01em" whiteSpace="nowrap">
                      {label}
                    </Text>
                  </MotionBox>
                )}
              </AnimatePresence>
            </Flex>
          </MotionBox>
        </Box>
      </MotionBox>
    </Tooltip>
  );
}

export default function Sidebar({ overlay, mobileOpen, onMobileClose }) {
  const [collapsed, setCollapsed] = useState(false);
  const width = overlay ? "260px" : collapsed ? "68px" : "230px";

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {overlay && mobileOpen && (
          <MotionBox
            position="fixed" inset={0} bg="rgba(6,9,26,0.75)"
            backdropFilter="blur(8px)" zIndex={10}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onMobileClose}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <MotionBox
        position={overlay ? "fixed" : "relative"}
        left={overlay ? (mobileOpen ? 0 : "-260px") : 0}
        top={0}
        zIndex={overlay ? 20 : "auto"}
        animate={{ width }}
        transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
        h="100vh"
        bg="#06091A"
        display="flex"
        flexDirection="column"
        flexShrink={0}
        borderRight="1px solid rgba(255,255,255,0.06)"
        overflow="hidden"
        // Subtle inner glow on right edge
        boxShadow="inset -1px 0 0 rgba(5,17,242,0.15), 4px 0 24px rgba(5,17,242,0.06)"
      >
        {/* Logo area */}
        <Flex
          align="center"
          gap={3}
          px={collapsed ? "14px" : "18px"}
          py="18px"
          justifyContent={collapsed ? "center" : "flex-start"}
          borderBottom="1px solid rgba(255,255,255,0.06)"
          flexShrink={0}
        >
          <Box
            w="34px" h="34px" borderRadius="10px" flexShrink={0}
            bg="white"
            display="flex" alignItems="center" justifyContent="center"
            overflow="hidden"
            boxShadow="0 0 0 1px rgba(5,17,242,0.2), 0 4px 12px rgba(5,17,242,0.25)"
          >
            <Image src={logo} alt="Graylinx" w="28px" objectFit="contain" />
          </Box>
          <AnimatePresence>
            {!collapsed && (
              <MotionBox
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Text fontFamily="heading" fontWeight={800} fontSize="15px"
                  color="white" letterSpacing="-0.02em" lineHeight="1.1">
                  THERMYNX
                </Text>
                <Text fontSize="9px" color="rgba(255,255,255,0.35)"
                  letterSpacing="0.14em" textTransform="uppercase" mt="1px">
                  by Graylinx
                </Text>
              </MotionBox>
            )}
          </AnimatePresence>
        </Flex>

        {/* Navigation */}
        <Box flex={1} overflowY="auto" overflowX="hidden" py={2}
          sx={{
            "&::-webkit-scrollbar": { width: "3px" },
            "&::-webkit-scrollbar-thumb": { bg: "rgba(5,17,242,0.3)", borderRadius: "full" },
          }}>
          <MotionBox variants={navListVariants} initial="initial" animate="animate">
            {NAV_GROUPS.map((group, gi) => (
              <Box key={group.label} mb={1}>
                <AnimatePresence>
                  {!collapsed && (
                    <MotionBox
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    >
                      <Text
                        fontSize="9px" fontWeight={700} color="rgba(255,255,255,0.25)"
                        letterSpacing="0.12em" textTransform="uppercase"
                        px="20px" pt={gi === 0 ? 2 : 4} pb={1}
                      >
                        {group.label}
                      </Text>
                    </MotionBox>
                  )}
                </AnimatePresence>
                {group.items.map(item => (
                  <NavItem key={item.to} {...item} collapsed={collapsed}
                    onNavigate={overlay ? onMobileClose : undefined} />
                ))}
              </Box>
            ))}
          </MotionBox>
        </Box>

        {/* Footer — version + collapse */}
        <Box borderTop="1px solid rgba(255,255,255,0.06)" flexShrink={0}>
          <AnimatePresence>
            {!collapsed && (
              <MotionBox
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                px="20px" py="10px"
              >
                <Text fontSize="10px" color="rgba(255,255,255,0.2)" textAlign="center">
                  Unicharm Facility · v0.3.0-poc
                </Text>
              </MotionBox>
            )}
          </AnimatePresence>

          {/* Collapse toggle — desktop only */}
          {!overlay && (
            <Flex justify={collapsed ? "center" : "flex-end"} px={collapsed ? 0 : "12px"} pb="12px">
              <MotionBox
                as="button"
                w="28px" h="28px" borderRadius="8px"
                border="1px solid rgba(255,255,255,0.1)"
                display="flex" alignItems="center" justifyContent="center"
                color="rgba(255,255,255,0.35)"
                onClick={() => setCollapsed(!collapsed)}
                whileHover={{ color: "rgba(255,255,255,0.8)", borderColor: "rgba(5,17,242,0.5)" }}
                transition={{ duration: 0.15 }}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                <MotionBox animate={{ rotate: collapsed ? 180 : 0 }} transition={{ duration: 0.25 }}>
                  <ChevronLeft size={14} strokeWidth={2} />
                </MotionBox>
              </MotionBox>
            </Flex>
          )}
        </Box>
      </MotionBox>
    </>
  );
}
