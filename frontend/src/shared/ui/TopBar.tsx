import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, BrainCircuit, TriangleAlert, TrendingUp, Columns2, Wrench,
  IndianRupee, FileText, BookOpen, Zap, Sparkles, BellRing, Network, Camera,
  ScrollText, Server, ClipboardList, ChevronDown, Menu as MenuIcon, X, Sun, Moon,
  Sunrise, Library, Gauge, Activity, Boxes, Bot, Waypoints, type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useColorMode } from "@/app/theme/ColorModeProvider";
import { GraylinxLogo } from "@/shared/ui/GraylinxLogo";
import { cn } from "@/lib/utils";

const ICON = { size: 17, strokeWidth: 1.75 };

interface NavItem {
  label: string;
  to: string;
  Icon: LucideIcon;
}
interface NavGroup {
  label: string;
  items: NavItem[];
}

// Same nav model as the retired sidebar — 5 groups, 22 destinations.
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Monitor",
    items: [
      { label: "Dashboard", to: "/dashboard", Icon: LayoutDashboard },
      { label: "Digest", to: "/digest", Icon: Sunrise },
      { label: "Nyx", to: "/ai", Icon: BrainCircuit },
      { label: "Agent", to: "/agent", Icon: Bot },
      { label: "Planner", to: "/planner", Icon: Waypoints },
      { label: "NL Query", to: "/nl-query", Icon: Sparkles },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "Energy", to: "/energy", Icon: Zap },
      { label: "Efficiency", to: "/efficiency", Icon: Zap },
      { label: "Anomalies", to: "/anomalies", Icon: TriangleAlert },
      { label: "Alarms", to: "/alarms", Icon: BellRing },
      { label: "IBMS Alarms", to: "/ibms-alarms", Icon: BellRing },
      { label: "Forecast", to: "/forecast", Icon: TrendingUp },
      { label: "Compare", to: "/compare", Icon: Columns2 },
    ],
  },
  {
    label: "Advanced",
    items: [
      { label: "Assets", to: "/assets", Icon: Boxes },
      { label: "Maintenance", to: "/maintenance", Icon: Wrench },
      { label: "Predictive", to: "/predictive", Icon: Activity },
      { label: "Work Orders", to: "/work-orders", Icon: ClipboardList },
      { label: "Topology", to: "/topology", Icon: Network },
      { label: "Cost", to: "/cost", Icon: IndianRupee },
      { label: "Optimizer", to: "/optimizer", Icon: Gauge },
      { label: "Reports", to: "/reports", Icon: FileText },
    ],
  },
  {
    label: "AI & Knowledge",
    items: [
      { label: "Past Fixes", to: "/past-fixes", Icon: Library },
      { label: "Know", to: "/know", Icon: BookOpen },
      { label: "Knowledge", to: "/rag", Icon: BookOpen },
      { label: "Vision", to: "/vision", Icon: Camera },
      { label: "Audit Log", to: "/audit", Icon: ScrollText },
    ],
  },
  {
    label: "Admin",
    items: [{ label: "System", to: "/system", Icon: Server }],
  },
];

const isActivePath = (to: string, pathname: string) =>
  pathname === to || pathname.startsWith(`${to}/`);

const groupActive = (group: NavGroup, pathname: string) =>
  group.items.some((item) => isActivePath(item.to, pathname));

// ── Compact theme toggle (theme-aware, works in light & dark) ─────────────────
function ThemeToggle() {
  const { colorMode, toggleColorMode } = useColorMode();
  const isDark = colorMode === "dark";
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      onClick={toggleColorMode}
      className="size-8 rounded-[10px] text-ink-secondary hover:bg-elevated hover:text-ink"
    >
      {isDark ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
    </Button>
  );
}

