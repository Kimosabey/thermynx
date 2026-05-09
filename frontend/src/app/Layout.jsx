import { useState } from "react";
import { Flex, Box, IconButton, useBreakpointValue } from "@chakra-ui/react";
import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import Sidebar from "../shared/ui/Sidebar";
import PageTransition from "../shared/ui/PageTransition";

function HamburgerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6"  x2="21" y2="6"  />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useBreakpointValue({ base: true, md: false });
  const location = useLocation();

  return (
    <Flex minH="100vh" bg="bg.canvas">
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />

      <Box flex={1} overflow="auto" minH="100vh" position="relative">
        {/* Mobile top bar */}
        {isMobile && (
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
              icon={<HamburgerIcon />}
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
