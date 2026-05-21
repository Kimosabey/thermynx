import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./Layout";
import Dashboard    from "../features/dashboard";
import AIAnalyzer   from "../features/analyzer";
import Efficiency   from "../features/efficiency";
import Anomalies    from "../features/anomalies";
import AgentHub     from "../features/agent";
import Forecast     from "../features/forecast";
import Compare      from "../features/compare";
import Maintenance  from "../features/maintenance";
import CostAnalytics from "../features/cost";
import Reports      from "../features/reports";
import RAGKnowledge from "../features/rag";
import NLQuery      from "../features/nl_query";
import Alarms       from "../features/alarms";
import Topology     from "../features/topology";
import Vision       from "../features/vision";
import Audit        from "../features/audit";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"   element={<Dashboard />} />
        <Route path="analyzer"    element={<AIAnalyzer />} />
        <Route path="nl-query"    element={<NLQuery />} />
        <Route path="efficiency"  element={<Efficiency />} />
        <Route path="anomalies"   element={<Anomalies />} />
        <Route path="alarms"      element={<Alarms />} />
        <Route path="forecast"    element={<Forecast />} />
        <Route path="compare"     element={<Compare />} />
        <Route path="maintenance" element={<Maintenance />} />
        <Route path="topology"    element={<Topology />} />
        <Route path="cost"        element={<CostAnalytics />} />
        <Route path="reports"     element={<Reports />} />
        <Route path="agent"       element={<AgentHub />} />
        <Route path="rag"         element={<RAGKnowledge />} />
        <Route path="vision"      element={<Vision />} />
        <Route path="audit"       element={<Audit />} />
      </Route>
    </Routes>
  );
}
