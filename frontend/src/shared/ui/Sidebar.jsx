import { useState } from "react";
import {
  Box,
  VStack,
  Text,
  Flex,
  Divider,
  Tooltip,
} from "@chakra-ui/react";
import { NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  MessageSquareText,
  Activity,
  TriangleAlert,
  TrendingUp,
  Columns2,
  Wrench,
  IndianRupee,
  FileText,
  Bot,
  ChevronLeft,
  ChevronRight,
  Wind,
} from "lucide-react";

const MotionBox = motion(Box);

const ICON = { size: 18, strokeWidth: 1.65 };

const NAV_ITEMS = [
  { label: "Dashboard", to: "/dashboard", Icon: LayoutDashboard },
  { label: "AI Analyzer", to: "/analyzer", Icon: MessageSquareText },
  { label: "Efficiency", to: "/efficiency", Icon: Activity },
  { label: "Anomalies", to: "/anomalies", Icon: TriangleAlert },
  { label: "Forecast", to: "/forecast", Icon: TrendingUp },
  { label: "Compare", to: "/compare", Icon: Columns2 },
  { label: "Maintenance", to: "/maintenance", Icon: Wrench },
  { label: "Cost", to: "/cost", Icon: IndianRupee },
  { label: "Reports", to: "/reports", Icon: FileText },
  { label: "AI Agents", to: "/agent", Icon: Bot },
];

const navListVariants = {
  initial: {},
  animate: {
    transition: { staggerChildren: 0.038, delayChildren: 0.06 },
  },
};

const navItemVariants = {
  initial: { opacity: 0, x: -14 },
  animate: {
    opacity: 1,
    x: 0,
    transition: { type: "spring", stiffness: 380, damping: 28 },
  },
};

function IconRail({ active, children }) {
  return (
    <Flex
      align="center"
      justify="center"
      w="36px"
      h="36px"
      flexShrink={0}
      borderRadius="11px"
      bg={
        active
          ? "linear-gradient(145deg, rgba(0,196,244,0.22), rgba(0,102,204,0.12))"
          : "rgba(255,255,255,0.055)"
      }
      border="1px solid"
      borderColor={
        active ? "rgba(0,196,244,0.35)" : "rgba(255,255,255,0.07)"
      }
      color={active ? "brand.400" : "whiteAlpha.600"}
      boxShadow={
        active ? "0 0 20px rgba(0,196,244,0.18)" : undefined
      }
      transition="background 0.2s ease, border-color 0.2s ease, box-shadow 0.25s ease, color 0.15s ease"
    >
      {children}
    </Flex>
  );
}

function NavItem({ label, to, Icon, badge, collapsed, onNavigate }) {
  const { pathname } = useLocation();
  const isActive =
    to === "/dashboard"
      ? pathname === "/dashboard"
      : pathname === to || pathname.startsWith(`${to}/`);

  return (
    <Tooltip label={collapsed ? label : ""} placement="right" hasArrow isDisabled={!collapsed}>
      <MotionBox variants={navItemVariants}>
        <Box
          as={NavLink}
          to={to}
          display="block"
          textDecoration="none"
          _hover={{ textDecoration: "none" }}
          onClick={() => onNavigate?.()}
        >
          <MotionBox
            whileHover={{ x: collapsed ? 0 : 4 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 520, damping: 30 }}
          >
            <Flex
              align="center"
              gap={3}
              px={collapsed ? 2 : 3}
              py={2.5}
              mx={2}
              borderRadius="14px"
              justifyContent={collapsed ? "center" : "flex-start"}
              bg={
                isActive
                  ? "linear-gradient(90deg, rgba(0,196,244,0.14) 0%, rgba(0,196,244,0.04) 100%)"
                  : "transparent"
              }
              border="1px solid"
              borderColor={isActive ? "rgba(0,196,244,0.22)" : "transparent"}
              color={isActive ? "brand.400" : "whiteAlpha.500"}
              _hover={{
                bg: isActive ? undefined : "rgba(255,255,255,0.06)",
                borderColor: isActive ? undefined : "rgba(255,255,255,0.08)",
                color: "whiteAlpha.950",
              }}
              transition="background 0.2s ease, border-color 0.2s ease, color 0.15s ease"
              position="relative"
              overflow="hidden"
            >
              {isActive && (
                <MotionBox
                  position="absolute"
                  inset={0}
                  bgGradient="linear(to-r, transparent, rgba(0,196,244,0.06), transparent)"
                  pointerEvents="none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.35 }}
                />
              )}
              {isActive && (
                <Box
                  position="absolute"
                  left={0}
                  top="18%"
                  bottom="18%"
                  w="3px"
                  bg="brand.500"
                  borderRadius="full"
                  boxShadow="0 0 12px rgba(0,196,244,0.9)"
                />
              )}
              <Box position="relative" zIndex={1}>
                <IconRail active={isActive}>
                  <Icon size={ICON.size} strokeWidth={ICON.strokeWidth} />
                </IconRail>
              </Box>
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
                    position="relative"
                    zIndex={1}
                  >
                    <Text fontSize="sm" fontWeight={isActive ? 600 : 500} letterSpacing="-0.01em" whiteSpace="nowrap">
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
      </MotionBox>
    </Tooltip>
  );
}

