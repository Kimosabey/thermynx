import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Flex, Spinner } from "@chakra-ui/react";
import Layout from "./Layout";

// Lazy-load every feature page so each becomes its own chunk and the
// initial bundle stays small. ECharts + Chakra + Framer-Motion + react /
// markdown vendor libs are pinned into shared chunks via vite.config.js
// manualChunks so the second page load reuses them from cache.
const Dashboard     = lazy(() => import("../features/dashboard"));
const AIPage        = lazy(() => import("../features/ai"));
const AIAnalyzer    = lazy(() => import("../features/analyzer"));
const Efficiency    = lazy(() => import("../features/efficiency"));
const Anomalies     = lazy(() => import("../features/anomalies"));
const AgentHub      = lazy(() => import("../features/agent"));
const Forecast      = lazy(() => import("../features/forecast"));
const Compare       = lazy(() => import("../features/compare"));
const Maintenance   = lazy(() => import("../features/maintenance"));
const CostAnalytics = lazy(() => import("../features/cost"));
const Reports       = lazy(() => import("../features/reports"));
const Digest        = lazy(() => import("../features/digest"));
const RAGKnowledge  = lazy(() => import("../features/rag"));
const PastFixes     = lazy(() => import("../features/knowledge"));
const NLQuery       = lazy(() => import("../features/nl_query"));
const Alarms        = lazy(() => import("../features/alarms"));
const Topology      = lazy(() => import("../features/topology"));
const Vision        = lazy(() => import("../features/vision"));
const Audit         = lazy(() => import("../features/audit"));
const SystemPage    = lazy(() => import("../features/system"));
const WorkOrders    = lazy(() => import("../features/work_orders"));

function PageFallback() {
  return (
    <Flex h="60vh" align="center" justify="center">
      <Spinner size="lg" color="accent.primary" thickness="3px" speed="0.7s" />
    </Flex>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"   element={<Suspense fallback={<PageFallback />}><Dashboard /></Suspense>} />
        <Route path="ai"          element={<Suspense fallback={<PageFallback />}><AIPage /></Suspense>} />
        {/* Legacy redirects — keep old bookmarks working */}
        <Route path="analyzer"    element={<Navigate to="/ai" replace />} />
        <Route path="nl-query"    element={<Suspense fallback={<PageFallback />}><NLQuery /></Suspense>} />
        <Route path="efficiency"  element={<Suspense fallback={<PageFallback />}><Efficiency /></Suspense>} />
        <Route path="anomalies"   element={<Suspense fallback={<PageFallback />}><Anomalies /></Suspense>} />
        <Route path="alarms"      element={<Suspense fallback={<PageFallback />}><Alarms /></Suspense>} />
        <Route path="forecast"    element={<Suspense fallback={<PageFallback />}><Forecast /></Suspense>} />
        <Route path="compare"     element={<Suspense fallback={<PageFallback />}><Compare /></Suspense>} />
        <Route path="maintenance" element={<Suspense fallback={<PageFallback />}><Maintenance /></Suspense>} />
        <Route path="topology"    element={<Suspense fallback={<PageFallback />}><Topology /></Suspense>} />
        <Route path="cost"        element={<Suspense fallback={<PageFallback />}><CostAnalytics /></Suspense>} />
        <Route path="reports"     element={<Suspense fallback={<PageFallback />}><Reports /></Suspense>} />
        <Route path="digest"      element={<Suspense fallback={<PageFallback />}><Digest /></Suspense>} />
        <Route path="agent"       element={<Navigate to="/ai?mode=agent" replace />} />
        <Route path="rag"         element={<Suspense fallback={<PageFallback />}><RAGKnowledge /></Suspense>} />
        <Route path="know"        element={<Suspense fallback={<PageFallback />}><RAGKnowledge /></Suspense>} />
        <Route path="past-fixes"  element={<Suspense fallback={<PageFallback />}><PastFixes /></Suspense>} />
        <Route path="vision"      element={<Suspense fallback={<PageFallback />}><Vision /></Suspense>} />
        <Route path="audit"       element={<Suspense fallback={<PageFallback />}><Audit /></Suspense>} />
        <Route path="system"      element={<Suspense fallback={<PageFallback />}><SystemPage /></Suspense>} />
        <Route path="work-orders" element={<Suspense fallback={<PageFallback />}><WorkOrders /></Suspense>} />
      </Route>
    </Routes>
  );
}
