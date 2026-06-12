import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Layout from "@/app/Layout";

/**
 * Route map ported from the legacy `frontend/src/app/App.jsx`. Ported pages are
 * lazy-loaded (one chunk each); pages not yet migrated render RoutePlaceholder.
 */

// ── Ported pages (Phase E Tier 1) ──
const Dashboard = lazy(() => import("@/features/dashboard"));
const Digest = lazy(() => import("@/features/digest"));
const Efficiency = lazy(() => import("@/features/efficiency"));
const Energy = lazy(() => import("@/features/energy"));
const Forecast = lazy(() => import("@/features/forecast"));
const Compare = lazy(() => import("@/features/compare"));
const Predictive = lazy(() => import("@/features/predictive"));
const Anomalies = lazy(() => import("@/features/anomalies"));
const Maintenance = lazy(() => import("@/features/maintenance"));
const Assets = lazy(() => import("@/features/assets"));
const Topology = lazy(() => import("@/features/topology"));
const Reports = lazy(() => import("@/features/reports"));
const Vision = lazy(() => import("@/features/vision"));
const RAGKnowledge = lazy(() => import("@/features/rag"));
const PastFixes = lazy(() => import("@/features/knowledge"));
const SystemPage = lazy(() => import("@/features/system"));
const NLQuery = lazy(() => import("@/features/nl_query"));
const Audit = lazy(() => import("@/features/audit"));
const Alarms = lazy(() => import("@/features/alarms"));
const IbmsAlarms = lazy(() => import("@/features/ibms_alarms"));
const CostAnalytics = lazy(() => import("@/features/cost"));
const Optimizer = lazy(() => import("@/features/optimizer"));
// ── Tier 3 (complex bundles) ──
const Nyx = lazy(() => import("@/features/assistant"));
const AIAnalyzer = lazy(() => import("@/features/analyzer"));
const AgentHub = lazy(() => import("@/features/agent"));
const PlannerInspector = lazy(() => import("@/features/planner"));
const AILegacy = lazy(() => import("@/features/ai"));
const WorkOrders = lazy(() => import("@/features/work_orders"));

function PageFallback() {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="size-8 animate-spin text-brand" />
    </div>
  );
}

const lazyRoute = (el: React.ReactNode) => <Suspense fallback={<PageFallback />}>{el}</Suspense>;

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />

        <Route path="dashboard" element={lazyRoute(<Dashboard />)} />
        {/* /ai = Nyx assistant (flagship). Quick/Agent/legacy kept as Nyx fallbacks. */}
        <Route path="ai" element={lazyRoute(<Nyx />)} />
        <Route path="ai/quick" element={lazyRoute(<AIAnalyzer />)} />
        <Route path="ai/agent" element={lazyRoute(<AgentHub />)} />
        <Route path="ai/legacy" element={lazyRoute(<AILegacy />)} />
        {/* Legacy redirects — keep old bookmarks working */}
        <Route path="analyzer" element={<Navigate to="/ai/quick" replace />} />
        <Route path="nl-query" element={lazyRoute(<NLQuery />)} />
        <Route path="efficiency" element={lazyRoute(<Efficiency />)} />
        <Route path="anomalies" element={lazyRoute(<Anomalies />)} />
        <Route path="alarms" element={lazyRoute(<Alarms />)} />
        <Route path="forecast" element={lazyRoute(<Forecast />)} />
        <Route path="compare" element={lazyRoute(<Compare />)} />
        <Route path="maintenance" element={lazyRoute(<Maintenance />)} />
        <Route path="predictive" element={lazyRoute(<Predictive />)} />
        <Route path="topology" element={lazyRoute(<Topology />)} />
        <Route path="cost" element={lazyRoute(<CostAnalytics />)} />
        <Route path="optimizer" element={lazyRoute(<Optimizer />)} />
        <Route path="reports" element={lazyRoute(<Reports />)} />
        <Route path="digest" element={lazyRoute(<Digest />)} />
        <Route path="agent" element={lazyRoute(<AgentHub />)} />
        <Route path="planner" element={lazyRoute(<PlannerInspector />)} />
        <Route path="rag" element={lazyRoute(<RAGKnowledge />)} />
        <Route path="know" element={lazyRoute(<RAGKnowledge />)} />
        <Route path="past-fixes" element={lazyRoute(<PastFixes />)} />
        <Route path="vision" element={lazyRoute(<Vision />)} />
        <Route path="audit" element={lazyRoute(<Audit />)} />
        <Route path="system" element={lazyRoute(<SystemPage />)} />
        <Route path="work-orders" element={lazyRoute(<WorkOrders />)} />
        <Route path="assets" element={lazyRoute(<Assets />)} />
        <Route path="energy" element={lazyRoute(<Energy />)} />
        <Route path="ibms-alarms" element={lazyRoute(<IbmsAlarms />)} />
      </Route>
    </Routes>
  );
}
