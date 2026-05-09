# THERMYNX — Frontend Guide

**Stack:** React 18 + Vite 5 + Chakra UI 2 + Recharts 3 + Framer Motion 11

Dev server: `http://localhost:5173`
Source: `frontend/src/`

---

## Directory Structure

```
frontend/src/
├── app/
│   ├── App.jsx          # Router (React Router 6), wraps all pages in Layout
│   ├── Layout.jsx       # Sidebar + main content area
│   └── theme/           # Chakra UI theme config (colours, fonts, component overrides)
│
├── features/            # One folder per page — each has an index.jsx
│   ├── dashboard/
│   ├── analyzer/
│   ├── efficiency/
│   ├── anomalies/
│   ├── agent/
│   ├── forecast/
│   ├── compare/
│   ├── cost/
│   ├── maintenance/
│   ├── reports/
│   └── rag/
│
└── shared/
    └── ui/              # Reusable components (10 components)
```

---

## Routing

All routes are defined in `App.jsx`. The pattern is `/feature-name`.

| Route | Component | Page |
|-------|-----------|------|
| `/` | redirect → `/dashboard` | — |
| `/dashboard` | `features/dashboard` | Live KPI dashboard |
| `/analyzer` | `features/analyzer` | AI Analyzer (chat + chart) |
| `/efficiency` | `features/efficiency` | Efficiency band analysis |
| `/anomalies` | `features/anomalies` | Anomaly detection |
| `/agent` | `features/agent` | AI Agents (5 modes) |
| `/forecast` | `features/forecast` | Trend forecast |
| `/compare` | `features/compare` | Equipment comparison |
| `/cost` | `features/cost` | Energy cost breakdown |
| `/maintenance` | `features/maintenance` | Maintenance health |
| `/reports` | `features/reports` | Daily operations report |
| `/rag` | `features/rag` | Knowledge base / RAG search |

---

## Pages

### Dashboard (`/dashboard`)
**What it shows:** Live KPI cards (kW, TR, load%, temps) for all equipment. Equipment status tiles (RUNNING / STANDBY). Database and Ollama connectivity status.

**API calls:** `GET /equipment/summary?hours=24`

**Notable UX:** Animated number counters on load (Framer Motion). `StatusPulse` dot (green = running, grey = standby).

---

### AI Analyzer (`/analyzer`)
**What it shows:** Equipment selector + time range picker → timeseries chart → free-form Q&A text area → streaming markdown response.

**API calls:**
- `GET /equipment` (populate dropdown)
- `GET /equipment/{id}/timeseries?hours=N` (chart data)
- `POST /analyze` (SSE stream)
- `POST /threads`, `GET /threads`, `DELETE /threads/{id}` (conversation persistence)

**Notable UX:** SSE parsing via `EventSource`. Animated "thinking..." dots while waiting for first token. Markdown rendering with `react-markdown` + `remark-gfm`. Thread sidebar to revisit past conversations.

---

### Efficiency (`/efficiency`)
**What it shows:** kW/TR band bar for each chiller with colour coding, loss driver chips, delta vs design.

**API calls:** `GET /efficiency?hours=N`

**Notable UX:** Band colours: green (excellent/good) → yellow (fair) → orange (poor) → red (critical).

---

### Anomalies (`/anomalies`)
**What it shows:** Live anomaly scan results + historical anomaly table. Severity badges.

**API calls:**
- `GET /anomalies/live?hours=1` (triggered by "Scan Now" button)
- `GET /anomalies/history?limit=50`

---

### AI Agents (`/agent`)
**What it shows:** 5 mode cards with preset prompts. Run button → live reasoning trace (thought / tool_call / tool_result / tokens streaming in).

**API calls:** `POST /agent/run` (SSE stream)

**Notable UX:** Each SSE frame type renders differently — thoughts in grey italic, tool calls in a code block, tokens in the main output area. Animated progress indicator during tool calls.

---

### Forecast (`/forecast`)
**What it shows:** kW/TR trend line + confidence interval band chart (purple gradient). 7-day and 30-day projections. "Days to poor band" countdown.

**API calls:** `GET /forecast/{equipment_id}?metric=kw_per_tr&horizon=168`

---

### Compare (`/compare`)
**What it shows:** Equipment selector dropdowns (two equipment) → overlaid timeseries chart → side-by-side stat table → winner chip.

**API calls:**
- `GET /equipment` (populate both dropdowns)
- `GET /compare?a=X&b=Y&hours=N`

---

### Cost (`/cost`)
**What it shows:** Total kWh + INR for the selected window. Bar chart breakdown by equipment. Tariff input field.

**API calls:** `GET /cost?hours=N&tariff_inr_per_kwh=8.5`

---

### Maintenance (`/maintenance`)
**What it shows:** Health score gauge per equipment (A–D grade + 0–100 score). Run hours, cycle counts, wear estimate, recommendations list.

**API calls:** `GET /maintenance?hours=168`

---

### Reports (`/reports`)
**What it shows:** "Generate Report" button → streaming markdown report (full executive summary). Download as `.md` button.

**API calls:** `POST /reports/daily` (SSE stream)

---

