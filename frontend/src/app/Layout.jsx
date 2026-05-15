import { useState, useEffect, useRef } from "react";
import { Flex, Box, IconButton, Text, useBreakpointValue } from "@chakra-ui/react";
import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Menu } from "lucide-react";
import Sidebar from "../shared/ui/Sidebar";
import PageTransition from "../shared/ui/PageTransition";

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const isDockedSidebar = useBreakpointValue({ base: false, xl: true }, { fallback: false });
  const useDrawerNav = !isDockedSidebar;
  const location = useLocation();
  const mainRef = useRef(null);

  useEffect(() => {
    if (useDrawerNav) setMobileOpen(false);
  }, [location.pathname, useDrawerNav]);

  // Scroll-reset on route change (UX D5)
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [location.pathname]);

  return (
    <Flex minH="100vh" bg="bg.canvas" align="stretch">
      <Sidebar overlay={useDrawerNav} mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />

      <Box
        ref={mainRef}
        as="main"
        id="main-content"
        tabIndex={-1}
        flex="1"
        minW={0}
        overflow="auto"
        overflowX="hidden"
        minH="100vh"
        position="relative"
        bg="bg.canvas"
        sx={{ "&:focus": { outline: "none" } }}
      >
        {/* Mobile top bar */}
        {useDrawerNav && (
          <Flex
            px={4} py="11px"
            borderBottom="1px solid"
            borderColor="border.subtle"
            align="center" gap={3}
            bg="bg.surface"
            position="sticky" top={0} zIndex={5}
            boxShadow="0 1px 0 rgba(31,63,254,0.06)"
          >
            <IconButton
              aria-label="Open navigation menu"
              icon={<Menu size={18} strokeWidth={2} />}
              variant="ghost" size="sm"
              onClick={() => setMobileOpen(true)}
              color="text.secondary"
              minW="44px"
              h="44px"
            />
            <Text fontFamily="heading" fontWeight={800} fontSize="14px"
              color="accent.primary" letterSpacing="-0.02em">
              Graylinx
            </Text>
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
