import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./Layout";
import Dashboard    from "../features/dashboard";
import AIAnalyzer   from "../features/analyzer";
import Efficiency   from "../features/efficiency";
import Anomalies    from "../features/anomalies";
import AgentHub     from "../features/agent";
import Forecast     from "../features/forecast";
import Compare      from "../features/compare";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"  element={<Dashboard />} />
        <Route path="analyzer"   element={<AIAnalyzer />} />
        <Route path="efficiency"  element={<Efficiency />} />
        <Route path="anomalies"   element={<Anomalies />} />
        <Route path="agent"       element={<AgentHub />} />
        <Route path="forecast"    element={<Forecast />} />
        <Route path="compare"     element={<Compare />} />
      </Route>
    </Routes>
  );
}