// ── Desktop: one dropdown per group ───────────────────────────────────────────
function GroupMenu({ group, pathname }: { group: NavGroup; pathname: string }) {
  const active = groupActive(group, pathname);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "relative h-8 gap-1 px-3 text-[13px] tracking-[-0.01em] hover:bg-elevated hover:text-ink",
            active ? "bg-[var(--glow)] font-bold text-ink-brand" : "font-medium text-ink-secondary",
          )}
        >
          {group.label}
          <ChevronDown size={14} strokeWidth={2} />
          {active && (
            <span className="absolute right-[26px] bottom-[3px] left-3 h-[2px] rounded-full bg-brand shadow-[0_0_8px_rgba(31,63,254,0.5)]" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={8}
        className="min-w-[190px] rounded-[14px] border-border-subtle bg-surface py-[6px] shadow-xl"
      >
        {group.items.map(({ label, to, Icon }) => {
          const itemActive = isActivePath(to, pathname);
          return (
            <DropdownMenuItem key={to} asChild className="mx-[6px] rounded-[10px] px-[10px] py-[8px]">
              <NavLink
                to={to}
                className={cn(
                  "flex items-center gap-3 text-[13px]",
                  itemActive ? "bg-[var(--glow)] font-semibold text-ink-brand" : "font-medium text-ink-secondary",
                )}
              >
                <Icon size={ICON.size} strokeWidth={itemActive ? 2 : ICON.strokeWidth} />
                <span>{label}</span>
              </NavLink>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Mobile: full-width dropdown sheet under the bar ───────────────────────────
function MobileSheet({
  open,
  pathname,
  onNavigate,
}: {
  open: boolean;
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div className="max-h-[calc(100vh-60px)] overflow-y-auto border-b border-border-subtle bg-surface px-4 py-3 shadow-lg">
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="mb-3">
                <p className="px-2 pb-1 text-[10px] font-bold tracking-[0.12em] text-ink-muted uppercase">
                  {group.label}
                </p>
                {group.items.map(({ label, to, Icon }) => {
                  const itemActive = isActivePath(to, pathname);
                  return (
                    <NavLink
                      key={to}
                      to={to}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-3 rounded-[10px] px-[10px] py-[10px] text-sm hover:bg-elevated hover:text-ink",
                        itemActive ? "bg-[var(--glow)] font-semibold text-ink-brand" : "font-medium text-ink-secondary",
                      )}
                    >
                      <Icon size={18} strokeWidth={itemActive ? 2 : 1.75} />
                      <span>{label}</span>
                    </NavLink>
                  );
                })}
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function TopBar() {
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the mobile sheet on navigation.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <motion.nav
      aria-label="Main navigation"
      className="sticky top-0 z-20 shrink-0 border-b border-border-subtle bg-glass shadow-[0_1px_0_rgba(31,63,254,0.06),0_4px_24px_rgba(31,63,254,0.04)] backdrop-blur-md"
      initial={{ y: -12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <div className="flex h-[60px] items-center gap-3 px-4 lg:px-6">
        {/* Brand — full Graylinx logo + THERMYNX product lockup */}
        <NavLink to="/dashboard" aria-label="THERMYNX — home" className="flex shrink-0 items-center gap-3">
          <GraylinxLogo variant="full" height={36} tagline={null} />
          {/* divider */}
          <span className="hidden h-[26px] w-px shrink-0 bg-border-subtle md:block" />
          <span className="hidden leading-[1.05] md:block">
            <span
              className="block animate-shimmer-text bg-clip-text font-heading text-[17px] font-extrabold tracking-[-0.02em] text-transparent"
              style={{ backgroundImage: "var(--brand-sheen)", backgroundSize: "200% 100%" }}
            >
              THERMYNX
            </span>
            <span className="mt-px block text-[9px] tracking-[0.16em] text-ink-muted uppercase">
              Operations Intelligence
            </span>
          </span>
        </NavLink>

        {/* Desktop group menus */}
        <div className="ml-4 hidden flex-1 items-center gap-1 lg:flex">
          {NAV_GROUPS.map((group) => (
            <GroupMenu key={group.label} group={group} pathname={pathname} />
          ))}
        </div>

        {/* Spacer for mobile (pushes controls right) */}
        <div className="flex-1 lg:hidden" />

        {/* Right controls */}
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden whitespace-nowrap text-[11px] text-ink-muted xl:block">
            Unicharm Facility · v0.4.0
          </span>
          <ThemeToggle />
          {/* Hamburger — mobile only */}
          <Button
            variant="ghost"
            size="icon"
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((o) => !o)}
            className="inline-flex size-8 rounded-[10px] text-ink-secondary hover:bg-elevated hover:text-ink lg:hidden"
          >
            {mobileOpen ? <X size={18} strokeWidth={2} /> : <MenuIcon size={18} strokeWidth={2} />}
          </Button>
        </div>
      </div>

      {/* Mobile dropdown sheet — overlays page content (does not push it down) */}
      <div className="lg:hidden">
        {/* click-away scrim */}
        <div
          className={cn(
            "fixed inset-x-0 top-[60px] bottom-0 bg-overlay transition-opacity duration-200",
            mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          onClick={() => setMobileOpen(false)}
        />
        <div className="absolute inset-x-0 top-full">
          <MobileSheet open={mobileOpen} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
        </div>
      </div>
    </motion.nav>
  );
}