### Knowledge Base (`/rag`)
**What it shows:** RAG corpus status (ready/empty, chunk count, source files). Semantic search input + result cards with relevance scores and source excerpts.

**API calls:**
- `GET /rag/status`
- `GET /rag/search?q=...&top_k=5`

---

## Shared UI Components

All in `frontend/src/shared/ui/`.

### `GlassCard`
Frosted glass card with RGBA backdrop blur. Used as the base card for all KPI and content sections.

```jsx
<GlassCard p={4} mb={4}>
  <Text>Content</Text>
</GlassCard>
```

---

### `KpiCard`
Metric display card. Shows label, value, unit, and optional trend arrow.

```jsx
<KpiCard label="kW/TR" value={0.71} unit="kW/TR" trend="up" />
```

Props: `label`, `value`, `unit`, `trend` (`up` / `down` / `neutral`), `color`

---

### `PageShell`
Wrapper that applies consistent page padding and max-width.

```jsx
<PageShell>
  <PageHeader title="Efficiency" subtitle="kW/TR band analysis" />
  {/* page content */}
</PageShell>
```

---

### `PageHeader`
Page title + subtitle with consistent typography.

```jsx
<PageHeader title="Efficiency" subtitle="Last 24 hours" />
```

---

### `PageTransition`
Framer Motion wrapper that adds a fade-in slide-up animation when a page mounts.

```jsx
<PageTransition>
  <PageShell>...</PageShell>
</PageTransition>
```

---

### `Sidebar`
Navigation sidebar. Docks on `2xl` breakpoint, drawer on smaller screens.

Contains: Graylinx brand mark, nav links (icons + labels), connection status indicators at the bottom.

---

### `PeriodSelect`
Dropdown for selecting a lookback window.

```jsx
<PeriodSelect value={hours} onChange={setHours} options={[1, 6, 24, 48, 168]} />
```

---

### `StatusPulse`
Green or grey pulsing dot indicating running / standby state.

```jsx
<StatusPulse isRunning={true} />
```

---

### `SkeletonCard`
Loading skeleton placeholder used while API data is fetching.

```jsx
{isLoading ? <SkeletonCard /> : <ActualContent data={data} />}
```

---

## Theme & Colours

Theme config: `frontend/src/app/theme/`

Key colour tokens:

| Token | Value | Usage |
|-------|-------|-------|
| `brand.300` | cyan-ish | Accent highlights, links |
| `brand.500` | primary blue | Primary buttons, active nav |
| `gray.800` | dark background | Card backgrounds |
| `gray.900` | darker | Page background |
| `green.400` | running state | StatusPulse, good band |
| `orange.400` | fair/warning | Fair band, warning severity |
| `red.400` | critical | Poor/critical band, critical severity |

---

## State Management

There is no global state store (no Redux, no Zustand). Each page manages its own state with `useState` and `useEffect`. Data is fetched on mount or on user interaction.

For the Analyzer and Agents pages, streaming state (`isStreaming`, `output`) is tracked locally.

This is intentional for the POC — if the app grows significantly, consider adding React Query for caching and Zustand for shared state (e.g., selected equipment persisted across pages).

---

## How to Add a New Page

1. **Create the feature folder:**
   ```
   frontend/src/features/my_feature/index.jsx
   ```

2. **Basic page template:**
   ```jsx
   import { useState, useEffect } from 'react';
   import { Text } from '@chakra-ui/react';
   import PageShell from '../../shared/ui/PageShell';
   import PageHeader from '../../shared/ui/PageHeader';
   import PageTransition from '../../shared/ui/PageTransition';
   import GlassCard from '../../shared/ui/GlassCard';

   export default function MyFeaturePage() {
     const [data, setData] = useState(null);

     useEffect(() => {
       fetch('/api/v1/my-endpoint')
         .then(r => r.json())
         .then(setData);
     }, []);

     return (
       <PageTransition>
         <PageShell>
           <PageHeader title="My Feature" subtitle="Description" />
           <GlassCard p={4}>
             <Text>{data ? JSON.stringify(data) : 'Loading...'}</Text>
           </GlassCard>
         </PageShell>
       </PageTransition>
     );
   }
   ```

3. **Add route in `App.jsx`:**
   ```jsx
   import MyFeaturePage from './features/my_feature';
   // ...
   <Route path="/my-feature" element={<MyFeaturePage />} />
   ```

4. **Add nav link in `Sidebar`** (find the nav links array in `Layout.jsx` or `Sidebar.jsx` and append):
   ```jsx
   { label: 'My Feature', path: '/my-feature', icon: SomeLucideIcon }
   ```

---

## SSE Streaming Pattern

For endpoints that stream (`/analyze`, `/agent/run`, `/reports/daily`), use `fetch` with manual response body reading — not `EventSource` (which doesn't support POST bodies).

```jsx
const response = await fetch('/api/v1/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ equipment_id, hours, question })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const chunk = decoder.decode(value);
  // chunk may contain multiple "data: {...}\n\n" lines
  for (const line of chunk.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    const frame = JSON.parse(line.slice(6));
    if (frame.type === 'token') setOutput(prev => prev + frame.content);
    if (frame.type === 'done') setIsStreaming(false);
    if (frame.type === 'error') setError(frame.detail);
  }
}
```
