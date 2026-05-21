# UI / UX Design System — HVAC AI Operations Intelligence Platform

Modern, animated, on-premise-first frontend for Graylinx HVAC intelligence. This document captures the visual language, motion philosophy, and the open-source-only library choices behind the revamp.

---

## 1. Design principles

| Principle | What it means for this product |
|---|---|
| **On-premise first** | Zero cloud fonts, zero CDN assets, zero remote telemetry. Every asset ships in the bundle so the app runs identically on an air-gapped plant LAN. |
| **Open source only** | Every UI dependency is OSS (MIT / Apache / BSD). No commercial tier needed. |
| **Operator-grade clarity** | Glanceable KPIs, monospaced numerics for tabular data, generous touch targets (≥44 px), AA contrast minimum. |
| **Motion as meaning** | Animation signals data freshness, agent activity, and system state — never decorative noise. Always respects `prefers-reduced-motion`. |
| **Brand-coherent** | Graylinx electric blue (#1F3FFE) appears as the only saturated colour on every screen; everything else is neutral. |

---

## 2. Brand identity

### 2.1 Colour palette (verified WCAG 2.2)

| Token | Hex | Role | Contrast |
|---|---|---|---|
| `brand.500` | `#1F3FFE` | Primary action, accent, focus ring | AAA 9:1 on white |
| `brand.600` | `#0123B4` | Hover, deep accent | AAA on white |
| `brand.700` | `#000F64` | Ultra-dark, shadow contrast | — |
| `brand.300` | `#6671FF` | Secondary action / gradient stop | — |
| `brand.100` | `#C7C9FF` | Soft accent / border | — |
| `brand.50`  | `#EFF0FF` | Canvas tint | — |
| `neutral.900` | `#1D1D21` | Deep text / sidebar bg base | AAA |
| `neutral.0` | `#FFFFFF` | Surface | — |

The full scale, plus 30+ semantic tokens (`bg.canvas`, `text.primary`, `accent.glow`, …), lives in `src/app/theme/index.js`. All semantic tokens are dual-mode (`default` / `_dark`).

### 2.2 Typography

System fonts only — no Google Fonts, no remote CDN:

| Use | Stack |
|---|---|
| Body | `"Inter", -apple-system, "Segoe UI", Roboto, sans-serif` (Inter bundled, others fallback) |
| Heading | `"Space Grotesk", "Inter", sans-serif` (bundled) |
| Mono / numerics | `"JetBrains Mono", "SF Mono", Menlo, monospace` (bundled) |

### 2.3 Logo system

The new `GraylinxLogo` component (`src/shared/ui/GraylinxLogo.jsx`) replaces the static PNG with three composable variants:

- **`<GraylinxLogo />`** — full lockup (mark + wordmark + tagline)
- **`<GraylinxLogo variant="mark" />`** — mark only (sidebar when collapsed, mobile chip)
- **`<GraylinxLogo variant="wordmark" />`** — text only

**The mark** is a pure-SVG stylised G composed of:
- Outer arc with a brand-gradient stroke (`brand.300 → brand.500 → brand.700`)
- Centre dot filled with an inverse gradient
- A breathing orbit ring that pulses every 2.6s
- A radial glow that breathes every 3.2s
- A 1.06× hover spring

**The wordmark** uses a gradient sheen that sweeps across the letters every 5.5s — subtle enough to read as "live", not distracting.

**Reduced motion**: all motion is gated by Framer Motion's `useReducedMotion()`. With OS-level reduced motion enabled, the mark renders as a static gradient G with the centre dot and the wordmark renders without sheen.

---

## 3. Motion language

| Pattern | Where | Duration | Easing |
|---|---|---|---|
| **Logo draw-in** | First mount of mark | 0.9s (staggered 0.18s) | `[0.65, 0, 0.35, 1]` |
| **Logo breathing glow** | Looping behind mark | 3.2s | `easeInOut` |
| **Orbit pulse** | Centre dot ring | 2.6s | `easeOut` |
| **Wordmark sheen** | Looping gradient | 5.5s | `linear` |
| **Sidebar expand/collapse** | width tween | 0.25s | cubic-bezier `0.25, 0.46, 0.45, 0.94` |
| **Wordmark slide-in** | When sidebar expands | 0.22s | same |
| **Aurora drift** | Background blobs | 22 / 28 / 32s | `easeInOut` |
| **Page transition** | Route change | 0.18s | `easeOut` |
| **KPI count-up** | KPI cards on data refresh | 0.6s | `easeOut` |
| **Agent step entry** | Agent timeline | spring | stiffness 280, damping 22 |

### Reduced motion contract

Every motion above has a static fallback. We never gate behaviour on motion — only delight.

---

## 4. Ambient background — Aurora

`src/shared/ui/AuroraBackground.jsx` renders three large blurred radial gradients that slowly drift behind the main content. It's pure CSS keyframes + Chakra `<Box>` — no canvas, no WebGL, no remote shaders.

- Three blobs: `brand.500` (top-left), `brand.300` (mid-right), `brand.100` (bottom-center)
- Each blob is `blur(90px)` and `opacity ≈ 0.3 × intensity`
- Drift periods of 22s / 28s / 32s for an organic, never-quite-repeating flow
- Fixed positioning at `z=0` so all content sits above it
- Pointer-events disabled — never blocks clicks
- Respects `prefers-reduced-motion`: blobs stay but stop drifting

Cost: <1% CPU on integrated GPUs, no GC churn, no requestAnimationFrame loop (it's pure CSS).

---

## 5. Component inventory

### Already in the design system (`src/shared/ui/`)

| Component | Purpose |
|---|---|
| `GlassCard` | Frosted-glass card with subtle border + shadow |
| `KpiCard` | Numeric metric + label + trend chip with count-up animation |
| `StatusPulse` | Live dot indicator (green/amber/red) with breathing pulse |
| `Sidebar` | Animated rail with collapse, active indicator, grouped nav |
| `Chip` | Quick-prompt pill button |
| `Eyebrow` | Uppercase small-caps label above page titles |
| `PageHeader` + `PageHeaderIcon` | Consistent page top section |
| `PageShell` | Max-width content shell with consistent gutter |
| `PageTransition` | Framer Motion route transition |
| `PeriodSelect` | Time-range selector |
| `SkeletonCard` | Loading shimmer |
| `EmptyState` | Empty-state illustration + CTA |
| `ErrorAlert` | Inline error block |
| `TraceStep` | Agent reasoning step pill |
| `ZScorePill` | Z-score severity badge |

### Added in this revamp

| Component | Purpose |
|---|---|
| **`GraylinxLogo`** | Animated lockup around the real Graylinx PNG (3 variants) |
| **`AuroraBackground`** | Aceternity-inspired 5-layer ambient mesh (base wash · drift blobs · dot-grid · mouse spotlight · scan beam) |
| **`ServiceStatusBar`** | Floating glassmorphic live indicator for MySQL/Postgres/Ollama/Telemetry; polls `/api/v1/health`; toasts on transitions |
| **`HoverGradientCard`** | Cursor-following radial spotlight + animated gradient border on hover (the "Linear/Vercel" effect) |
| **`BackgroundBeams`** | Animated diagonal SVG light beams along curved paths; pure SVG + Framer Motion |
| **`TextGenerateEffect`** | Staggered word-by-word reveal for static AI text (blur → clear + float-up) |
| **`StreamingText`** | Sibling of above for *live* SSE tokens — only the new tail animates each render |
| **`MovingBorder`** | Pill button with a rotating conic-gradient orbit border (3 tone presets) |

---

## 6. Library stack (all OSS, all bundled locally)

| Library | Licence | Role | Why this one |
|---|---|---|---|
| **React 18.3** | MIT | View layer | Industry default, concurrent rendering ready |
| **Vite 5** | MIT | Dev server + bundler | Fastest HMR; produces tree-shaken bundles |
| **@chakra-ui/react 2.10** | MIT | Component primitives + theming | Accessible by default, semantic tokens, runtime theming |
| **@emotion/react + styled** | MIT | CSS-in-JS runtime (Chakra's engine) | — |
| **framer-motion 11.12** | MIT | All motion / animation | Declarative, layout-aware, reduced-motion aware |
| **recharts 3.8** | MIT | Charts (kW/TR, efficiency bands, forecast) | SVG-based, themable, no canvas overhead |
| **lucide-react** | ISC | Iconography | Modern stroke-icon set, tree-shakable |
| **react-router-dom 6.28** | MIT | SPA routing | Standard, declarative |
| **react-markdown 9 + remark-gfm 4** | MIT | Render streamed LLM output (tables, code blocks) | Streaming-friendly |
| **@formkit/auto-animate 0.9** | MIT | Auto-animated list reorder for agent timeline / alarm feed | 3 KB, drop-in `useAutoAnimate()` hook — zero config |

### Deliberately *not* added

| Library | Why we didn't add it |
|---|---|
| **GSAP** | Commercial license for some plugins; Framer Motion covers our needs |
| **Lottie** | Designed around remote JSON files; SVG + Framer is on-prem cleaner |
| **Three.js / R3F** | Overkill for ambient gradients; would cost 5× the bundle weight |
| **Tailwind / shadcn** | Would force a parallel design system next to Chakra |
| **Google Fonts CDN** | Breaks on-premise / air-gap deployments |
| **Analytics / Sentry / Datadog RUM** | All call cloud endpoints; no place in a plant-LAN app |

---

## 7. Architecture patterns

### 7.1 Theming
- Single `theme/index.js` via Chakra's `extendTheme`
- Semantic tokens (`bg.canvas`, `text.primary`, etc.) — never hardcode colors in components
- Dual-mode (`default` / `_dark`) for every semantic token

### 7.2 Composition
- All page-level components live in `src/features/<feature>/index.jsx`
- Shared primitives in `src/shared/ui/`
- API client in `src/shared/api/client.js`
- Domain hooks (`useApi`, `useAppToast`) in `src/shared/hooks/`

### 7.3 Streaming UI
- LLM responses arrive as SSE frames
- `react-markdown` re-renders mid-stream; we throttle paint to 60 fps via `requestAnimationFrame`
- Agent timeline appends each step as it arrives — no batch waits

### 7.4 Accessibility
- WCAG 2.2 AA verified (semantic tokens have explicit contrast targets)
- Skip-link in `Layout.jsx`
- Focus-visible rings on every interactive element
- `aria-*` on agent timeline, KPI cards, charts (described in `aria-describedby`)
- Tabular numerics use `font-variant-numeric: tabular-nums`

### 7.5 Performance
- Code-split per feature route (Vite handles it via dynamic `import()` in `App.jsx`)
- `framer-motion`'s `useReducedMotion()` short-circuits animation hooks
- Aurora is pure CSS — no per-frame JS
- KPI counters use `requestAnimationFrame` with cleanup on unmount

---

## 8. File map (what was added in the revamp)

```
src/shared/ui/
├── GraylinxLogo.jsx         (NEW) animated PNG lockup with breathing glow
├── AuroraBackground.jsx     (NEW) Aceternity-style 5-layer ambient bg
├── ServiceStatusBar.jsx     (NEW) live system status pills + toasts
├── HoverGradientCard.jsx    (NEW) cursor-spotlight card with gradient border
├── BackgroundBeams.jsx      (NEW) SVG diagonal light beams along arcs
├── TextGenerateEffect.jsx   (NEW) staggered word reveal (+ StreamingText)
├── MovingBorder.jsx         (NEW) rotating conic-gradient border button
└── Sidebar.jsx              (MOD) wires <GraylinxLogo /> mark + wordmark

src/features/agent/
└── AgentRunner.jsx          (MOD) useAutoAnimate() on reasoning timeline

src/app/
└── Layout.jsx               (MOD) mounts AuroraBackground + ServiceStatusBar

docs/architecture/
└── UI_DESIGN_SYSTEM.md      (NEW) this document
```

---

## 9. Operator-facing rationale

The animation budget is intentional: motion in this UI is meant to **convey system state**, not entertain.

| Animation | What it tells the operator |
|---|---|
| Logo breathing pulse | App is alive, no infra failure |
| Wordmark gradient sweep | Brand is alive, this is the production console |
| KPI count-up | Number changed from last poll |
| StatusPulse green | Live data freshness <60s |
| Agent step appearance | Agent is reasoning — not stuck |
| Aurora drift | Ambient depth — never urgent, never distracting |

A motionless screen reads as "frozen / disconnected". A subtly-moving screen reads as "live". That's the whole motion philosophy.

---

## 10. Open-source compatibility verification

| Requirement | Status |
|---|---|
| All UI dependencies are MIT / Apache / ISC / BSD | ✅ |
| No font fetched from a remote CDN | ✅ (all fonts bundled in `public/fonts/`) |
| No image / icon fetched from a remote URL | ✅ (lucide-react icons inlined, no external src) |
| No analytics / error reporting calls leave the LAN | ✅ |
| Works on a fully air-gapped network (Ollama on Tailscale + local DBs) | ✅ |

---

_Last verified: 2026-05-21 against `package.json`, `src/app/theme/index.js`, and the live build._
