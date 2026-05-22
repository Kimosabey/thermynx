/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
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
          echarts: ["echarts", "echarts-for-react"],
          react:   ["react", "react-dom", "react-router-dom"],
          chakra:  ["@chakra-ui/react", "@chakra-ui/icons", "@emotion/react", "@emotion/styled"],
          motion:  ["framer-motion"],
          markdown:["react-markdown", "remark-gfm"],
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: false,
  },
});
