/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Backend port the frontend's /api proxy points at. Override per-run with:
//   set VITE_BACKEND_PORT=8003 && npm run dev      (Windows cmd)
//   $env:VITE_BACKEND_PORT=8003; npm run dev       (PowerShell)
// Default 8000 is the canonical port; bump if zombies hold it (see
// docs/operations/runbooks/OLLAMA_SERVER_TUNING.md for the TCP-zombie issue).
const BACKEND_PORT = process.env.VITE_BACKEND_PORT || "8000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: `http://localhost:${BACKEND_PORT}`,
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
    // Each route is React.lazy'd in App.jsx so the per-page chunks split
    // naturally. We additionally pin the heavy vendor libs into their own
    // shared chunks so route-switches don't re-download them.
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          echarts_core:    ["echarts"],
          echarts_react:   ["echarts-for-react"],
          react:           ["react", "react-dom", "react-router-dom"],
          chakra:          ["@chakra-ui/react", "@chakra-ui/icons", "@emotion/react", "@emotion/styled"],
          motion:          ["framer-motion"],
          markdown:        ["react-markdown", "remark-gfm"],
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: false,
  },
});
