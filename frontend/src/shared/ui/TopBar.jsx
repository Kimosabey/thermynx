import { useState, useEffect } from "react";
import {
  Box, Flex, Text, HStack, Button, IconButton, Collapse,
  Menu, MenuButton, MenuList, MenuItem, useColorMode,
} from "@chakra-ui/react";
import { NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard, BrainCircuit, TriangleAlert,
  TrendingUp, Columns2, Wrench, IndianRupee, FileText,
  BookOpen, Zap, Sparkles, BellRing, Network, Camera, ScrollText,
  Server, ClipboardList, ChevronDown, Menu as MenuIcon, X, Sun, Moon, Sunrise, Library, Gauge, Activity, Boxes,
} from "lucide-react";
import { GraylinxLogo } from "./GraylinxLogo";

const MotionBox = motion.create(Box);

const ICON = { size: 17, strokeWidth: 1.75 };

// Same nav model as the retired sidebar — 5 groups, 22 destinations.
const NAV_GROUPS = [
  {
    label: "Monitor",
    items: [
      { label: "Dashboard",   to: "/dashboard",   Icon: LayoutDashboard },
      { label: "Digest",      to: "/digest",      Icon: Sunrise },
      { label: "AI",          to: "/ai",          Icon: BrainCircuit },
      { label: "NL Query",    to: "/nl-query",    Icon: Sparkles },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "Energy",      to: "/energy",      Icon: Zap },
      { label: "Efficiency",  to: "/efficiency",  Icon: Zap },
      { label: "Anomalies",   to: "/anomalies",   Icon: TriangleAlert },
      { label: "Alarms",      to: "/alarms",      Icon: BellRing },
      { label: "IBMS Alarms", to: "/ibms-alarms", Icon: BellRing },
      { label: "Forecast",    to: "/forecast",    Icon: TrendingUp },
      { label: "Compare",     to: "/compare",     Icon: Columns2 },
    ],
  },
  {
    label: "Advanced",
    items: [
      { label: "Assets",      to: "/assets",      Icon: Boxes },
      { label: "Maintenance", to: "/maintenance", Icon: Wrench },
      { label: "Predictive",  to: "/predictive",  Icon: Activity },
      { label: "Work Orders", to: "/work-orders", Icon: ClipboardList },
      { label: "Topology",    to: "/topology",    Icon: Network },
      { label: "Cost",        to: "/cost",        Icon: IndianRupee },
      { label: "Optimizer",   to: "/optimizer",   Icon: Gauge },
      { label: "Reports",     to: "/reports",     Icon: FileText },
    ],
  },
  {
    label: "AI & Knowledge",
    items: [
      { label: "Past Fixes",  to: "/past-fixes",  Icon: Library },
      { label: "Know",        to: "/know",        Icon: BookOpen },
      { label: "Knowledge",   to: "/rag",         Icon: BookOpen },
      { label: "Vision",      to: "/vision",      Icon: Camera },
      { label: "Audit Log",   to: "/audit",       Icon: ScrollText },
    ],
  },
  {
    label: "Admin",
    items: [
      { label: "System",      to: "/system",      Icon: Server },
    ],
  },
];

const isActivePath = (to, pathname) =>
  pathname === to || pathname.startsWith(`${to}/`);

const groupActive = (group, pathname) =>
  group.items.some(item => isActivePath(item.to, pathname));

