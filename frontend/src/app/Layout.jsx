import { useEffect, useRef } from "react";
import { Flex, Box } from "@chakra-ui/react";
import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import TopBar from "../shared/ui/TopBar";
import PageTransition from "../shared/ui/PageTransition";
import AuroraBackground from "../shared/ui/AuroraBackground";
import ServiceStatusBar from "../shared/ui/ServiceStatusBar";

export default function Layout() {
  const location = useLocation();
  const mainRef = useRef(null);

  // Scroll-reset on route change (UX D5)
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [location.pathname]);

  return (
    <Flex direction="column" h="100vh" bg="bg.canvas" overflow="hidden">
      <TopBar />

      <Box
        ref={mainRef}
        as="main"
        id="main-content"
        tabIndex={-1}
        flex="1"
        minW={0}
        overflow="auto"
        overflowX="hidden"
        position="relative"
        bg="bg.canvas"
        sx={{ "&:focus": { outline: "none" } }}
      >
        {/* Sticky viewport-pinned wrapper — Aurora stays in viewport during scroll
            and its negative margin removes its layout footprint so content overlays it. */}
        <Box
          position="sticky"
          top={0}
          h="100vh"
          mb="-100vh"
          pointerEvents="none"
          zIndex={0}
          overflow="hidden"
        >
          <AuroraBackground />
        </Box>

        <Box position="relative" zIndex={1}>
          <AnimatePresence mode="wait">
            <PageTransition key={location.pathname}>
              <Outlet />
            </PageTransition>
          </AnimatePresence>
        </Box>

        <ServiceStatusBar />
      </Box>
    </Flex>
  );
}
