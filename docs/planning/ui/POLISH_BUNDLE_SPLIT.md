# Polish — Bundle code-split

**Status:** queued · **ETA:** ~half-day

## Goal

Bundle is 2.0 MB (gzip 650 KB). Vite warns above 500 KB. ECharts alone
is ~700 KB. Lazy-load per-route to halve first-paint cost.

## Scope

| In | Out |
|---|---|
| `React.lazy()` + `Suspense` for every feature route | Streaming SSR |
| Manual chunk for `echarts` so all chart-using routes share one cached copy | Web-worker chart rendering |
| Optional: prefetch on link hover | Tree-shaking ECharts to just the components used |

## Design

- Convert each `Route element={<Foo />}` to `React.lazy(() => import("..."))`
- In `vite.config.js`, add `build.rollupOptions.output.manualChunks`:
  ```js
  manualChunks: {
    echarts: ["echarts", "echarts-for-react"],
    react:   ["react", "react-dom", "react-router-dom"],
    chakra:  ["@chakra-ui/react", "@emotion/react", "@emotion/styled"],
  }
  ```
- Add a small `<PageFallback />` shell so the lazy load doesn't flash blank

## Tasks
- [ ] Update `App.jsx` to `React.lazy` all feature routes
- [ ] Add `<Suspense>` boundary inside Layout
- [ ] Configure `manualChunks` in `vite.config.js`
- [ ] Verify build sizes — target: largest chunk under 800 KB
- [ ] Smoke-test page-transition UX (no double-flashes)

## Acceptance
- Initial bundle (`index.js`) is < 600 KB gzipped
- Each feature route's lazy chunk is < 200 KB gzipped
- Switching routes still feels instant (no spinner shown >150ms for
  cached chunks)
