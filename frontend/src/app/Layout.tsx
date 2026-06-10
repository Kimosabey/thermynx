import { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";

import TopBar from "@/shared/ui/TopBar";
import PageTransition from "@/shared/ui/PageTransition";
import AuroraBackground from "@/shared/ui/AuroraBackground";
import ServiceStatusBar from "@/shared/ui/ServiceStatusBar";

export default function Layout() {
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  // Scroll-reset on route change (UX D5)
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [location.pathname]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-canvas">
      <TopBar />

      <main
        ref={mainRef}
        id="main-content"
        tabIndex={-1}
        className="relative min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-canvas focus:outline-none"
      >
        {/* Sticky viewport-pinned wrapper — Aurora stays in viewport during scroll;
            its negative margin removes its layout footprint so content overlays it. */}
        <div className="pointer-events-none sticky top-0 z-0 mb-[-100vh] h-screen overflow-hidden">
          <AuroraBackground />
        </div>

        <div className="relative z-[1]">
          <AnimatePresence mode="wait">
            <PageTransition key={location.pathname}>
              <Outlet />
            </PageTransition>
          </AnimatePresence>
        </div>

        <ServiceStatusBar />
      </main>
    </div>
  );
}
