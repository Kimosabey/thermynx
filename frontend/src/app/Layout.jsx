import { useState, useEffect } from "react";
import { Flex, Box, IconButton, useBreakpointValue } from "@chakra-ui/react";
import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Menu } from "lucide-react";
import Sidebar from "../shared/ui/Sidebar";
import PageTransition from "../shared/ui/PageTransition";

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  /** Below 2xl (~1536px): overlay drawer — fixes 1080p @125–150% scale (~1280 CSS px) without squashing main. */
  const isDockedSidebar = useBreakpointValue(
    { base: false, "2xl": true },
    { fallback: false },
  );
  const useDrawerNav = !isDockedSidebar;
  const location = useLocation();

  useEffect(() => {
    if (useDrawerNav) setMobileOpen(false);
  }, [location.pathname, useDrawerNav]);

  return (
    <Flex minH="100vh" bg="bg.canvas" align="stretch">
      <Sidebar
        overlay={useDrawerNav}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <Box
        flex="1"
        minW={0}
        overflow="auto"
        overflowX="hidden"
        minH="100vh"
        position="relative"
      >
        {/* Compact top bar when nav is drawer/overlay */}
        {useDrawerNav && (
          <Flex
            px={4} py={3}
            borderBottom="1px solid"
            borderColor="border.subtle"
            align="center"
            gap={3}
            bg="bg.surface"
            position="sticky"
            top={0}
            zIndex={5}
          >
            <IconButton
              aria-label="Open menu"
              icon={<Menu size={20} strokeWidth={2} />}
              variant="ghost"
              size="sm"
              onClick={() => setMobileOpen(true)}
              color="text.muted"
            />
            <Box
              fontWeight={800}
              fontSize="14px"
              color="accent.cyan"
              letterSpacing="0.08em"
            >
              THERMYNX
            </Box>
          </Flex>
        )}

        <AnimatePresence mode="wait">
          <PageTransition key={location.pathname}>
            <Outlet />
          </PageTransition>
        </AnimatePresence>
      </Box>
    </Flex>
  );
}