export default function Sidebar({ overlay, mobileOpen, onMobileClose }) {
  const [collapsed, setCollapsed] = useState(false);
  const width = overlay ? "260px" : collapsed ? "72px" : "236px";
  const showExpandedCopy = !collapsed && ((!overlay) || (overlay && mobileOpen));

  return (
    <>
      <AnimatePresence>
        {overlay && mobileOpen && (
          <MotionBox
            position="fixed"
            inset={0}
            bg="blackAlpha.600"
            backdropFilter="blur(10px)"
            zIndex={10}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onMobileClose}
          />
        )}
      </AnimatePresence>

      <MotionBox
        position={overlay ? "fixed" : "relative"}
        left={overlay ? (mobileOpen ? 0 : "-260px") : 0}
        top={0}
        zIndex={overlay ? 25 : "auto"}
        animate={{
          width,
          boxShadow: overlay && mobileOpen ? "24px 0 48px rgba(0,0,0,0.35)" : "none",
        }}
        transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
        h="100vh"
        display="flex"
        flexDirection="column"
        flexShrink={0}
        borderRight="1px solid"
        borderColor="rgba(255,255,255,0.06)"
        py={5}
        overflow="hidden"
        sx={{
          background:
            "linear-gradient(168deg, #0b162f 0%, #060d1f 42%, #050c18 100%)",
        }}
      >
        {/* Ambient edge */}
        <Box
          position="absolute"
          inset={0}
          bgGradient="linear(to-b, rgba(0,196,244,0.06), transparent 35%)"
          pointerEvents="none"
        />

        <Flex align="center" gap={3} px={collapsed ? 2 : 4} pb={6} justifyContent={collapsed ? "center" : "flex-start"} position="relative">
          <MotionBox
            whileHover={{ scale: 1.04, rotate: [-2, 2, 0] }}
            transition={{ type: "spring", stiffness: 400, damping: 18 }}
          >
            <Flex
              w="40px"
              h="40px"
              borderRadius="12px"
              bg="linear-gradient(135deg, #00c4f4 0%, #0066cc 55%, #5b21b6 130%)"
              align="center"
              justify="center"
              flexShrink={0}
              boxShadow="0 8px 28px rgba(0,196,244,0.35)"
            >
              <Wind color="white" size={22} strokeWidth={1.8} />
            </Flex>
          </MotionBox>
          <AnimatePresence mode="wait">
            {showExpandedCopy && (
              <MotionBox
                key="brand"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.2 }}
              >
                <Text fontWeight={800} fontSize="15px" color="white" letterSpacing="0.06em">
                  THERMYNX
                </Text>
                <Text fontSize="10px" color="whiteAlpha.450" letterSpacing="0.14em" textTransform="uppercase">
                  AI Operations
                </Text>
              </MotionBox>
            )}
          </AnimatePresence>
        </Flex>

        <Divider borderColor="whiteAlpha.120" mb={2} position="relative" />

        <MotionBox
          variants={navListVariants}
          initial="initial"
          animate="animate"
          flex={1}
          minH={0}
          overflowY="auto"
          overflowX="hidden"
          px={collapsed ? 0 : 1}
          position="relative"
          sx={{
            scrollbarWidth: "thin",
            "&::-webkit-scrollbar": { width: "4px" },
            "&::-webkit-scrollbar-thumb": {
              background: "rgba(255,255,255,0.12)",
              borderRadius: "full",
            },
          }}
        >
          {showExpandedCopy && (
            <Text px={4} pb={3} pt={1} fontSize="10px" fontWeight={700} color="whiteAlpha.350" letterSpacing="0.14em" textTransform="uppercase">
              Navigate
            </Text>
          )}
          <VStack spacing={1} align="stretch">
            {NAV_ITEMS.map((item) => (
              <NavItem
                key={item.to}
                {...item}
                collapsed={collapsed}
                onNavigate={() => overlay && onMobileClose?.()}
              />
            ))}
          </VStack>
        </MotionBox>

        <Divider borderColor="whiteAlpha.120" my={4} position="relative" />

        {!overlay && (
          <Flex justify={collapsed ? "center" : "flex-end"} px={collapsed ? 2 : 3} mb={1} position="relative">
            <MotionBox whileTap={{ scale: 0.94 }}>
              <Box
                as="button"
                type="button"
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                onClick={() => setCollapsed(!collapsed)}
                w="34px"
                h="34px"
                borderRadius="10px"
                border="1px solid"
                borderColor="whiteAlpha.150"
                display="flex"
                alignItems="center"
                justifyContent="center"
                color="whiteAlpha.500"
                bg="rgba(255,255,255,0.04)"
                _hover={{ bg: "rgba(255,255,255,0.09)", color: "whiteAlpha.900", borderColor: "rgba(0,196,244,0.35)" }}
                transition="all 0.18s ease"
              >
                <MotionBox
                  animate={{ rotate: collapsed ? 180 : 0 }}
                  transition={{ type: "spring", stiffness: 320, damping: 22 }}
                >
                  {collapsed ? (
                    <ChevronRight size={18} strokeWidth={2} />
                  ) : (
                    <ChevronLeft size={18} strokeWidth={2} />
                  )}
                </MotionBox>
              </Box>
            </MotionBox>
          </Flex>
        )}

        <AnimatePresence>
          {showExpandedCopy && (
            <MotionBox
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              px={4}
              mt={2}
              position="relative"
            >
              <Text fontSize="10px" color="whiteAlpha.350" textAlign="center" lineHeight="1.5">
                Unicharm Facility · v0.1.0-poc
              </Text>
            </MotionBox>
          )}
        </AnimatePresence>
      </MotionBox>
    </>
  );
}
