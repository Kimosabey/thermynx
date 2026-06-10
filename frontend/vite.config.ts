/// <reference types="vitest/config" />
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Backend port the frontend's /api proxy points at. Override per-run with:
//   set VITE_BACKEND_PORT=8003 && npm run dev      (Windows cmd)
//   $env:VITE_BACKEND_PORT=8003; npm run dev       (PowerShell)
// Default 8000 is the canonical port; bump if zombies hold it (see
// docs/operations/runbooks/OLLAMA_SERVER_TUNING.md for the TCP-zombie issue).
const BACKEND_PORT = process.env.VITE_BACKEND_PORT || "8000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    // 5173 — the new (v2) app is now the canonical frontend. Run only ONE dev
    // server at a time on this port (stop the legacy frontend/ first).
    port: 5173,
    proxy: {
      "/api": {
        // 127.0.0.1 (not "localhost") — on Windows, Node may resolve localhost
        // to IPv6 ::1 while uvicorn binds IPv4, causing proxy 500s.
        target: `http://127.0.0.1:${BACKEND_PORT}`,
        changeOrigin: true,
      },
      "/proxy/grafana": { target: "http://localhost:3030", changeOrigin: true, rewrite: () => "/api/health" },
      "/proxy/prometheus": { target: "http://localhost:9292", changeOrigin: true, rewrite: () => "/-/healthy" },
      "/proxy/alertmanager": { target: "http://localhost:9394", changeOrigin: true, rewrite: () => "/-/healthy" },
      "/proxy/loki": { target: "http://localhost:3100", changeOrigin: true, rewrite: () => "/ready" },
      "/proxy/promtail": { target: "http://localhost:9080", changeOrigin: true, rewrite: () => "/ready" },
      "/proxy/redis-commander": { target: "http://localhost:8181", changeOrigin: true, rewrite: () => "/" },
    },
  },
  build: {
    // Each route is React.lazy'd in App.tsx so the per-page chunks split
    // naturally. We additionally pin the heavy vendor libs into their own
    // shared chunks so route-switches don't re-download them. (No chakra chunk —
    // shadcn/ui is copy-in source, not a vendor lib.)
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Function form (vendor bucketing) — pins the heavy libs into stable
        // shared chunks so route-switches reuse them. Transitive deps fall to
        // Rollup's default vendor chunking, which is fine.
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("echarts-for-react")) return "echarts_react";
          if (id.includes("echarts")) return "echarts_core";
          if (id.includes("framer-motion") || id.includes("/motion-dom/") || id.includes("/motion-utils/")) return "motion";
          if (id.includes("react-markdown") || id.includes("remark")) return "markdown";
          if (id.includes("react-router") || id.includes("/react-dom/") || id.includes("/scheduler/") || id.includes("/node_modules/react/")) return "react";
          return undefined;
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./src/test/setup.ts"],
  },
});