// ── Compact theme toggle (theme-aware, works in light & dark) ─────────────────
function ThemeToggle() {
  const { colorMode, toggleColorMode } = useColorMode();
  const isDark = colorMode === "dark";
  return (
    <IconButton
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      icon={isDark ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
      onClick={toggleColorMode}
      variant="ghost"
      size="sm"
      color="text.secondary"
      _hover={{ bg: "bg.elevated", color: "text.primary" }}
      borderRadius="10px"
    />
  );
}

// ── Desktop: one dropdown per group ───────────────────────────────────────────
function GroupMenu({ group, pathname }) {
  const active = groupActive(group, pathname);
  return (
    <Menu isLazy placement="bottom-start" gutter={8}>
      <MenuButton
        as={Button}
        variant="ghost"
        size="sm"
        rightIcon={<ChevronDown size={14} strokeWidth={2} />}
        position="relative"
        px="12px"
        fontSize="13px"
        fontWeight={active ? 700 : 500}
        letterSpacing="-0.01em"
        color={active ? "text.brand" : "text.secondary"}
        bg={active ? "accent.glow" : "transparent"}
        _hover={{ bg: "bg.elevated", color: "text.primary" }}
        _active={{ bg: "accent.glow" }}
      >
        {group.label}
        {active && (
          <Box
            position="absolute"
            left="12px"
            right="26px"
            bottom="3px"
            h="2px"
            bg="brand.500"
            borderRadius="full"
            boxShadow="0 0 8px rgba(31,63,254,0.5)"
          />
        )}
      </MenuButton>
      <MenuList
        bg="bg.surface"
        borderColor="border.subtle"
        borderRadius="14px"
        boxShadow="xl"
        py="6px"
        minW="190px"
      >
        {group.items.map(({ label, to, Icon }) => {
          const itemActive = isActivePath(to, pathname);
          return (
            <MenuItem
              key={to}
              as={NavLink}
              to={to}
              mx="6px"
              px="10px"
              py="8px"
              borderRadius="10px"
              w="auto"
              fontSize="13px"
              fontWeight={itemActive ? 600 : 500}
              color={itemActive ? "text.brand" : "text.secondary"}
              bg={itemActive ? "accent.glow" : "transparent"}
              _hover={{ bg: "bg.elevated", color: "text.primary" }}
              _focus={{ bg: "bg.elevated" }}
            >
              <Flex align="center" gap={3}>
                <Icon size={ICON.size} strokeWidth={itemActive ? 2 : ICON.strokeWidth} />
                <Text as="span">{label}</Text>
              </Flex>
            </MenuItem>
          );
        })}
      </MenuList>
    </Menu>
  );
}

// ── Mobile: full-width dropdown sheet under the bar ───────────────────────────
function MobileSheet({ open, pathname, onNavigate }) {
  return (
    <Collapse in={open} animateOpacity>
      <Box
        bg="bg.surface"
        borderBottom="1px solid"
        borderColor="border.subtle"
        boxShadow="lg"
        px={4}
        py={3}
        maxH="calc(100vh - 60px)"
        overflowY="auto"
      >
        {NAV_GROUPS.map(group => (
          <Box key={group.label} mb={3}>
            <Text
              fontSize="10px"
              fontWeight={700}
              color="text.muted"
              letterSpacing="0.12em"
              textTransform="uppercase"
              px="8px"
              pb="4px"
            >
              {group.label}
            </Text>
            {group.items.map(({ label, to, Icon }) => {
              const itemActive = isActivePath(to, pathname);
              return (
                <Flex
                  key={to}
                  as={NavLink}
                  to={to}
                  onClick={onNavigate}
                  align="center"
                  gap={3}
                  px="10px"
                  py="10px"
                  borderRadius="10px"
                  fontSize="14px"
                  fontWeight={itemActive ? 600 : 500}
                  color={itemActive ? "text.brand" : "text.secondary"}
                  bg={itemActive ? "accent.glow" : "transparent"}
                  _hover={{ bg: "bg.elevated", color: "text.primary" }}
                >
                  <Icon size={18} strokeWidth={itemActive ? 2 : 1.75} />
                  <Text as="span">{label}</Text>
                </Flex>
              );
            })}
          </Box>
        ))}
      </Box>
    </Collapse>
  );
}

export default function TopBar() {
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the mobile sheet on navigation.
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  return (
    <MotionBox
      as="nav"
      aria-label="Main navigation"
      position="sticky"
      top={0}
      zIndex={20}
      flexShrink={0}
      bg="bg.glass"
      backdropFilter="blur(12px)"
      borderBottom="1px solid"
      borderColor="border.subtle"
      boxShadow="0 1px 0 rgba(31,63,254,0.06), 0 4px 24px rgba(31,63,254,0.04)"
      initial={{ y: -12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <Flex align="center" gap={3} px={{ base: 4, lg: 6 }} h="60px">
        {/* Brand — full Graylinx logo + THERMYNX product lockup */}
        <Flex align="center" gap={3} flexShrink={0} as={NavLink} to="/dashboard" aria-label="THERMYNX — home">
          <GraylinxLogo variant="full" height={28} tagline={null} />
          {/* divider */}
          <Box
            display={{ base: "none", md: "block" }}
            w="1px" h="26px" bg="border.subtle" flexShrink={0}
          />
          <Box display={{ base: "none", md: "block" }} lineHeight="1.05">
            <Text
              as="span"
              display="block"
              fontFamily="heading"
              fontWeight={800}
              fontSize="17px"
              letterSpacing="-0.02em"
              color="text.primary"
              sx={{
                backgroundImage: "linear-gradient(90deg, #1F3FFE 0%, #06B6D4 50%, #1F3FFE 100%)",
                backgroundSize: "200% 100%",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
                animation: "thxSheen 5.5s linear infinite",
                "@keyframes thxSheen": {
                  "0%": { backgroundPosition: "200% 0" },
                  "100%": { backgroundPosition: "-200% 0" },
                },
              }}
            >
              THERMYNX
            </Text>
            <Text
              fontSize="9px"
              color="text.muted"
              letterSpacing="0.16em"
              textTransform="uppercase"
              mt="1px"
            >
              Operations Intelligence
            </Text>
          </Box>
        </Flex>

        {/* Desktop group menus */}
        <HStack
          spacing={1}
          ml={4}
          flex={1}
          display={{ base: "none", lg: "flex" }}
        >
          {NAV_GROUPS.map(group => (
            <GroupMenu key={group.label} group={group} pathname={pathname} />
          ))}
        </HStack>

        {/* Spacer for mobile (pushes controls right) */}
        <Box flex={1} display={{ base: "block", lg: "none" }} />

        {/* Right controls */}
        <HStack spacing={2} flexShrink={0}>
          <Text
            fontSize="11px"
            color="text.muted"
            display={{ base: "none", xl: "block" }}
            whiteSpace="nowrap"
          >
            Unicharm Facility · v0.4.0
          </Text>
          <ThemeToggle />
          {/* Hamburger — mobile only */}
          <IconButton
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileOpen}
            icon={mobileOpen ? <X size={18} strokeWidth={2} /> : <MenuIcon size={18} strokeWidth={2} />}
            onClick={() => setMobileOpen(o => !o)}
            variant="ghost"
            size="sm"
            color="text.secondary"
            _hover={{ bg: "bg.elevated", color: "text.primary" }}
            borderRadius="10px"
            display={{ base: "inline-flex", lg: "none" }}
          />
        </HStack>
      </Flex>

      {/* Mobile dropdown sheet — overlays page content (does not push it down) */}
      <Box display={{ base: "block", lg: "none" }}>
        {/* click-away scrim */}
        <Box
          position="fixed"
          top="60px"
          left={0}
          right={0}
          bottom={0}
          bg="bg.overlay"
          opacity={mobileOpen ? 1 : 0}
          pointerEvents={mobileOpen ? "auto" : "none"}
          transition="opacity 0.2s ease"
          onClick={() => setMobileOpen(false)}
        />
        <Box position="absolute" top="100%" left={0} right={0}>
          <MobileSheet
            open={mobileOpen}
            pathname={pathname}
            onNavigate={() => setMobileOpen(false)}
          />
        </Box>
      </Box>
    </MotionBox>
  );
}
